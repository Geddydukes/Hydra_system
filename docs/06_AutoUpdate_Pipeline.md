# Hydra — Auto-Update Pipeline Specification

## 1. Overview

The **Auto-Update Pipeline** enables Hydra to **track, interpret, and integrate changes in external rules, policies, schemas, and laws** into its symbolic teacher library.

Instead of relying on periodic retraining cycles or manual developer updates, Hydra maintains **live watchers** on authoritative sources. When a change is detected, it is parsed into a structured **PolicyChange**, mapped to affected teachers, patched via SELLM, tested, and reviewed.

This allows Hydra to stay **continuously aligned with real-world regulatory and data shifts**, which is especially critical in domains like real estate, finance, or tax.

---

## 2. Architectural Context

The Auto-Update Pipeline sits **below SELLM and the Teacher Registry**, acting as a trigger for patch generation and versioning:

┌────────────────────────────┐
│ External Sources │
│ (Laws, APIs, Docs, Schemas)│
└───────────┬────────────────┘
│
┌───────▼────────┐
│ Watchers │ (ingest + normalize)
└───────┬────────┘
▼
┌───────┴────────┐
│ Policy Parser │ (diff + extraction)
└───────┬────────┘
▼
┌───────┴───────────┐
│ Impact Analyzer │ (map → teachers)
└───────┬───────────┘
▼
┌───────┴───────────┐
│ SELLM Patch Mode │
└───────┬───────────┘
▼
┌───────┴────────────┐
│ Test Harness │ (unit + property + counterfactual + regression)
└───────┬────────────┘
▼
┌───────┴────────────┐
│ Human Review & Pub │
└────────────────────┘

swift
Copy code

---

## 3. Watchers

Watchers are responsible for **monitoring authoritative external sources** for changes. Each watcher is configured with:

| Field         | Description                                             |
| ------------- | ------------------------------------------------------- |
| `id`          | Unique watcher name (e.g., `ca_legislation`)            |
| `source_type` | `rss`, `http_poll`, `email_inbox`, `api`, `git_webhook` |
| `frequency`   | Polling or check frequency (e.g., daily)                |
| `normalizer`  | Function to extract structured metadata and content     |

### 3.1 Example: California Legislation Watcher

```json
{
  "id": "ca_legislation",
  "source_type": "rss",
  "url": "https://leginfo.legislature.ca.gov/rss/bills.xml",
  "frequency": "daily",
  "normalizer": "parse_bill_text"
}
When a change is detected, the watcher emits a NormalizedDoc:

json
Copy code
{
  "doc_id": "CA-AB1234-2025-10-01",
  "jurisdiction": "CA",
  "doc_type": "statute",
  "effective_date": "2025-11-01",
  "content": "... raw bill text ...",
  "metadata": {"source":"https://leginfo.legislature.ca.gov/","title":"AB 1234"}
}
4. Policy Parser
The Policy Parser converts raw normalized documents into structured PolicyChange objects via semantic diffing and LLM-assisted extraction.

4.1 PolicyChange Schema
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
4.2 Diffing Methods
Structural diff for machine-readable sources (JSON, CSV, API schemas).

Semantic diff for text/PDF (LLM identifies parameter changes, thresholds, scope, effective dates).

Confidence scores used to determine review priority.

5. Impact Analyzer
The Impact Analyzer maps each PolicyChange.changes[*].param to one or more teachers using a maintained TeacherMap:

json
Copy code
{
  "commission_max_pct": [
    "real_estate_commission_v3",
    "net_proceeds_calc_v2"
  ]
}
For each affected teacher:

Determines whether a threshold update, rule addition, or constraint modification is required.

Collects historical usage data to estimate blast radius (e.g., % of queries affected, jurisdictions).

6. SELLM Patch Mode
For each affected teacher, SELLM is invoked in patch mode, receiving the teacher spec and the relevant PolicyChange:

json
Copy code
{
  "teacher_id": "real_estate_commission_v3",
  "policy_change": {
    "param": "commission_max_pct",
    "old": 0.06,
    "new": 0.05,
    "citations": ["§12.4(b)"]
  }
}
SELLM generates a JSON patch using RFC 6902 operations:

json
Copy code
[
  {"op":"replace","path":"/rules/RE_COMM_MAX_PCT/threshold","value":0.05}
]
It then runs counterfactual tests to verify that:

Inputs that passed under old rules now fail appropriately.

Inputs outside the change scope remain unchanged.

7. Testing Harness
Before publishing, every patch must pass through a rigorous harness:

Test Type	Purpose
Unit	Verify patched rules behave correctly on edge cases
Property	Ensure domain invariants still hold
Regression	Confirm old behavior unchanged outside change scope
Counterfactual	Verify changes flip verdicts in expected scenarios

Example regression report:

json
Copy code
{
  "unit_pass": 40,
  "property_pass": 12,
  "regression_changed": 7,
  "regression_total": 140
}
8. Human Review & Publication
After tests pass, a Change Report is generated for human reviewers:

json
Copy code
{
  "policy_change_id": "CA-AB1234-2025-10-01",
  "teacher_id": "real_estate_commission_v3",
  "old_version": "3.2.0",
  "proposed_version": "3.3.0",
  "summary": "Commission cap lowered from 6% → 5% (CA, residential). Effective 2025-11-01.",
  "citations": ["§12.4(b)"],
  "counterfactual_examples": [
    {"case":"$500k sale","old_verdict":"PASS@6%","new_verdict":"FAIL@5%"}
  ],
  "blast_radius": "7/140 regression cases flipped",
  "confidence": 0.93
}
Review Outcomes:
✅ Approve → Patch applied; new teacher version published.

🕓 Defer → Scheduled for future effective date.

❌ Reject → Returned to SELLM with feedback.

Router updates its routing table to use the new version automatically on the effective date.

9. Algorithms (Pseudocode)
9.1 Watcher Loop
python
Copy code
for watcher in watchers:
    doc = watcher.check()
    if doc and not registry.has_doc(doc.doc_id):
        policy_changes = parse_policy(doc)
        for change in policy_changes:
            process_policy_change(change)
9.2 Policy Change Processing
python
Copy code
def process_policy_change(change):
    affected_teachers = map_params_to_teachers(change)
    for teacher in affected_teachers:
        patch = SELLM.generate_patch(teacher, change)
        report = run_test_harness(teacher, patch)
        if report.all_passed:
            submit_for_review(teacher, change, patch, report)
10. Data Retention & Auditing
All NormalizedDocs, PolicyChanges, patches, test reports, and Change Reports are versioned and archived.

Each patch references exact document IDs and citations.

Regression test sets are stored for future diffs.

Every reviewer action is logged.

11. Extensibility
The Auto-Update Pipeline is modular:

Add new Watcher types (e.g., SEC filings, MLS schema diffs, tax tables).

Plug in new parsers for domain-specific change types (e.g., actuarial tables).

Support shadow mode: run patched teachers side-by-side before activation.

Configure jurisdiction-specific review workflows (e.g., legal review for CA).

12. Summary
The Auto-Update Pipeline ensures that Hydra’s symbolic reasoning remains synchronized with the external world.

By combining structured watchers, semantic policy parsing, targeted patch generation, rigorous testing, and human governance, Hydra can update symbolic teachers within hours of real-world changes—far faster and more reliably than retraining monolithic models.
```
