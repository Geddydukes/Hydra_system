import os
import json
import time
from typing import Dict, Any, Optional, Tuple
import httpx

PROVIDER = os.getenv("LLM_PROVIDER", "MOCK").upper()            # MOCK|OPENAI|ANTHROPIC|GOOGLE
API_KEY = os.getenv("LLM_API_KEY", "")
TIMEOUT_S = float(os.getenv("LLM_TIMEOUT_S", "15"))
MAX_RETRIES = int(os.getenv("LLM_MAX_RETRIES", "2"))

# ---- helpers ----
def _retry_call(fn, *args, **kwargs):
    delay = 0.75
    last = None
    for i in range(MAX_RETRIES + 1):
        try:
            return fn(*args, **kwargs)
        except Exception as e:
            last = e
            if i == MAX_RETRIES:
                break
            time.sleep(delay)
            delay *= 2
    raise last

def _truncate(s: str, max_chars: int = 6000) -> str:
    return s if len(s) <= max_chars else s[:max_chars]

def _extract_json(text: str) -> Dict[str, Any]:
    """
    Strict JSON extraction: find first `{ ... }` block and parse.
    Raises if not found or invalid.
    """
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("no_json_found")
    blob = text[start:end+1]
    return json.loads(blob)

# ---- provider adapters ----
def _complete_openai(prompt: str) -> str:
    # Compatible with OpenAI responses (responses API). Use httpx for portability.
    base = os.getenv("OPENAI_BASE", "https://api.openai.com/v1")
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    headers = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}
    payload = {
        "model": model,
        "input": [{"role": "user", "content": prompt}],
    }
    with httpx.Client(timeout=TIMEOUT_S) as client:
        r = client.post(f"{base}/responses", headers=headers, json=payload)
        r.raise_for_status()
        data = r.json()
        # Extract first text result (simple)
        for item in data.get("output", []):
            if item.get("type") == "output_text":
                return item.get("text", "")
        # fallback
        return data.get("output_text", "") or json.dumps(data)

def _complete_anthropic(prompt: str) -> str:
    base = os.getenv("ANTHROPIC_BASE", "https://api.anthropic.com/v1/messages")
    model = os.getenv("ANTHROPIC_MODEL", "claude-3-5-haiku-latest")
    headers = {
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    payload = {"model": model, "max_tokens": 800, "messages": [{"role":"user","content":prompt}]}
    with httpx.Client(timeout=TIMEOUT_S) as client:
        r = client.post(base, headers=headers, json=payload)
        r.raise_for_status()
        data = r.json()
        parts = data.get("content", [])
        if parts and isinstance(parts, list) and "text" in parts[0]:
            return parts[0]["text"]
        return json.dumps(data)

def _complete_google(prompt: str) -> str:
    base = os.getenv("GOOGLE_BASE", "https://generativelanguage.googleapis.com/v1beta/models")
    model = os.getenv("GOOGLE_MODEL", "gemini-1.5-flash")
    key = os.getenv("GOOGLE_API_KEY", API_KEY)
    url = f"{base}/{model}:generateContent?key={key}"
    payload = {"contents":[{"parts":[{"text":prompt}]}]}
    with httpx.Client(timeout=TIMEOUT_S) as client:
        r = client.post(url, json=payload)
        r.raise_for_status()
        data = r.json()
        return data.get("candidates",[{}])[0].get("content",{}).get("parts",[{}])[0].get("text","")

def _complete_mock(prompt: str) -> str:
    # safe deterministic stub for tests
    if '"mode":"normalize"' in prompt:
        return '{"noi":120000,"annual_debt_service":100000}'
    if '"mode":"explain"' in prompt:
        return '{"explanation":"The loan fails because DSCR 1.14 < 1.20."}'
    return '{"note":"mock_response"}'

# ---- public ----
def llm_complete(prompt: str) -> str:
    prompt = _truncate(prompt)
    if PROVIDER == "OPENAI":
        return _retry_call(_complete_openai, prompt)
    if PROVIDER == "ANTHROPIC":
        return _retry_call(_complete_anthropic, prompt)
    if PROVIDER == "GOOGLE":
        return _retry_call(_complete_google, prompt)
    return _complete_mock(prompt)  # default mock

def llm_structured(prompt: str) -> Dict[str, Any]:
    text = llm_complete(prompt)
    return _extract_json(text)
