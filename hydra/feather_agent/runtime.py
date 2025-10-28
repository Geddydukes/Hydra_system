"""Feather-agent runtime shim implemented in pure Python for the test suite."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional

from .exceptions import NormalizationError, RoutingError
from .router import RouterAgent
from .teachers import TEACHER_EXECUTORS


@dataclass(frozen=True)
class FeatherRuntimeResult:
    routing_decision: str
    teacher_id: Optional[str]
    normalized_input: Optional[Dict[str, Any]]
    result: Optional[Dict[str, Any]]
    explanation: Optional[str] = None
    notes: Optional[str] = None


class FeatherRuntimeError(RuntimeError):
    """Raised when the runtime cannot execute a symbolic teacher."""


class FeatherRuntime:
    """In-process runtime that mirrors the public surface of the TypeScript Feather runtime."""

    def __init__(self, registry_root: Optional[Path] = None) -> None:
        if registry_root is None:
            registry_root = Path(__file__).resolve().parents[2] / "registry"
        self.registry_root = Path(registry_root)
        self.router = RouterAgent(self.registry_root)
        self._teachers = TEACHER_EXECUTORS.copy()

    # ------------------------------------------------------------------
    def health(self) -> Dict[str, Any]:
        return {
            "ok": True,
            "runtime": "feather-agent",
            "registry_root": str(self.registry_root),
        }

    def execute(self, query: str, metadata: Optional[Dict[str, Any]] = None) -> FeatherRuntimeResult:
        metadata = metadata or {}
        try:
            decision = self.router.route(query, metadata)
        except RoutingError as exc:
            raise FeatherRuntimeError(exc.message) from exc

        if decision.teacher_id is None:
            raise FeatherRuntimeError("router did not return a teacher")

        if decision.normalized_input is None:
            # Attempt a retry using metadata-only normalization.
            try:
                normalized = self.router.normalize_for_teacher(
                    decision.teacher_id, None, metadata
                )
            except NormalizationError as exc:
                raise FeatherRuntimeError(f"normalization_failed:{exc.to_dict()}") from exc
        else:
            normalized = decision.normalized_input

        teacher = self._teachers.get(decision.teacher_id)
        if teacher is None:
            raise FeatherRuntimeError(f"unknown_teacher:{decision.teacher_id}")

        result = teacher(normalized)
        explanation = self._build_explanation(decision.teacher_id, result)

        return FeatherRuntimeResult(
            routing_decision=decision.routing_decision,
            teacher_id=decision.teacher_id,
            normalized_input=normalized,
            result=result,
            explanation=explanation,
            notes=decision.notes,
        )

    # ------------------------------------------------------------------
    def _build_explanation(self, teacher_id: str, result: Dict[str, Any]) -> str:
        if teacher_id == "loan_dscr_v1":
            dscr = result.get("outputs", {}).get("dscr")
            verdict = result.get("verdict")
            return (
                "Debt service coverage ratio calculated from NOI and annual debt service "
                f"is {dscr}, which yields a {verdict} decision."
            )
        if teacher_id == "transfer_tax_v1":
            tax = result.get("outputs", {}).get("transfer_tax")
            rate = result.get("outputs", {}).get("rate")
            return (
                "Transfer tax computed deterministically from sale price and rate yields "
                f"${tax} at a {rate * 100:.2f}% rate."
            )
        return "Symbolic teacher executed successfully."
