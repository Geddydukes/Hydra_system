NORMALIZE_PROMPT = """You are a strict JSON extractor.

Output ONLY a JSON object with keys exactly matching the teacher's input schema.
If a value is missing, do NOT guess; omit it. No prose.

{{
 "mode":"normalize",
 "teacher_id":"{teacher_id}"
}}

Input schema keys (types): {schema_hint}

User text:
{user_text}
"""

EXPLAIN_PROMPT = """You are a careful technical writer.

Write a concise, faithful explanation from a symbolic trace.
- Use ONLY numbers and thresholds present in the trace.
- Do not add new facts or advice.
- Keep it under 2 sentences.
Output a JSON object: {{"explanation": "..."}}

{{
 "mode":"explain",
 "teacher_id":"{teacher_id}"
}}

Trace:
{trace_json}
"""
