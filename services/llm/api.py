from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Any, Dict, Iterable
import json, re, math

# Absolute imports so the module works when /app isn't a package
from .client import llm_structured
from .prompts import EXPLAIN_PROMPT, NORMALIZE_PROMPT  # NORMALIZE may be used elsewhere

app = FastAPI(title="Hydra LLM", version="0.1.0")

# --------- Models ---------
class NormalizeIn(BaseModel):
    teacher_id: str
    schema_hint: Dict[str, Any]
    user_text: str

class ExplainIn(BaseModel):
    teacher_id: str
    trace: Any

# --------- Health ---------
@app.get("/health")
def health():
    return {"ok": True}

# --------- Helpers ---------
def _iter_numbers(obj: Any) -> Iterable[float]:
    """Recursively extract numeric values from a nested trace structure."""
    if isinstance(obj, dict):
        for v in obj.values():
            yield from _iter_numbers(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from _iter_numbers(v)
    elif isinstance(obj, (int, float)) and math.isfinite(obj):
        yield float(obj)
    elif isinstance(obj, str):
        for m in re.finditer(r"-?\d+(?:\.\d+)?", obj):
            try:
                yield float(m.group(0))
            except ValueError:
                pass

def _format_allowed(ns: Iterable[float]) -> list[str]:
    """Return canonical numeric strings that the model is allowed to cite."""
    out = set()
    for x in ns:
        out.add(f"{x}")         # default repr
        out.add(f"{x:.2f}")     # 2 dp
        out.add(f"{x:.3f}")     # 3 dp
        out.add(("{:.3f}".format(x)).rstrip("0").rstrip("."))  # stripped
    # remove +/- inf or nan if they slipped in
    out = {s for s in out if re.fullmatch(r"-?\d+(?:\.\d+)?", s or "")}
    return sorted(out)

def _numbers_in_text(s: str) -> list[float]:
    vals = []
    for m in re.finditer(r"-?\d+(?:\.\d+)?", s):
        try:
            vals.append(float(m.group(0)))
        except ValueError:
            pass
    return vals

# --------- Endpoints ---------
@app.post("/llm/normalize")
def normalize(req: NormalizeIn):
    try:
        prompt = NORMALIZE_PROMPT.format(
            teacher_id=req.teacher_id,
            schema_hint=json.dumps(req.schema_hint, separators=(",", ":")),
            user_text=req.user_text.strip()[:4000],
        )
        data = llm_structured(prompt)
        if not isinstance(data, dict):
            raise ValueError("normalize_not_dict")
        allowed = set(req.schema_hint.keys())
        clean = {k: v for k, v in data.items() if k in allowed and v is not None}
        return {"normalized": clean}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"normalize_error: {e}")

@app.post("/llm/explain")
def explain(req: ExplainIn):
    try:
        # 1) Build whitelist of allowed numbers from trace
        nums = list(_iter_numbers(req.trace))
        allowed_strings = _format_allowed(nums)
        allowed_floats = {float(s) for s in allowed_strings}

        # 2) Ask the model with explicit allowed numbers
        prompt = EXPLAIN_PROMPT.format(
            teacher_id=req.teacher_id,
            allowed_numbers=json.dumps(allowed_strings, ensure_ascii=False),
            trace_json=json.dumps(req.trace, ensure_ascii=False),
        )
        data = llm_structured(prompt)
        exp = data.get("explanation", "")
        if not exp or not isinstance(exp, str):
            raise ValueError("explain_missing")

        # 3) Validate numeric mentions with tolerance (±0.005)
        mentioned = _numbers_in_text(exp)
        for v in mentioned:
            if not any(abs(v - a) <= 5e-3 for a in allowed_floats):
                raise ValueError(f"explain_number_not_in_trace: {v}")

        return {"explanation": exp}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"explain_error: {e}")
