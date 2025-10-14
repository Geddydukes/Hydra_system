from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

app = FastAPI(title="Hydra Watchers", version="0.1.0")

class PolicyChange(BaseModel):
    id: str
    jurisdiction: Optional[str] = None
    changes: List[Dict[str, Any]]

@app.get("/health")
def health(): return {"ok": True}

@app.post("/policy_changes")
def policy_changes(pc: PolicyChange):
    affected = []
    for ch in pc.changes:
        param = (ch.get("param") or "").lower()
        if "commission" in param or "dscr" in param:
            affected.append("loan_dscr_v1")
        if "transfer_tax" in param or "rate_pct" in param:
            affected.append("transfer_tax_v1")
    return {"policy_change_id": pc.id, "affected_teachers": sorted(set(affected))}
