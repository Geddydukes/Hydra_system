# Hydra — Teacher Specification Template

## 1. Overview

Symbolic **Teachers** are the core deterministic reasoning modules in Hydra.  
Each teacher is a lightweight, self-contained component that:

- Accepts **structured inputs** from the Router,
- Runs a **deterministic ruleset / solver / query**,
- Returns a **verdict**, structured outputs, and a **trace** for explanation,
- Is **versioned**, **schema-validated**, and covered by unit, property, and counterfactual tests.

All teachers follow the same **TeacherSpec DSL** to ensure consistency across domains.

---

## 2. Required Fields

| Field                   | Type              | Description                                                       |
| ----------------------- | ----------------- | ----------------------------------------------------------------- |
| `teacher_id`            | string            | Unique identifier (e.g., `loan_dscr_v1`)                          |
| `domain`                | string            | Domain or task category (`underwriting`, `tax`, `planning`, etc.) |
| `type`                  | enum              | One of: `rules`, `solver`, `query`                                |
| `inputs_schema`         | object            | JSON Schema for input fields, with units where applicable         |
| `computed`              | object            | Named intermediate calculations                                   |
| `rules` / `constraints` | array             | Core logic: boolean expressions or solver constraints             |
| `explanation_fields`    | array             | Values that should appear in human explanations                   |
| `jurisdictions`         | array             | Applicable regions (e.g., `["US","CA"]`)                          |
| `effective_date`        | string            | ISO 8601 date when this version becomes active                    |
| `metadata`              | object (optional) | Freeform extra fields (e.g., tags, authorship, source)            |

---

## 3. Example: **Rules Teacher**

```json
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
  "jurisdictions":["US"],
  "effective_date":"2025-01-01",
  "metadata":{"source":"Internal policy manual §3.2"}
}
4. Example: Solver Teacher
Solver teachers use OR-Tools or equivalent to solve constraint problems (e.g., scheduling).

json
Copy code
{
  "teacher_id": "shift_scheduling_v1",
  "domain": "staffing",
  "type": "solver",
  "inputs_schema": {
    "employees": {"type":"array"},
    "shifts": {"type":"array"},
    "availability": {"type":"object"}
  },
  "constraints": [
    {"id":"COVERAGE","description":"Every shift must be covered by at least one employee"},
    {"id":"MAX_HOURS","description":"No employee can exceed max_hours"}
  ],
  "objective":"minimize total_overtime_hours",
  "explanation_fields":["objective_value","violated_constraints"],
  "jurisdictions":["US"],
  "effective_date":"2025-01-01"
}
5. Trace & Explanation Requirements
Every teacher must produce a trace array alongside its verdict:

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
Traces must be deterministic.

Values must be present for all explanation_fields.

No free-form text from the model—traces are machine-generated.

The Explanation Layer uses these traces to produce natural-language explanations for end users and training data.

6. Testing Template
Every teacher must ship with three categories of tests:

Unit Tests
Check common and boundary cases.

Example: DSCR = 1.20 should PASS; DSCR = 1.19 should FAIL.

json
Copy code
[
  {"inputs":{"noi":120000,"annual_debt_service":100000},"expect":{"verdict":"PASS"}},
  {"inputs":{"noi":119000,"annual_debt_service":100000},"expect":{"verdict":"FAIL"}}
]
Property Tests
Assert domain invariants (e.g., monotonicity, symmetry, conservation laws).

Example: increasing NOI should not lower DSCR.

json
Copy code
[
  {"property":"monotonic_noi","assert":"if noi↑ then dscr↑"}
]
Counterfactual Tests
Automatically generated cases that flip the verdict with minimal input changes.

Used to validate explanations and for training LLMs to explain accurately.

json
Copy code
[
  {
    "inputs":{"noi":114000,"annual_debt_service":100000},
    "expected_flip":{"noi":120000}
  }
]
7. Versioning Guidelines
Each teacher version is immutable once published.

Use semantic versioning:

MAJOR — breaking schema or logic changes.

MINOR — new rules, extended jurisdiction.

PATCH — non-breaking bug fixes or policy threshold adjustments.

Router always uses the latest effective version per domain/jurisdiction.

8. Naming Conventions
teacher_id: lowercase, snake_case, domain_task_vX (e.g., loan_dscr_v1).

Rule IDs: UPPERCASE with underscores (e.g., DSCR_MIN_1_20).

Files stored in registry under <domain>/<teacher_id>@<version>.json.

Tests in <domain>/tests/<teacher_id>@<version>_tests.json.

9. Minimum Requirements Checklist
✅ JSON schema defined for inputs
✅ Deterministic computation logic
✅ Trace with rule IDs, thresholds, values
✅ Unit, property, and counterfactual tests
✅ Jurisdiction & effective date set
✅ Version number assigned
✅ Human-readable source metadata

10. Example File Layout
graphql
Copy code
registry/
  underwriting/
    loan_dscr_v1@1.0.0.json
    tests/
      loan_dscr_v1@1.0.0_tests.json
  staffing/
    shift_scheduling_v1@1.0.0.json
    tests/
      shift_scheduling_v1@1.0.0_tests.json
11. Notes for SELLM
When SELLM generates a teacher:

It must fill all required fields in the template.

It should cite sources in metadata.source.

It should generate at least 10 unit tests, 1–2 property tests, and at least one counterfactual.

Human reviewers can reject or edit any field before publishing.

```
