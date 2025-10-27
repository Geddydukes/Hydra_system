from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
from .evaluator.rules_engine import evaluate_dscr
from .evaluator.transfer_tax import evaluate_transfer_tax

app = FastAPI(title="Hydra Teachers", version="0.1.0")

@app.middleware("http")
async def log_requests(request, call_next):
    import time
    start = time.time()
    resp = await call_next(request)
    dur = (time.time() - start) * 1000
    print(f"[teachers] {request.method} {request.url.path} {resp.status_code} {dur:.1f}ms")
    return resp

class ExecIn(BaseModel):
    teacher_id: str
    version: Optional[str] = None
    inputs: Dict[str, Any]

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/teachers/execute")
def execute(req: ExecIn):
    # Dispatch by teacher_id (extend this with a registry lookup when multiple teachers exist)
    if req.teacher_id == "loan_dscr_v1":
        try:
            return evaluate_dscr(req.inputs)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"execution_error: {e}")
    if req.teacher_id == "transfer_tax_v1":
        try:
            return evaluate_transfer_tax(req.inputs)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"execution_error: {e}")
    raise HTTPException(status_code=404, detail=f"unknown teacher: {req.teacher_id}")
