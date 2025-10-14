from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime
import uuid

app = FastAPI(title="Hydra Governance", version="0.1.0")

class ReviewItem(BaseModel):
    id: str
    kind: str        # teacher|patch|model
    payload: Dict[str, Any]
    created_at: str
    status: str = "pending"
    rationale: Optional[str] = None

REVIEWS: Dict[str, ReviewItem] = {}

@app.get("/health")
def health(): return {"ok": True}

@app.get("/reviews/pending")
def pending() -> List[ReviewItem]:
    return [r for r in REVIEWS.values() if r.status == "pending"]

@app.post("/reviews/add")
def add(kind: str, payload: Dict[str, Any]):
    rid = str(uuid.uuid4())
    REVIEWS[rid] = ReviewItem(id=rid, kind=kind, payload=payload, created_at=datetime.utcnow().isoformat()+"Z")
    return {"id": rid}

@app.post("/reviews/{rid}/approve")
def approve(rid: str):
    r = REVIEWS.get(rid)
    if not r: raise HTTPException(404)
    r.status = "approved"
    return {"ok": True}

@app.post("/reviews/{rid}/reject")
def reject(rid: str, rationale: Optional[str] = None):
    r = REVIEWS.get(rid)
    if not r: raise HTTPException(404)
    r.status = "rejected"; r.rationale = rationale
    return {"ok": True}
