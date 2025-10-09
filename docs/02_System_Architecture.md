# Hydra — System Architecture

## 1. Overview

Hydra is composed of several cooperating subsystems that together create a **self-expanding neuro-symbolic reasoning network**. At its core is a **Router** that directs incoming queries to the appropriate reasoning strategy: existing symbolic teachers, general LLM reasoning, or a hybrid of both. A **Symbolic Engineer LLM (SELLM)** generates new symbolic modules on demand, while a **Watcher + Policy Parser** pipeline keeps the system aligned with external regulatory and data changes. All symbolic teachers are versioned, tested, and stored in a central registry, and their outputs feed into a post-training pipeline to align general LLMs.

---

## 2. High-Level Architecture Diagram

    ┌────────────────────────┐
    │      External Inputs   │
    │ (user queries, API req)│
    └────────────┬───────────┘
                 │
        ┌────────▼─────────┐
        │     Router       │
        └───────┬──────────┘
                │
    ┌───────────┼────────────────────────┐
    │           │                        │

┌───▼───────┐ ┌─▼─────────────┐ ┌────────▼─────────┐
│ Symbolic │ │ General LLM │ │ Hybrid/Arbiter │
│ Teachers │ │ Reasoning │ │ (Parallel) │
└───┬───────┘ └─┬─────────────┘ └────────┬─────────┘
│ │ │
└─────┬─────┴────────────────────────┘
│
┌────────▼─────────┐
│ Explanation │ (LLM → lay summaries)
└────────┬─────────┘
│
┌────────▼──────────┐
│ Logging & Training│ (SFT / DPO / RL)
└────────┬──────────┘
│
┌────────▼─────────────────┐
│ Teacher Registry & Store │ (versioned rules, tests, metadata)
└────────┬─────────────────┘
│
┌────────▼─────────────┐
│ SELLM (Engineer LLM) │ (Create/Refine/Store)
└────────┬─────────────┘
│
┌────────▼───────────────┐
│ Watchers + Policy Parse│ (External laws, schemas, APIs)
└────────────────────────┘

---

## 3. Component Descriptions

### 3.1 Router

- **Role:** Entry point for all queries. Classifies intent, risk level, and determines reasoning path: symbolic, neural, or hybrid.
- **Inputs:** Raw user query or API request, metadata (jurisdiction, timestamp).
- **Outputs:** Routed query to Teacher Shelf / LLM / Arbiter; routing decision logs.
- **Key responsibilities:**
  - Intent classification (cheap LLM + regex + embeddings).
  - Task → Teacher mapping.
  - Handling unknown intents by delegating to SELLM creation flow.

---

### 3.2 Teacher Shelf

- **Role:** Library of lightweight, domain-specific symbolic AI modules (rules engines, solvers, query templates).
- **Inputs:** Normalized inputs from router.
- **Outputs:** Deterministic results + structured explanation traces (rule IDs, thresholds, intermediate calculations).
- **Key features:**
  - Each teacher versioned and schema-validated.
  - Tests (unit, property, counterfactual) stored alongside code.
  - Fast, deterministic execution.

---

### 3.3 General LLM Reasoning

- **Role:** Provide flexible language understanding, drafting, or reasoning when no suitable symbolic module exists.
- **Inputs:** User query + relevant context.
- **Outputs:** Unstructured or structured answers.
- **Key features:**
  - Can generate SQL/logic forms when appropriate.
  - Used for explanations, translation, fallback reasoning.

---

### 3.4 Hybrid / Arbiter

- **Role:** Run **symbolic** and **LLM** reasoning in parallel, then arbitrate based on validation.
- **Inputs:** Same normalized input to both engines.
- **Outputs:** Final result + structured provenance (which system produced what).
- **Key features:**
  - Symbolic output treated as authoritative if validated.
  - If mismatch, may escalate to human or log for retraining.

---

### 3.5 Explanation Layer

- **Role:** Translate symbolic traces into faithful, human-readable explanations.
- **Inputs:** Symbolic trace JSON.
- **Outputs:** Plain-language summaries + counterfactuals (e.g., “To pass, NOI must be ≥ X”).
- **Key features:**
  - Number whitelist enforcement.
  - Cites rule IDs and sources.
  - Generates multiple audience styles (non-expert, analyst, legal).

---

### 3.6 Logging & Training Pipeline

- **Role:** Capture all routing decisions, symbolic outputs, explanations, and LLM outputs for post-training.
- **Inputs:** Full inference records.
- **Outputs:** Clean SFT/DPO/RL tuples for improving model alignment.
- **Key features:**
  - Automatic labeling from teachers.
  - Version-aware data storage (teacher@version).
  - Supports offline evaluation dashboards.

---

### 3.7 Teacher Registry & Storage

- **Role:** Central store for all symbolic systems and their metadata.
- **Contents:** Spec DSL, code, tests, explanations, provenance, policy mappings, versions.
- **Key features:**
  - Immutable versioning with semver.
  - Diff history + patch storage.
  - Effective dates and jurisdictional tags.

---

### 3.8 SELLM (Symbolic Engineer LLM)

- **Role:** Autonomous system for creating, testing, refining, and registering new teachers.
- **Inputs:** Normalized specs or router “no teacher found” events; RAG corpus.
- **Outputs:** Draft teacher (DSL + code + tests), ready for human review.
- **Key features:**
  - Generates minimal symbolic systems for narrow domains.
  - Runs internal property tests before submission.
  - Supports patch generation for updates.

---

### 3.9 Watchers + Policy Parser

- **Role:** Continuously ingest and parse external changes (laws, schemas, fee tables) that affect symbolic rules.
- **Inputs:** Regulatory feeds, APIs, documents.
- **Outputs:** PolicyChange JSON, TeacherPatch proposals.
- **Key features:**
  - Structural + semantic diffing.
  - Policy mapping to affected teachers.
  - Counterfactual test generation for changes.

---

## 4. Data Flow Scenarios

### A. Routing to Existing Teacher

1. User submits query.
2. Router classifies intent → matches to an existing teacher.
3. Teacher runs deterministically → returns verdict + trace.
4. LLM explanation layer translates trace to user-facing language.
5. Logs stored; if hybrid mode, LLM output also logged for alignment.

---

### B. Auto-Generation of New Teacher

1. User submits query; Router finds no matching teacher.
2. Router passes structured spec to SELLM.
3. SELLM drafts a new teacher (DSL + code + tests).
4. Human reviews proposed teacher; if approved:
   - Teacher is stored in the registry and versioned.
   - Router updates routing table to use it immediately for future queries.
5. Logs from new teacher use feed into training pipeline.

---

### C. External Policy Change Patch

1. Watcher detects regulatory/document change.
2. Policy Parser extracts parameters & clauses → maps to affected teachers.
3. SELLM proposes patch + counterfactual tests.
4. Human reviews via Change Report.
5. Approved patch version published; router automatically respects new version.
6. Training pipeline logs tuples for DPO/RL to teach model new behavior.

---

## 5. Data Storage & Versioning

- **Registry Database (SQL)** for metadata, teacher specs, version graphs, mappings.
- **Object Store** for teacher code, tests, raw external docs, policy change artifacts.
- **Versioning** via semantic versioning (MAJOR.MINOR.PATCH) and effective dates.
- **Audit trail** preserved for every change, including diffs and citations.

---

## 6. Scaling, Security, and Extensibility

- **Scaling**

  - Router stateless; horizontally scalable behind a load balancer.
  - Teachers are lightweight; many can run in-memory or serverless.
  - Auto-sharding Teacher Shelf by domain or jurisdiction.

- **Security**

  - Strict schema validation at all interfaces.
  - Number whitelisting for explanations.
  - No untrusted code execution—SELLM outputs are sandboxed and reviewed.

- **Extensibility**
  - New teacher types (e.g., simulation engines, graph queries) can be added by extending DSL and router mapping.
  - New external watchers can be plugged in for additional jurisdictions or data sources.
  - SELLM can incorporate new RAG corpora without changing the rest of the system.

---

## 7. Summary

Hydra’s architecture cleanly separates **routing, reasoning, creation, and maintenance**. Symbolic teachers provide deterministic reasoning; SELLM ensures the system grows; Watchers keep it current; and the Router orchestrates everything. This layered design allows Hydra to scale horizontally, evolve dynamically, and maintain a verifiable reasoning core.

---
