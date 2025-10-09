# Hydra — SELLM (Symbolic Engineer LLM) Specification

## 1. Overview

The **Symbolic Engineer LLM (SELLM)** is a dedicated large language model instance responsible for the **creation, refinement, and maintenance of symbolic teachers**.  
Where the Router acts as Hydra’s brain, SELLM functions as its **architect and engineer**: automatically designing new reasoning modules when gaps appear and proposing updates when external changes occur.

SELLM is not used for user-facing answers. Instead, it operates **offline or asynchronously**, producing structured, testable outputs that humans or automated validators can approve before deployment.

---

## 2. Responsibilities

| Function               | Description                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| **Teacher Creation**   | Generate minimal symbolic systems (DSL + tests) for previously unsupported tasks         |
| **Teacher Refinement** | Repair failing teachers based on test feedback                                           |
| **Patch Generation**   | Generate minimal JSON patches for existing teachers when policy or schema changes occur  |
| **Test Synthesis**     | Autogenerate unit, property, and counterfactual tests for all proposed teachers          |
| **Source Attribution** | Use RAG to ground outputs in trusted external references                                 |
| **Human Review Prep**  | Package all artifacts into clear, reviewable bundles (diffs, test reports, explanations) |

---

## 3. Invocation Triggers

SELLM can be invoked by three main subsystems:

| Trigger    | Source          | Description                                                    |
| ---------- | --------------- | -------------------------------------------------------------- |
| **Create** | Router          | No teacher exists for intent; SELLM drafts a new one           |
| **Repair** | Teacher Harness | A teacher fails schema or property tests                       |
| **Patch**  | Policy Parser   | External change affects existing teacher; SELLM proposes patch |

---

## 4. Inputs & Outputs

### 4.1 Creation Mode — Input

```json
{
  "intent": "calculate_real_estate_transfer_tax",
  "context": {
    "jurisdiction": "CA",
    "input_schema": {
      "sale_price": "number",
      "county": "string"
    },
    "examples": [
      {"query": "What's the transfer tax on a $1M sale in San Francisco?"},
      {"query": "Transfer tax for $750k in LA County"}
    ]
  }
}
4.2 Creation Mode — Output
json
Copy code
{
  "teacher_spec": { ... },           // Teacher DSL (complete)
  "tests": [ ... ],                  // Unit, property, counterfactual tests
  "explanation_template": "...",
  "references": [
    "https://www.sftreasurer.org/property-transfer-tax",
    "https://leginfo.legislature.ca.gov/"
  ],
  "confidence": 0.86
}
4.3 Patch Mode — Input
json
Copy code
{
  "teacher_id": "real_estate_commission_v3",
  "policy_change": {
    "param": "commission_max_pct",
    "old": 0.06,
    "new": 0.05,
    "citations": ["§12.4(b)"],
    "effective_date": "2025-11-01"
  }
}
4.4 Patch Mode — Output
json
Copy code
{
  "teacher_id": "real_estate_commission_v3",
  "patch": [
    {"op":"replace","path":"/rules/RE_COMM_MAX_PCT/threshold","value":0.05}
  ],
  "test_report": {
    "unit_pass": 40,
    "property_pass": 12,
    "regression_changed": 7,
    "regression_total": 140
  },
  "references": ["CA-AB1234-2025-10-01"],
  "confidence": 0.93
}
5. RAG Strategy
SELLM uses Retrieval-Augmented Generation (RAG) to ground its outputs in authoritative symbolic knowledge.

5.1 Indexed Sources
Canonical OSS repositories: OR-Tools examples, Drools rulesets, SWI-Prolog cookbooks, Cypher/SPARQL templates, SQL best practices.

Official regulatory sites: state legislation portals, IRS, HUD, municipal finance.

Internal teacher registry: previously approved teachers and patches.

Reference textbooks / structured handbooks (e.g., engineering or tax manuals).

5.2 Retrieval Method
Hybrid embedding + keyword search (BM25 + dense retrieval).

Each chunk indexed with provenance metadata: URL, license, jurisdiction, doc type.

Retrieved chunks included in SELLM prompt context.

5.3 Licensing & Attribution
Every generated teacher must list references in metadata.

SELLM must avoid copying licensed text directly; only structure and thresholds should be extracted.

6. Prompt Templates
6.1 Create Teacher Prompt (simplified)
less
Copy code
You are a Symbolic AI Engineer. Given a task and context, produce:
1. A minimal deterministic TeacherSpec (JSON DSL).
2. Unit, property, and counterfactual tests.
3. A short explanation template.
4. A list of authoritative references.
Ensure:
- Deterministic logic
- Complete input schema
- No hallucinated values
- Cite all sources
6.2 Repair Teacher Prompt
bash
Copy code
You are repairing a failing symbolic teacher. Given the teacher spec and failing test cases, generate a minimal corrected spec that passes all tests while preserving original logic where possible.
6.3 Patch Teacher Prompt
css
Copy code
You are applying a policy change to a symbolic teacher. Generate a minimal JSON patch (RFC 6902) that adjusts only the necessary rules or thresholds. Run counterfactual tests to confirm that cases flip appropriately.
7. Internal Validation Loop
Before SELLM submits outputs for human review, it must run a local validation harness:

python
Copy code
def validate_teacher(draft):
    schema_ok = validate_schema(draft)
    unit = run_unit_tests(draft)
    props = run_property_tests(draft)
    cf = generate_and_run_counterfactuals(draft)
    if schema_ok and unit.pass_rate >= 0.9 and props.all_passed:
        return True
    return False
Failing drafts are automatically sent to repair mode before submission.

Counterfactual generation is mandatory for rules teachers.

8. Human Review Artifacts
SELLM packages its outputs into a review bundle:

json
Copy code
{
  "teacher_id": "loan_dscr_v1",
  "proposed_version": "1.0.0",
  "diff": "...",
  "tests_summary": {"unit":10,"property":2,"counterfactual":3},
  "explanations_sample": "This loan fails because DSCR is below 1.20",
  "references": ["Internal policy manual §3.2"],
  "confidence": 0.91
}
Reviewers can approve, reject, or edit. Upon approval, the teacher is published to the registry and the router is updated.

9. Governance Hooks
Minimum test coverage before submission (≥ 10 unit, ≥ 1 property, ≥ 1 counterfactual).

Confidence threshold for auto-escalation (e.g., < 0.7 confidence triggers mandatory SME review).

Explicit versioning: SELLM must propose a semver bump.

Traceability: all RAG citations must be included in metadata.

Sandboxing: no generated code runs in production until approved.

10. Example Flow: Teacher Creation
Router encounters unsupported intent: calculate_transfer_tax.

Router emits spec to SELLM.

SELLM retrieves CA tax rules + similar teachers.

SELLM generates draft teacher + tests + explanation.

Local validation runs. Passes.

Bundle sent to human reviewer.

Reviewer approves. Teacher published as ca_transfer_tax_v1.

Router immediately uses it for future queries.

Logs feed training pipeline.

11. Example Flow: Policy Patch
Watcher detects law change: 6% → 5% commission cap.

Policy Parser maps commission_max_pct to teacher real_estate_commission_v3.

SELLM generates JSON patch to lower threshold.

Regression + counterfactual tests run. Pass.

Reviewer approves. New version published (v3.3.0).

Router adopts new version automatically on effective date.

12. Summary
SELLM gives Hydra the ability to grow, adapt, and self-maintain without constant human authoring. By combining structured generation, RAG grounding, internal testing, and human-in-the-loop governance, SELLM turns symbolic AI development into a repeatable, scalable process.

```
