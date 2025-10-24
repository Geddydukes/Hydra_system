"""Deterministic router utilities used by the Python feather-agent runtime shim."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional

from .exceptions import NormalizationError, RoutingError

K_MULTIPLIERS = {"k": 1_000, "m": 1_000_000, "b": 1_000_000_000}


@dataclass(frozen=True)
class RouteDecision:
    routing_decision: str
    teacher_id: Optional[str]
    normalized_input: Optional[Dict[str, Any]]
    notes: Optional[str] = None


class RouterAgent:
    """Minimal router that mirrors the heuristics in the legacy FastAPI service."""

    def __init__(self, registry_root: Path) -> None:
        self.registry_root = Path(registry_root)

    # ---------- public API -------------------------------------------------
    def route(self, query: str, metadata: Optional[Dict[str, Any]] = None) -> RouteDecision:
        intent = detect_intent(query)
        metadata = metadata or {}

        if intent == "underwriting_dscr":
            teacher_id = "loan_dscr_v1"
        elif intent == "transfer_tax":
            teacher_id = "transfer_tax_v1"
        else:
            raise RoutingError("no matching symbolic teacher")

        try:
            normalized = self.normalize_for_teacher(teacher_id, query, metadata)
            return RouteDecision(
                routing_decision="symbolic",
                teacher_id=teacher_id,
                normalized_input=normalized,
            )
        except NormalizationError as exc:
            # Preserve routing decision but surface the failure to the caller.
            return RouteDecision(
                routing_decision="symbolic",
                teacher_id=teacher_id,
                normalized_input=None,
                notes=f"normalization_failed:{exc.to_dict()}",
            )

    def normalize_for_teacher(
        self, teacher_id: str, query: Optional[str], metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        spec = self._load_teacher_spec(teacher_id)
        schema: Dict[str, Any] = spec.get("inputs_schema", {})
        required_keys = list(schema.keys())
        out: Dict[str, Any] = {}

        # Structured metadata first
        for key in required_keys:
            if key in metadata and metadata[key] is not None:
                val = metadata[key]
                if isinstance(val, str):
                    parsed = _to_number(val.replace("%", ""))
                    out[key] = parsed if parsed is not None else val
                elif isinstance(val, (int, float)):
                    out[key] = float(val)

        # Query parsing fallbacks
        if query:
            normalized_from_text = _parse_query_for_teacher(teacher_id, query)
            for key, value in normalized_from_text.items():
                out.setdefault(key, value)

        missing = [k for k in required_keys if k not in out]
        if missing:
            raise NormalizationError("missing_required_inputs", missing=missing)

        for key, rule in schema.items():
            if rule.get("type") == "number":
                try:
                    out[key] = float(out[key])
                except (ValueError, TypeError) as exc:
                    raise NormalizationError("invalid_type", field=key) from exc

        return out

    # ---------- internals --------------------------------------------------
    def _load_teacher_spec(self, teacher_id: str) -> Dict[str, Any]:
        root = self.registry_root
        if not root.exists():
            raise FileNotFoundError(f"Registry root not found: {root}")

        candidate_files = []
        for path in root.rglob(f"{teacher_id}@*.json"):
            if "/tests/" in str(path):
                continue
            candidate_files.append(path)
        if not candidate_files:
            raise FileNotFoundError(f"No TeacherSpec found for {teacher_id} in {root}")
        latest = sorted(candidate_files)[-1]
        with latest.open("r", encoding="utf-8") as handle:
            return json.load(handle)


# ---------------------------------------------------------------------------
def detect_intent(query: str) -> Optional[str]:
    q = query.lower()
    underwriting_terms = ("dscr", "debt service", "debt-service", "loan", "coverage ratio")
    if any(term in q for term in underwriting_terms):
        return "underwriting_dscr"

    transfer_terms = ("transfer tax", "transfer-tax", "stamp duty", "conveyance tax")
    if any(term in q for term in transfer_terms):
        return "transfer_tax"

    return None


def _parse_query_for_teacher(teacher_id: str, query: str) -> Dict[str, float]:
    q = query.strip()
    if teacher_id.startswith("loan_dscr"):
        noi = _extract_first_number(q, ("noi", "net operating income"))
        ads = _extract_first_number(q, ("annual debt service", "debt service", "debt-service"))
        if noi is None:
            noi = _extract_any_number(q)
        if ads is None:
            first = _extract_any_number(q)
            if first is not None:
                q_wo_first = re.sub(_NUMBER_PATTERN, "", q, count=1, flags=re.I)
                ads = _extract_any_number(q_wo_first)
        out: Dict[str, float] = {}
        if noi is not None:
            out["noi"] = float(noi)
        if ads is not None:
            out["annual_debt_service"] = float(ads)
        return out

    if teacher_id.startswith("transfer_tax_v1"):
        sale_price = _extract_first_number(
            q,
            ("sale price", "price", "sale", "amount", "property value", "value"),
        )
        rate = _extract_percent(q)
        if sale_price is None:
            sale_price = _extract_any_number(q)
        if rate is None:
            first = _extract_any_number(q)
            if first is not None:
                q_wo_first = re.sub(_NUMBER_PATTERN, "", q, count=1, flags=re.I)
                rate = _extract_any_number(q_wo_first)
        out = {}
        if sale_price is not None:
            out["sale_price"] = float(sale_price)
        if rate is not None:
            out["rate_pct"] = float(rate)
        return out

    return {}


_NUMBER_PATTERN = r"(\$?[0-9][0-9,\.]*\s*[kmb]?)"


def _extract_percent(text: str) -> Optional[float]:
    percent_match = re.search(r"(\d+(?:\.\d+)?)\s*%", text, flags=re.I)
    if percent_match:
        return float(percent_match.group(1))
    pct_match = re.search(r"(\d+(?:\.\d+)?)\s*pct\b", text, flags=re.I)
    if pct_match:
        return float(pct_match.group(1))
    return None


def _to_number(token: str) -> Optional[float]:
    s = token.lower().strip()
    s = s.replace("$", "").replace(",", "")
    match = re.match(r"^([0-9]*\.?[0-9]+)\s*([kmb])?$", s)
    if not match:
        return None
    val = float(match.group(1))
    suffix = match.group(2)
    if suffix:
        val *= K_MULTIPLIERS[suffix]
    return val


def _extract_first_number(text: str, labels: tuple[str, ...]) -> Optional[float]:
    tlow = text.lower()
    for label in labels:
        for match in re.finditer(label.lower(), tlow):
            window = tlow[match.start() : match.end() + 40]
            num_match = re.search(_NUMBER_PATTERN, window)
            if num_match:
                number = _to_number(num_match.group(1))
                if number is not None:
                    return number
    return None


def _extract_any_number(text: str) -> Optional[float]:
    for match in re.finditer(_NUMBER_PATTERN, text, flags=re.I):
        number = _to_number(match.group(1))
        if number is not None:
            return number
    return None
