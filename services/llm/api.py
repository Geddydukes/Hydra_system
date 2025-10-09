from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, Any
import json

from .client import llm_structured
from .prompts import NORMALIZE_PROMPT, EXPLAIN_PROMPT

app = FastAPI(title="Hydra LLM", version="0.1.0")

class NormalizeIn(BaseModel):
    teacher_id: str
    schema_hint: Dict[str, Any]
    user_text: str

class ExplainIn(BaseModel):
    teacher_id: str
    trace: Any

@app.get("/health")
def health(): return {"ok": True}

@app.post("/llm/normalize")
def normalize(req: NormalizeIn):
    try:
        prompt = NORMALIZE_PROMPT.format(
            teacher_id=req.teacher_id,
            schema_hint=json.dumps(req.schema_hint, separators=(",",":")),
            user_text=req.user_text.strip()[:4000]
        )
        data = llm_structured(prompt)
        if not isinstance(data, dict):
            raise ValueError("normalize_not_dict")
        # return only keys from schema
        allowed = set(req.schema_hint.keys())
        clean = {k: v for k, v in data.items() if k in allowed and v is not None}
        return {"normalized": clean}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"normalize_error: {e}")

@app.post("/llm/explain")
def explain(req: ExplainIn):
    try:
        prompt = EXPLAIN_PROMPT.format(
            teacher_id=req.teacher_id,
            trace_json=json.dumps(req.trace, ensure_ascii=False)
        )
        data = llm_structured(prompt)
        exp = data.get("explanation", "")
        if not exp or not isinstance(exp, str):
            raise ValueError("explain_missing")
        # number whitelist: must cite values already in trace
        trace_str = json.dumps(req.trace)
        for tok in exp.split():
            # crude safeguard: block unseen numerals
            if any(ch.isdigit() for ch in tok):
                if tok.rstrip(".,") not in trace_str:
                    raise ValueError("explain_number_not_in_trace")
        return {"explanation": exp}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"explain_error: {e}")
