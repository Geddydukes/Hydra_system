import os
import re
import json
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field, ValidationError
from pydantic_settings import BaseSettings
import httpx

# -------------------------
# Settings
# -------------------------
class Settings(BaseSettings):
    REGISTRY_ROOT: str = "registry"  # repo-local default
    ROUTER_INTENTS_YAML: Optional[str] = None  # optional external mapping

settings = Settings()

# Service URLs
TEACHERS_URL = os.getenv("TEACHERS_URL", "http://teachers:8001")
LLM_URL = os.getenv("LLM_URL", "http://llm:8002")

# -------------------------
# Utilities
# -------------------------
K_MULTIPLIERS = {
    "k": 1_000,
    "m": 1_000_000,
    "b": 1_000_000_000,
}

def _to_number(token: str) -> Optional[float]:
    """
    Convert strings like '120000', '120k', '1.2m', '$120,000', '120,000.50' to float.
    Deterministic and side-effect free.
    """
    s = token.lower().strip()
    s = s.replace("$", "").replace(",", "")
    m = re.match(r"^([0-9]*\.?[0-9]+)\s*([kmb])?$", s)
    if not m:
        return None
    val = float(m.group(1))
    suffix = m.group(2)
    if suffix:
        val *= K_MULTIPLIERS[suffix]
    return val

def _extract_first_number(text: str, labels: tuple[str, ...]) -> Optional[float]:
    """
    Find a labeled number by searching nearby tokens.
    Example labels: ('noi','net operating income')
    """
    tlow = text.lower()
    # simple window-based extraction: label within 12 chars of a number
    number_pattern = r"(\$?[0-9][0-9,\.]*\s*[kmb]?)"
    for label in labels:
        for m in re.finditer(label.lower(), tlow):
            window = tlow[m.start(): m.end() + 40]
            num_m = re.search(number_pattern, window)
            if num_m:
                n = _to_number(num_m.group(1))
                if n is not None:
                    return n
    return None

def _extract_any_number(text: str) -> Optional[float]:
    for m in re.finditer(r"(\$?[0-9][0-9,\.]*\s*[kmb]?)", text, flags=re.I):
        n = _to_number(m.group(1))
        if n is not None:
            return n
    return None

def load_teacher_spec(teacher_id: str) -> Dict[str, Any]:
    """
    Load the TeacherSpec from registry by convention:
    registry/<domain>/<teacher_id>@<version>.json
    If multiple versions exist, pick the lexicographically latest (semver-friendly if zero-padded).
    """
    root = Path(settings.REGISTRY_ROOT)
    if not root.exists():
        raise FileNotFoundError(f"Registry root not found: {root}")
    # walk domains
    candidate_files: list[Path] = []
    for domain_dir in root.iterdir():
        if not domain_dir.is_dir():
            continue
        for p in domain_dir.glob(f"{teacher_id}@*.json"):
            candidate_files.append(p)
        # also support tests/ subdir; ignore
    if not candidate_files:
        raise FileNotFoundError(f"No TeacherSpec found for {teacher_id} in {root}")
    latest = sorted(candidate_files)[-1]
    with latest.open("r", encoding="utf-8") as f:
        return json.load(f)

def detect_intent(query: str) -> Optional[str]:
    """
    Deterministic heuristic intent detector (no hard-coded values, no LLM).
    Extendable via optional YAML mapping if provided.
    """
    q = query.lower()
    # Built-in minimal heuristics
    underwriting_terms = ("dscr", "debt service", "debt-service", "loan", "coverage ratio")
    if any(t in q for t in underwriting_terms):
        return "underwriting_dscr"

    # Optional external YAML (id -> keywords[])
    yaml_path = settings.ROUTER_INTENTS_YAML
    if yaml_path and Path(yaml_path).exists():
        import yaml  # lazy import
        with open(yaml_path, "r", encoding="utf-8") as f:
            mapping = yaml.safe_load(f) or {}
        for intent_id, keywords in mapping.items():
            if any(kw.lower() in q for kw in keywords or []):
                return intent_id

    return None

# -------------------------
# Input / Output Models
# -------------------------
class RouteIn(BaseModel):
    query: str = Field(..., min_length=1)
    metadata: Dict[str, Any] = Field(default_factory=dict)

class RouteOut(BaseModel):
    routing_decision: str
    teacher_id: Optional[str] = None
    normalized_input: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None

class NormalizeIn(BaseModel):
    query: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

class NormalizeOut(BaseModel):
    teacher_id: str
    normalized_input: Dict[str, Any]

class RunOut(BaseModel):
    routing_decision: str
    teacher_id: Optional[str] = None
    normalized_input: Optional[Dict[str, Any]] = None
    result: Optional[Dict[str, Any]] = None
    explanation: Optional[str] = None
    notes: Optional[str] = None

# -------------------------
# Normalizers per teacher (deterministic)
# -------------------------
def normalize_for_teacher(teacher_id: str, query: Optional[str], metadata: Dict[str, Any]) -> Dict[str, Any]:
    """
    Deterministic normalizer: uses metadata first (structured),
    falls back to robust regex/number parsing on free text.
    Validates keys present in TeacherSpec.inputs_schema.
    """
    spec = load_teacher_spec(teacher_id)
    schema: Dict[str, Any] = spec.get("inputs_schema", {})
    required_keys = list(schema.keys())
    out: Dict[str, Any] = {}

    # 1) try metadata-direct
    for key in required_keys:
        if key in metadata and metadata[key] is not None:
            val = metadata[key]
            if isinstance(val, (int, float, str)):
                if isinstance(val, str):
                    parsed = _to_number(val)
                    out[key] = parsed if parsed is not None else val
                else:
                    out[key] = float(val) if isinstance(val, (int, float)) else val

    # 2) fallback: parse query text
    if query:
        q = query.strip()
        # Specialization: underwriting DSCR
        if teacher_id.startswith("loan_dscr"):
            noi = out.get("noi")
            ads = out.get("annual_debt_service")

            if noi is None:
                noi = _extract_first_number(q, ("noi", "net operating income"))
            if ads is None:
                ads = _extract_first_number(q, ("annual debt service", "debt service", "debt-service"))

            # If still missing, pull remaining numbers in order (least preferred)
            if noi is None:
                noi = _extract_any_number(q)
            if ads is None:
                # remove first number text then find next
                first = _extract_any_number(q)
                if first is not None:
                    # crude but deterministic: strip first occurrence
                    q_wo_first = re.sub(r"(\$?[0-9][0-9,\.]*\s*[kmb]?)", "", q, count=1, flags=re.I)
                    ads = _extract_any_number(q_wo_first)

            if noi is not None:
                out["noi"] = float(noi)
            if ads is not None:
                out["annual_debt_service"] = float(ads)

    # 3) final validation: ensure all required keys present and numeric when expected
    missing = [k for k in required_keys if k not in out]
    if missing:
        raise HTTPException(status_code=422, detail={"error": "missing_required_inputs", "missing": missing})

    # Coerce numerics
    for key, rule in schema.items():
        if rule.get("type") == "number":
            try:
                out[key] = float(out[key])
            except (ValueError, TypeError):
                raise HTTPException(status_code=422, detail={"error": "invalid_type", "field": key, "expected": "number"})

    return out

# -------------------------
# FastAPI app
# -------------------------
app = FastAPI(title="Hydra Router", version="0.1.0")

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/normalize", response_model=NormalizeOut)
def normalize(teacher_id: str = Query(..., min_length=1), payload: NormalizeIn = None):
    try:
        normalized = normalize_for_teacher(teacher_id, (payload.query if payload else None), (payload.metadata if payload else {}))
        return {"teacher_id": teacher_id, "normalized_input": normalized}
    except HTTPException:
        raise
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=e.errors())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"normalize_error: {e}")

@app.post("/route", response_model=RouteOut)
def route(req: RouteIn):
    intent = detect_intent(req.query)
    if intent == "underwriting_dscr":
        teacher_id = "loan_dscr_v1"
        try:
            normalized = normalize_for_teacher(teacher_id, req.query, req.metadata or {})
            return RouteOut(routing_decision="symbolic", teacher_id=teacher_id, normalized_input=normalized)
        except HTTPException as he:
            # If normalization fails, still route but flag missing fields
            return RouteOut(routing_decision="symbolic", teacher_id=teacher_id, notes=f"normalization_failed: {he.detail}")
    # no known symbolic teacher; let upstream decide: llm or create_teacher
    return RouteOut(routing_decision="llm", notes="no matching symbolic teacher")

@app.post("/run", response_model=RunOut)
def run(req: RouteIn):
    decision = route(req)
    if decision.routing_decision != "symbolic" or not decision.teacher_id:
        return RunOut(**decision.dict(), notes="llm_or_other_path")

    # Try deterministic normalization first
    normalized = decision.normalized_input
    if not normalized:
        # fallback to LLM normalization
        spec = load_teacher_spec(decision.teacher_id)
        schema_hint = spec.get("inputs_schema", {})
        if not req.query:
            raise HTTPException(status_code=422, detail="missing_query_for_llm_normalization")
        with httpx.Client(timeout=12.0) as client:
            r = client.post(f"{LLM_URL}/llm/normalize", json={
                "teacher_id": decision.teacher_id,
                "schema_hint": schema_hint,
                "user_text": req.query
            })
            if r.status_code != 200:
                raise HTTPException(status_code=502, detail=f"llm_normalize_failed: {r.text}")
            normalized = r.json().get("normalized", {})

    # Ensure required fields present
    spec = load_teacher_spec(decision.teacher_id)
    required_keys = list(spec.get("inputs_schema", {}).keys())
    missing = [k for k in required_keys if k not in normalized]
    if missing:
        raise HTTPException(status_code=422, detail={"error":"missing_required_inputs_after_normalization","missing":missing})

    # Execute teacher
    with httpx.Client(timeout=8.0) as client:
        r = client.post(f"{TEACHERS_URL}/teachers/execute", json={
            "teacher_id": decision.teacher_id,
            "inputs": normalized
        })
        if r.status_code != 200:
            raise HTTPException(status_code=502, detail=f"teacher_execute_failed: {r.text}")
        result = r.json()

    # Generate explanation via LLM (faithful + whitelisted numbers)
    with httpx.Client(timeout=8.0) as client:
        r = client.post(f"{LLM_URL}/llm/explain", json={
            "teacher_id": decision.teacher_id,
            "trace": result.get("trace", [])
        })
        if r.status_code != 200:
            # still return deterministic result, explanation optional
            return RunOut(routing_decision="symbolic", teacher_id=decision.teacher_id,
                          normalized_input=normalized, result=result,
                          notes=f"explain_failed:{r.text}")
        explanation = r.json().get("explanation")

    return RunOut(routing_decision="symbolic", teacher_id=decision.teacher_id,
                  normalized_input=normalized, result=result, explanation=explanation)
