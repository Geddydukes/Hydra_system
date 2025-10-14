import os
import time
import json
from pathlib import Path
import requests as R
from jsonschema import validate

ROUTER = os.getenv("ROUTER_URL", "http://localhost:8000")
TEACHERS = os.getenv("TEACHERS_URL", "http://localhost:8001")
LLM = os.getenv("LLM_URL", "http://localhost:8002")

def wait_health(url, tries=60, delay=0.5):
    for _ in range(tries):
        try:
            r = R.get(f"{url}/health", timeout=1.5)
            if r.ok and r.json().get("ok"):
                return
        except Exception:
            pass
        time.sleep(delay)
    raise RuntimeError(f"service not healthy: {url}")

def test_health():
    wait_health(ROUTER); wait_health(TEACHERS); wait_health(LLM)

def test_registry_schema():
    schema = json.loads(Path("schema/TeacherSpec.schema.json").read_text())
    for p in Path("registry").rglob("*.json"):
        # Skip test bundles in registry/tests subfolders
        if "/tests/" in str(p):
            continue
        spec = json.loads(p.read_text())
        validate(instance=spec, schema=schema)

def test_run_dscr_pass():
    r = R.post(f"{ROUTER}/run", json={"query":"Does this loan meet DSCR? NOI $120,000 and debt service 100k"})
    assert r.ok, r.text
    out = r.json()
    assert out["routing_decision"] == "symbolic"
    assert out["teacher_id"] == "loan_dscr_v1"
    assert abs(out["result"]["outputs"]["dscr"] - 1.2) < 1e-6
    assert out["result"]["verdict"] == "PASS"
    assert isinstance(out.get("explanation",""), str) and len(out["explanation"]) > 0

def test_run_transfer_tax():
    r = R.post(f"{ROUTER}/run", json={"query":"What is transfer tax on $500,000 at 0.5%?"})
    assert r.ok, r.text
    out = r.json()
    assert out["routing_decision"] == "symbolic"
    assert out["teacher_id"] == "transfer_tax_v1"
    tax = out["result"]["outputs"]["transfer_tax"]
    assert abs(tax - 2500.0) < 1e-6
