---
type: "concept"
name: "Blog Okf 6 Months Ahead"
description: "Auto-generated description for Blog Okf 6 Months Ahead"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# We Built OKF 6 Months Before Google Specced It

**By Abhishek Swami · June 17, 2026**

---

On June 12, 2026, Google published OKF (Open Knowledge Format) v0.1 — a file-system convention for AI-consumable knowledge. It standardizes `index.md`, `log.md`, `type` fields, and cross-linking so that any AI agent can read and navigate a shared knowledge base.

We read the spec and realized something: **we'd already built it.**

Six months before Google's announcement, Neptune Chat had:
- 500+ knowledge files across 196 directories
- YAML frontmatter on every file (type, name, description, version)
- Cross-links as relative markdown references
- A knowledge graph with 444 nodes and 1,000+ edges
- A visualizer with three views: Library, Playbook, Graph

Google validated the pattern. Now we're publishing the superset.

---

## The 10 Innovations Google's Spec Doesn't Have

OKF v0.1 is a great foundation. But production AI agents need more than a static knowledge base. Neptune-Knowledge-Spec (NKS) v1.0 adds 10 innovations:

### 1. Playbook Routing
Domain-specific playbooks that route agent intents to the right skills and connectors. Intent keywords, model preferences, and trigger tools all wired together.

### 2. Agent Skill Definitions
Not just knowledge — executable skills. Each SKILL.md includes tool manifests, MCP configurations, anti-patterns, UI schemas, and co-located code.

### 3. Mission State Machines
Long-running AI tasks tracked with FSM states, artifact chains, progress tracking, and event timelines.

### 4. Cross-Session Memory
Persistent memory references that agents can access across conversations. Memory types: reference, rule, preference, fact, context.

### 5. Connector Specifications
Formal specs for external system integrations. Auto-generates API clients, schemas, and tool manifests from the knowledge files.

### 6. Generative UI Components
Connectors bind React components for displaying results. Channel grids, payment lists, transaction tables — defined in YAML, rendered on demand.

### 7. Workflow Orchestration
Multi-step automation pipelines defined in YAML with cron scheduling, conditional steps, and dependency graphs.

### 8. Self-Coding Capability
Skills that include instructions for the AI to modify its own codebase. Guardrails: max 3 files, max 50 lines, build required, smoke test required.

### 9. Audit Trail
Structured audit records with severity-classified findings and compliance status across standards (GDPR, PCI-DSS, etc.).

### 10. Knowledge Graph Integration
Every file is a node. Every link is an edge. D3 force-directed visualization at `/knowledge`. Semantic search across all files.

---

## Augmenting, Not Competing

We're not competing with OKF. We're augmenting it.

Every NKS file is a valid OKF file. We add fields, never remove or rename. Our export tool strips NKS extensions and produces clean OKF v0.1 bundles. The visualizer works with both.

If you have an OKF knowledge base, upgrading to NKS gives you agent-executable skills, playbook routing, mission tracking, and a knowledge graph. If you have an NKS knowledge base, exporting to OKF gives you industry-standard interoperability.

---

## Production-Grade Reference Implementation

Neptune Chat is the living reference implementation:

- **500+ knowledge files** across 8 knowledge roots
- **187 directory indexes** auto-generated
- **258 typed frontmatter entries** with automatic type detection
- **4 API routes** for files, graph, search, and export
- **3-view visualizer** at `/knowledge`
- **One-command export** to OKF bundles
- **0 build errors** in production

Try it: [neptune-chat-ashy.vercel.app/knowledge](https://neptune-chat-ashy.vercel.app/knowledge)

Read the spec: [NEPTUNE-KNOWLEDGE-SPEC-v1.0.md](https://github.com/abhiswami2121/neptune-chat/blob/main/docs/NEPTUNE-KNOWLEDGE-SPEC-v1.0.md)

---

## What's Next

- **Twenty CRM integration** — Twenty custom objects as OKF concepts
- **V2 coding agent** — Reads playbooks before generating code
- **Automated drift detection** — Nightly checks for broken links and stale references
- **Public spec site** — docs.neptune-spec.ai

---

*Neptune-Knowledge-Spec v1.0. MIT License.*  
*Built 6 months ahead of Google's spec. Augmenting, not competing.*  
*github.com/abhiswami2121/neptune-chat*
