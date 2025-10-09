# Hydra — Technical Specification

## 1. Overview

This document defines the **technical interfaces, data schemas, algorithms, and validation standards** for Hydra. It serves as a reference for implementation, ensuring that components remain modular and interoperable. The focus is on clear data contracts, deterministic execution, and minimal assumptions between components.

---

## 2. Core APIs / Interfaces

### 2.1 Router Interface

**Input**

```json
{
  "query": "Does this loan meet policy?",
  "metadata": {
    "jurisdiction": "CA",
    "timestamp": "2025-10-08T18:22:00Z",
    "user_role": "analyst"
  }
}
Output

json
Copy code
{
  "routing_decision": "symbolic",
  "teacher_id": "loan_dscr_v1",
  "normalized_input": {
    "noi": 120000,
    "annual_debt_service": 100000
  }
}
If no teacher matches, routing_decision = "create_teacher" and the payload is forwarded to SELLM.

2.2 Teacher Interface
Input

json
Copy code
{
  "teacher_id": "loan_dscr_v1",
  "version": "1.0.0",
  "inputs": {
    "noi": 120000,
    "annual_debt_service": 100000
  }
}
Output

json
Copy code
{
  "verdict": "FAIL",
  "outputs": {
    "dscr": 1.14
  },
  "trace": [
    {
      "rule_id": "DSCR_MIN_1_20",
      "passed": false,
      "threshold": 1.20,
      "value": 1.14
    }
  ],
  "effective_version": "1.0.0"
}
Teachers must be deterministic: same inputs → same outputs.

Traces are required for explanation and audit.

2.3 SELLM Interface
Input (Teacher Creation Request)
Generated when router finds no suitable teacher.

json
Copy code
{
  "intent": "calculate_real_estate_transfer_tax",
  "spec_context": {
    "jurisdiction": "CA",
    "input_schema": {
      "sale_price": "number",
      "county": "string"
    }
  }
}
Output (Draft Teacher)
Returned to registry for human review.

json
Copy code
{
  "teacher_spec": { ... },  // see schema below
  "tests": [ ... ],
  "explanation_template": "...",
  "confidence": 0.87,
  "references": ["https://ca.gov/taxrules#section-2.1"]
}
2.4 Watcher / Policy Parser Interface
Input: Raw external doc (text, JSON, PDF metadata).
Output: PolicyChange JSON.

json
Copy code
{
  "id": "CA-AB1234-2025-10-01",
  "jurisdiction": "CA",
  "changes": [
    {
      "param": "commission_max_pct",
      "old": 0.06,
      "new": 0.05,
      "effective_date": "2025-11-01",
      "citations": ["§12.4(b)"]
    }
  ],
  "confidence": 0.91,
  "sources": ["https://leginfo.legislature.ca.gov/..."]
}
2.5 Patch Application Interface
Input

json
Copy code
{
  "teacher_id": "real_estate_commission_v3",
  "patch": [
    {"op": "replace", "path": "/rules/RE_COMM_MAX_PCT/threshold", "value": 0.05}
  ],
  "references": ["CA-AB1234-2025-10-01"]
}
Output

json
Copy code
{
  "new_version": "3.3.0",
  "test_report": {
    "unit_pass": 38,
    "property_pass": 12,
    "regression_changed": 7,
    "regression_total": 140
  }
}
3. Data Schemas
3.1 TeacherSpec (DSL)
json
Copy code
{
  "teacher_id": "loan_dscr_v1",
  "domain": "underwriting",
  "type": "rules",
  "inputs_schema": {
    "noi": {"type":"number","units":"USD/yr"},
    "annual_debt_service":{"type":"number","units":"USD/yr"}
  },
  "computed": {
    "dscr": "noi / annual_debt_service"
  },
  "rules": [
    {"id":"DSCR_MIN_1_20","expr":"dscr >= 1.20","severity":"fail"}
  ],
  "explanation_fields":["dscr","DSCR_MIN_1_20.threshold"],
  "jurisdictions":["US","CA"],
  "effective_date":"2025-01-01"
}
3.2 Trace Schema
json
Copy code
[
  {
    "rule_id": "DSCR_MIN_1_20",
    "passed": false,
    "threshold": 1.20,
    "value": 1.14,
    "explanation": "Debt service coverage ratio is below required minimum."
  }
]
3.3 PolicyChange Schema
(See Watcher interface above.)
Key fields: changes[].param, old, new, citations, effective_date.

3.4 TeacherPatch Schema
(See Patch Application interface above.)
Uses JSON-Patch semantics (RFC 6902) for minimal diffs.

3.5 TrainingTuple Schema
json
Copy code
{
  "input_text": "Does this loan meet DSCR policy?",
  "normalized_inputs": {"noi": 120000,"annual_debt_service": 100000},
  "teacher_id": "loan_dscr_v1",
  "teacher_version": "1.0.0",
  "symbolic_output": {
    "verdict": "FAIL",
    "outputs": {"dscr": 1.14},
    "trace": [...]
  },
  "llm_output": "...",
  "explanation_output": "This loan fails because the DSCR of 1.14 is below 1.20.",
  "label_type": "positive",
  "approved_for_training": true
}
4. Key Algorithms & Pseudocode
4.1 Router Selection
python
Copy code
def route(query, metadata):
    intent = classify_intent(query)
    teacher = match_teacher(intent, metadata)
    if teacher:
        return {"routing_decision": "symbolic", "teacher_id": teacher.id}
    elif is_symbolic_candidate(intent):
        return {"routing_decision": "create_teacher", "spec": extract_spec(query)}
    else:
        return {"routing_decision": "llm"}
4.2 SELLM Creation Loop
python
Copy code
def create_teacher(spec):
    # Generate draft DSL
    draft = LLM.generate_teacher(spec, rag_context=True)
    # Run property/unit tests
    report = run_tests(draft)
    if report.pass_rate < MIN_THRESHOLD:
        draft = LLM.repair_teacher(draft, report.failures)
    # Return for human review
    return draft
4.3 Auto-Update Patch Flow
python
Copy code
def apply_policy_change(policy_change):
    affected_teachers = map_params_to_teachers(policy_change)
    patches = []
    for t in affected_teachers:
        patch = SELLM.generate_patch(t, policy_change)
        report = run_regression_tests(t, patch)
        if report.passed:
            new_version = registry.apply_patch(t.id, patch)
            patches.append((t.id, new_version))
    return patches
5. Validation & Testing Standards
Test Type	Purpose	Requirements
Schema Validation	Ensure input/output structure	Every API boundary
Unit Tests	Validate simple inputs and edge cases	≥ 90% pass
Property Tests	Check domain invariants (e.g., monotonicity)	Mandatory for numeric domains
Counterfactual Tests	Ensure explanations are faithful	Must produce flip examples
Regression Tests	Ensure updates don’t break past behavior	Required for patches
Latency Tests	Ensure teachers stay lightweight	p95 ≤ 50ms typical

6. Error Handling & Edge Cases
Unknown intent: Router falls back to LLM or triggers SELLM creation flow.

Teacher execution error: Return structured error; fallback to hybrid if allowed.

Patch failure: Roll back to previous version; log error; notify reviewer.

Version mismatch: If inputs reference outdated teacher version, resolve via registry or reject request.

Ambiguous policy change: Escalate to human without patching.

7. Versioning & Compatibility
All teachers are immutable once published; changes create new semver versions.

Router always uses the latest effective version for a given jurisdiction/domain.

Explanations and training data reference teacher version explicitly.

Policy changes with future effective dates publish patches in @next and shadow mode until active.

```
