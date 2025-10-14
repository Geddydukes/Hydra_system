from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import httpx, os

ROUTER = os.getenv("ROUTER_URL", "http://router:8000")

app = FastAPI(title="Hydra Gateway", version="0.1.0")

class RunIn(BaseModel):
    query: str
    metadata: dict | None = None

@app.get("/health")
def health(): return {"ok": True}

@app.post("/run")
def run(req: RunIn):
    try:
        with httpx.Client(timeout=15.0) as client:
            r = client.post(f"{ROUTER}/run", json=req.dict())
            if r.status_code != 200:
                raise HTTPException(status_code=502, detail=r.text)
            return r.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"gateway_error: {e}")
