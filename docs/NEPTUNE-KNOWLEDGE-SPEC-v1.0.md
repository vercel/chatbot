# NEPTUNE KNOWLEDGE SPEC v1.0

**Status:** Published  
**Date:** 2026-06-17  
**Author:** abhiswami2121@gmail.com  
**Repository:** github.com/abhiswami2121/neptune-chat  
**License:** MIT  

> **Neptune-Knowledge-Spec (NKS) v1.0 is the production-grade superset of OKF v0.1.**  
> We built OKF-style knowledge systems 6 months before Google's spec was published.  
> NKS extends OKF with 10 innovations for production AI agent systems.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Relationship to OKF v0.1](#2-relationship-to-okf-v01)
3. [Core Concepts](#3-core-concepts)
4. [Directory Structure](#4-directory-structure)
5. [YAML Frontmatter — Standard Fields](#5-yaml-frontmatter--standard-fields)
6. [Neptune Extension Types — 10 Innovations](#6-neptune-extension-types--10-innovations)
7. [Cross-Linking & Graph Integration](#7-cross-linking--graph-integration)
8. [RBAC & Access Control](#8-rbac--access-control)
9. [Validation & Compliance](#9-validation--compliance)
10. [Migration Guide: OKF ↔ Neptune](#10-migration-guide-okf--neptune)
11. [Reference Implementation](#11-reference-implementation)
12. [Appendix: Reserved Fields](#appendix-reserved-fields)

---

## 1. Introduction

### 1.1 What is Neptune-Knowledge-Spec?

Neptune-Knowledge-Spec (NKS) is a **file-system-based knowledge format** designed for production AI agent systems. It extends OKF v0.1 with the features needed to run a real AI operations platform: playbook routing, agent skill definitions, mission state machines, memory cross-referencing, connector specs, UI component binding, workflow definitions, self-coding instructions, audit trails, and knowledge graph integration.

### 1.2 Why a Superset?

OKF v0.1 defines the foundational layer — `index.md`, `log.md`, `type` fields, relative cross-links. That's an excellent standard for static knowledge bases. But production AI agents need more:

- **Skill definitions** that include tool manifests, MCP configurations, and anti-patterns
- **Playbooks** that route intents to connector skills with model preferences
- **Mission tracking** with state machines and artifact chains
- **Memory references** that persist across agent sessions
- **Connector specifications** that auto-generate API clients
- **UI component bindings** for generative interfaces
- **Workflow orchestration** with multi-step pipelines
- **Self-coding instructions** so agents can improve their own codebase
- **Audit trails** for compliance and debugging
- **Knowledge graph nodes** for semantic relationships

NKS adds these **without breaking OKF compatibility**. Every NKS file is a valid OKF file — we add fields, never remove or rename.

### 1.3 Design Principles

1. **OKF-Compatible First** — Every NKS extension is additive
2. **Filesystem-Native** — No databases required; works with git
3. **YAML Frontmatter** — Machine-parseable metadata at the top of every file
4. **Relative Links** — Cross-references are always relative markdown links
5. **Graph-Ready** — Every file is a graph node; every link is an edge
6. **RBAC-Aware** — Access levels embedded in metadata
7. **Validatable** — TypeScript/Zod schemas for every field

---

## 2. Relationship to OKF v0.1

### 2.1 Compatibility Matrix

| Feature | OKF v0.1 | NKS v1.0 | Notes |
|---------|----------|----------|-------|
| `index.md` per directory | ✅ Required | ✅ Required | Identical |
| `log.md` at top level | ✅ Recommended | ✅ Recommended | NKS adds structured log entries |
| `type` field | ✅ Required | ✅ Required + 10 new values | NKS adds playbook, skill, connector, etc. |
| `name` field | ✅ Required | ✅ Required | Identical |
| `description` field | ✅ Required | ✅ Required | Identical |
| `version` field | ✅ Required | ✅ Required | Identical |
| `updated` field | ✅ Required | ✅ Required | Identical |
| `tags` field | ✅ Optional | ✅ Optional | Identical |
| `links` field | ✅ Optional | ✅ Recommended | NKS encourages cross-links |
| `access` field | ❌ Not specified | ✅ Required | NKS innovation |
| Playbook routing | ❌ | ✅ | NKS innovation |
| Agent skill definitions | ❌ | ✅ | NKS innovation |
| Mission state machines | ❌ | ✅ | NKS innovation |
| Memory references | ❌ | ✅ | NKS innovation |
| Connector specs | ❌ | ✅ | NKS innovation |
| UI component binding | ❌ | ✅ | NKS innovation |
| Self-coding instructions | ❌ | ✅ | NKS innovation |
| Audit trail | ❌ | ✅ | NKS innovation |
| Knowledge graph integration | ❌ | ✅ | NKS innovation |
| Manifest generation | ✅ Optional | ✅ Built-in | Export tool auto-generates |

### 2.2 What OKF Users Get from NKS

If you have an OKF v0.1 knowledge base, upgrading to NKS v1.0 gives you:

1. **Agent-Consumable Skills** — Your knowledge files become executable by AI agents
2. **Playbook Routing** — Intent-based routing to the right skill for any query
3. **Mission Tracking** — Long-running tasks tracked with state machines
4. **Memory Persistence** — Cross-session memory that agents can reference
5. **UI Generation** — Knowledge files can define their own UI components
6. **Graph Navigation** — Semantic KG relationships between all files
7. **RBAC** — Access control embedded in file metadata
8. **Validation** — TypeScript/Zod schemas validate your knowledge base
9. **Export** — One-command OKF bundle generation
10. **Drift Detection** — Automated nightly checks for broken links and stale references

### 2.3 What NKS Users Get from OKF

NKS knowledge bases are 100% OKF-exportable. You get:

- Interoperability with any OKF-compatible tool
- The OKF visualizer for browsing your knowledge base
- Industry-standard format for sharing knowledge bundles
- Future-proofing as OKF evolves

---

## 3. Core Concepts

### 3.1 Knowledge Artifact Types

NKS defines 14 artifact types (OKF defines 4):

| Type | OKF? | Description | Example |
|------|------|-------------|---------|
| `index` | ✅ | Directory overview | `connectors/index.md` |
| `concept` | ✅ | Single knowledge concept | `billing/nmi-charge-flow.md` |
| `prd` | ❌ | Product requirements document | `jarvis/cortex/prd/hermes-ai-computer.md` |
| `spec` | ❌ | Technical specification | `spec/NEPTUNE-KNOWLEDGE-SPEC-v1.0.md` |
| `playbook` | ❌ | Operational workflow guide with routing | `playbooks/billing/playbook-billing.md` |
| `skill` | ❌ | Agent capability with tool definitions | `connectors/nmi/SKILL.md` |
| `connector` | ❌ | External system integration spec | `connectors/nmi/PLAYBOOK.md` |
| `mission` | ❌ | Tracked mission with state machine | `jarvis/cortex/missions/neptune-connector-playbook.md` |
| `research` | ❌ | Research findings | `jarvis/cortex/research/twenty-crm-audit.md` |
| `memory` | ❌ | Persistent cross-session memory | `memory/nmi-vault-sacred.md` |
| `workflow` | ❌ | Multi-step automation pipeline | `workflows/billing-sweep.yaml` |
| `template` | ❌ | Skill author template | `connectors/_template/SKILL.md` |
| `audit` | ❌ | Audit/compliance record | `docs/audit/base44-full-audit.md` |
| `design` | ❌ | Design/architecture document | `jarvis/cortex/design/twenty-crm-architecture.md` |

### 3.2 Domain Model

Knowledge artifacts are organized into **domains** that map to business functions:

```
billing-flow (P0)           credit-disputes (P0)        customer-enrollment (P0)
compliance-audit (P0)       support-triage (P1)         agent-payments (P1)
reporting (P1)              customer-comms (P1)          lead-flow (P2)
mcp-edits (P2)              engineering (P3)             hr (P3)
marketing (P3)              vps-ops (P3)                 planning-research (P3)
```

---

## 4. Directory Structure

### 4.1 Canonical NKS Project Layout

```
<project-root>/
├── index.md                          # Top-level project overview
├── log.md                            # Project-wide change log
├── manifest.yaml                     # Bundle manifest (auto-generated)
│
├── connectors/                       # External system integrations
│   ├── index.md
│   ├── log.md
│   ├── _template/                    # Template for new connectors
│   │   ├── SKILL.md
│   │   ├── PLAYBOOK.md
│   │   ├── manifest.ts
│   │   └── tools/
│   ├── base44/
│   │   ├── index.md
│   │   ├── SKILL.md                  # Skill definition
│   │   ├── PLAYBOOK.md               # Connector playbook
│   │   ├── manifest.ts               # Tool manifest
│   │   ├── schema.ts                 # Zod schemas
│   │   ├── client.ts                 # API client
│   │   ├── docs/                     # Documentation
│   │   ├── tools/                    # Tool implementations
│   │   └── result-renderers/         # UI components for results
│   └── ...
│
├── playbooks/                        # Domain playbooks
│   ├── index.md
│   ├── billing/
│   │   ├── index.md
│   │   ├── playbook-billing.md       # Main playbook
│   │   ├── routines.json             # Agent routines
│   │   ├── skills.json               # Linked skills
│   │   ├── GRAPH-TAG.json            # Knowledge graph tags
│   │   └── workflows/               # Domain workflows
│   └── ...
│
├── skills/                           # Agent capabilities
│   ├── index.md
│   ├── capabilities/                 # Core agent capabilities
│   │   ├── self-coding/SKILL.md
│   │   ├── code-review/SKILL.md
│   │   └── ...
│   ├── connectors/                   # Per-connector skill docs
│   ├── functions/                    # Function-level skills
│   └── skill-author/                 # Meta: skill that creates skills
│
├── shared-skills/                    # Cross-cutting skills
│   ├── code-review/SKILL.md
│   ├── deploy-discipline/SKILL.md
│   └── playbook-refiner/SKILL.md
│
├── workflows/                        # Multi-step automation YAML
│   ├── billing-sweep.yaml
│   ├── customer-360.yaml
│   └── morning-pulse.yaml
│
├── jarvis/cortex/                    # Long-term knowledge store
│   ├── index.md
│   ├── prd/                          # Product requirements
│   ├── research/                     # Research findings
│   ├── missions/                     # Active/completed missions
│   ├── memories/                     # Persistent memories
│   ├── design/                       # Design docs
│   ├── skills/                       # Cortex-level skill docs
│   └── spec/                         # NKS spec itself
│
├── docs/                             # Public documentation
│   ├── OKF-SPEC-v0.1.md
│   ├── NEPTUNE-KNOWLEDGE-SPEC-v1.0.md
│   ├── audit/                        # Audit dossiers
│   └── playbook-architecture/        # Architecture docs
│
└── proofs/                           # Verification proofs
```

### 4.2 File Naming Convention

| Pattern | Example | Purpose |
|---------|---------|---------|
| `SKILL.md` | `connectors/nmi/SKILL.md` | Agent skill definition (UPPERCASE convention) |
| `PLAYBOOK.md` | `connectors/nmi/PLAYBOOK.md` | Connector/domain playbook |
| `index.md` | `connectors/nmi/index.md` | Directory overview |
| `log.md` | `connectors/log.md` | Change log |
| `*.md` | `nmi-charge-flow.md` | Standard knowledge files (kebab-case) |
| `*.yaml` | `workflows/billing-sweep.yaml` | Configuration (YAML) |
| `*.ts` | `connectors/nmi/client.ts` | Code (co-located with knowledge) |

---

## 5. YAML Frontmatter — Standard Fields

### 5.1 Required Fields (all NKS files)

```yaml
---
type: "playbook"                    # NKS artifact type (14 values)
name: "Billing Lifecycle"           # Human-readable name
description: "Complete billing..."  # 1-3 sentence description
version: "1.0.0"                    # Semantic version
updated: "2026-06-17"              # ISO 8601 date
access: "internal"                  # RBAC access level
---
```

### 5.2 Standard Optional Fields

```yaml
---
tags: ["billing", "nmi", "p0"]     # Search tags
domain: "billing-flow"              # Domain classification
author: "abhiswami2121@gmail.com"  # Primary author
status: "stable"                    # draft | review | stable | deprecated | archived
links:                              # Cross-references
  - "../connectors/nmi/SKILL.md"
  - "./nmi-charge-flow.md"
---
```

### 5.3 NKS-Extension Optional Fields

```yaml
---
priority: "P0"                      # P0-P5 (business criticality)
intent_tags: ["refund", "charge"]   # NLP intent routing keywords
model_routing:                      # AI model preferences
  default: "deepseek/deepseek-v4-pro"
  reasoning_heavy: "anthropic/claude-sonnet-4-6"
associated_skills: ["nmi-connector"] # Linked skills
associated_connectors: ["base44"]   # Linked connectors
workflows: ["recovery-campaign"]    # Linked workflows
self_code: true                     # Self-coding enabled?
ui_component: "BillingDashboard"    # Bound UI component
---
```

---

## 6. Neptune Extension Types — 10 Innovations

### Innovation 1: Playbook (`type: playbook`)

**What it is:** A domain-specific operational guide that routes agent intents to the right skills and connectors.

```yaml
---
type: playbook
name: "Billing Operations"
description: "Complete billing lifecycle — charges, declines, refunds, recovery"
version: "1.0.0"
domain: billing-flow
priority: P0
scope: domain
scope_connectors:
  - nmi-connector
  - hyperswitch-connector
  - base44-connector
  - slack-connector
triggers:
  - refund
  - decline
  - charge
  - payment
  - billing
workflows:
  - recovery-campaign
  - lifecycle-automation
model_routing:
  default: "deepseek/deepseek-v4-pro"
  reasoning_heavy: "anthropic/claude-sonnet-4-6"
access: internal
---
```

**NKS Fields Beyond OKF:**
- `scope` — domain, connector, or cross-cutting
- `scope_connectors` — linked connectors available to this playbook
- `triggers` — NLP intent keywords that activate this playbook
- `workflows` — linked automation workflows
- `model_routing` — which AI model to use for different task types

### Innovation 2: Agent Skill (`type: skill`)

**What it is:** A machine-executable agent capability with tool definitions, patterns, anti-patterns, and UI schemas.

Directory structure:
```
connectors/nmi/
├── SKILL.md              # Agent skill definition
├── PLAYBOOK.md            # Human-readable playbook
├── manifest.ts            # Tool manifest (auto-discoverable)
├── schema.ts              # Zod validation schemas
├── client.ts              # API client implementation
├── docs/                  # Reference docs
├── tools/                 # Individual tool implementations
│   ├── index.ts
│   ├── getVault.ts
│   ├── queryTransactions.ts
│   ├── refund.ts
│   └── getSubscription.ts
└── result-renderers/     # Generative UI components
    └── TransactionList.tsx
```

```yaml
---
type: skill
name: "NMI Payment Gateway"
description: "Process payments, manage customer vaults, query transactions"
version: "1.0.0"
domain: billing-flow
mcp: false
custom_client: true
total_actions: 15
associated_domains:
  - billing-flow
  - agent-payments
associated_connectors:
  - hyperswitch
  - base44
access: internal
---
```

**NKS Fields Beyond OKF:**
- `mcp` — is this an MCP server connection?
- `custom_client` — does it use a custom API client?
- `total_actions` — how many actions/tools are available?
- `associated_domains` — which domains use this skill?
- `associated_connectors` — related connectors
- Co-located code files (client.ts, schema.ts, tools/, result-renderers/)

### Innovation 3: Connector Specification (`type: connector`)

**What it is:** A formal specification for an external system integration, including API reference, configuration, and playbook.

```yaml
---
type: connector
name: "Base44 CRM"
description: "Central backend for NewLeaf operations — entities, reporting, functions"
version: "1.0.0"
scope: connector
auto_load: true
priority: P1
headline: |
  Base44 central backend for NewLeaf ops. 12 queryable entities, 16 report actions.
trigger_tools:
  - base44:createEntity
  - base44:customer360
  - base44:queryEntity
  - base44:reportingHub
access: internal
---
```

**NKS Fields Beyond OKF:**
- `auto_load` — should agent auto-load this connector?
- `trigger_tools` — which tools should auto-trigger this connector?
- Co-located `client.ts`, `schema.ts`, `manifest.ts`, `mcp-config.json`

### Innovation 4: Mission Tracking (`type: mission`)

**What it is:** A tracked mission with a state machine, artifacts, and events.

```yaml
---
type: mission
name: "Neptune Connector Playbook Workflow Builder"
description: "Build a workflow that auto-creates connector playbooks"
version: "1.0.0"
status: "active"           # proposed | active | paused | completed | failed | archived
priority: P0
state: "executing"          # Current state in the mission FSM
artifacts:                  # Linked artifacts produced by this mission
  - "PLAYBOOK-ROUTER.md"
  - "connector-skills/base44/playbook.md"
progress:
  completed: 4
  total: 7
  percentage: 57
events:                     # Key mission events
  - { date: "2026-06-09", event: "Mission proposed" }
  - { date: "2026-06-10", event: "Phase 1: Inventory complete" }
access: internal
---
```

**NKS Fields Beyond OKF:**
- `state` — current FSM state
- `artifacts` — linked artifact files
- `progress` — completion tracking
- `events` — key timeline events
- State machine: proposed → active → executing → completed/failed

### Innovation 5: Memory Reference (`type: memory`)

**What it is:** A persistent cross-session memory that agents can reference across conversations.

```yaml
---
type: memory
name: "NMI Vault Sacred Reference"
description: "The sacred NMI vault ID used across all payment operations"
version: "1.0.0"
memory_id: "6a1f118b"
memory_type: "reference"    # reference | rule | preference | fact | context
persistence: "permanent"    # session | permanent | ttl
ttl_days: null
referenced_by:
  - "connectors/nmi/SKILL.md"
  - "playbooks/billing/playbook-billing.md"
  - "skills/functions/cof-health-audit/SKILL.md"
access: restricted
---
```

**NKS Fields Beyond OKF:**
- `memory_id` — unique memory identifier
- `memory_type` — reference, rule, preference, fact, context
- `persistence` — session, permanent, or TTL-based
- `referenced_by` — which files reference this memory
- `ttl_days` — auto-expiry for time-bound memories

### Innovation 6: Skill Author Template (`type: template`)

**What it is:** A template for auto-generating new skills via the skill-author agent.

```yaml
---
type: template
name: "Connector Skill Template"
description: "Template for creating new connector integrations"
version: "1.0.0"
template_for: "connector"
generates:
  - "SKILL.md"
  - "PLAYBOOK.md"
  - "manifest.ts"
  - "schema.ts"
  - "client.ts"
  - "tools/index.ts"
  - "docs/api-reference.md"
required_inputs:
  - connector_name
  - api_base_url
  - auth_type
  - actions_list
scripts:
  create: "skills/skill-author/scripts/create-connector-pack.ts"
  ingest: "skills/skill-author/scripts/ingest-api-docs.ts"
access: internal
---
```

**NKS Fields Beyond OKF:**
- `template_for` — what artifact type this template generates
- `generates` — list of files the template creates
- `required_inputs` — what the user/agent must provide
- `scripts` — automation scripts for creation and ingestion

### Innovation 7: Generative UI Component (`type: connector` with UI)

**What it is:** A connector that includes generative UI components for displaying results.

```yaml
---
type: connector
name: "Slack Integration"
description: "Post messages, search channels, manage reactions"
version: "1.0.0"
ui_components:
  - name: "ChannelGrid"
    path: "result-renderers/ChannelGrid.tsx"
    props: ["channels", "onSelect"]
  - name: "MessageList"
    path: "result-renderers/MessageList.tsx"
    props: ["messages", "channel"]
ui_schema:
  layout: "grid"
  searchable: true
  filters: ["channel", "date", "user"]
access: internal
---
```

**NKS Fields Beyond OKF:**
- `ui_components` — bound React components for rendering results
- `ui_schema` — layout, search, and filter configuration
- Co-located `result-renderers/` directory

### Innovation 8: Workflow Definition (`type: workflow`)

**What it is:** A multi-step automation pipeline defined in YAML.

```yaml
# workflows/billing-sweep.yaml
---
type: workflow
name: "Billing Sweep"
description: "Nightly sweep of all failed payments with intelligent retry"
version: "1.0.0"
schedule: "0 3 * * *"        # 3 AM daily
steps:
  - id: "query-failed"
    action: "base44:reportingHub"
    params: { action: "billing", status: "failed" }
  - id: "classify-declines"
    action: "function:parse-decline-reason"
    depends_on: ["query-failed"]
  - id: "retry-soft"
    action: "nmi:charge"
    condition: "decline_type == 'soft'"
    depends_on: ["classify-declines"]
  - id: "notify-hard"
    action: "slack:postMessage"
    condition: "decline_type == 'hard'"
    depends_on: ["classify-declines"]
notify_on_completion: "#jarvis-admin"
access: internal
---
```

**NKS Fields Beyond OKF:**
- `schedule` — cron expression for automated execution
- `steps` — ordered/conditional workflow steps
- `depends_on` — step dependency graph
- `condition` — conditional execution
- `notify_on_completion` — where to send results

### Innovation 9: Self-Coding Instructions (`self_code: true`)

**What it is:** Skills that include instructions for the AI agent to modify its own codebase.

```yaml
---
type: skill
name: "Self-Coding Capability"
description: "Neptune Chat's ability to modify its own codebase"
version: "1.0.0"
self_code: true
self_code_limits:
  max_files: 3
  max_lines: 50
  require_build: true
  require_smoke_test: true
self_code_pattern: |
  1. Assess: Is this task small enough? (<50 lines, ≤3 files)
  2. Clone: Use Vercel Sandbox SDK to clone repo
  3. Edit: Make the change, following existing patterns
  4. Build: pnpm typecheck + pnpm build must pass
  5. Push: Create feat/<slug> branch, commit, push
  6. Verify: Poll Vercel REST API until deploy state=READY
  7. Smoke: curl the changed route, verify HTTP 200
  8. Report: Tell the user done with commit SHA + deploy URL
access: restricted
---
```

**NKS Fields Beyond OKF:**
- `self_code` — whether the agent can self-modify using this skill
- `self_code_limits` — guardrails (max files, max lines, build required)
- `self_code_pattern` — the exact steps the agent must follow

### Innovation 10: Audit Trail (`type: audit`)

**What it is:** An audit/compliance record with structured findings.

```yaml
---
type: audit
name: "Base44 Full Audit 2026-06-17"
description: "Comprehensive audit of all Base44 entities, APIs, functions"
version: "1.0.0"
audit_date: "2026-06-17"
audit_scope:
  - "Base44 entities (12)"
  - "Base44 functions (16)"
  - "Reporting Hub actions (16)"
findings:
  total: 47
  critical: 0
  high: 3
  medium: 12
  low: 32
compliance:
  okf_v0_1: "partial"
  nks_v1_0: "complete"
  gdpr: "compliant"
  pci_dss: "compliant"
access: internal
---

# Base44 Full Audit

## Executive Summary
...
```

**NKS Fields Beyond OKF:**
- `audit_date` — when the audit was conducted
- `audit_scope` — what was audited
- `findings` — structured severity breakdown
- `compliance` — compliance status across standards

---

## 7. Cross-Linking & Graph Integration

### 7.1 Link Syntax

All cross-references use **relative markdown links**:

```markdown
✅ [NMI Skill](../../connectors/nmi/SKILL.md)
✅ [Billing Playbook](../billing/playbook-billing.md)
✅ [Charge Flow](./nmi-charge-flow.md)

❌ /home/neptune/neptune-chat/connectors/nmi/SKILL.md  (absolute path)
❌ https://github.com/.../SKILL.md                       (full URL for local files)
```

### 7.2 Graph Edges

Every link creates an edge in the knowledge graph. The edge type is inferred from context:

| Link Context | Edge Type |
|-------------|-----------|
| `links` field in YAML frontmatter | `references` |
| Markdown link in body text | `references` |
| `associated_skills` in YAML | `uses` |
| `scope_connectors` in YAML | `depends-on` |
| `trigger_tools` in YAML | `triggers` |
| `workflows` in YAML | `orchestrates` |
| `referenced_by` in memory | `remembers` |

### 7.3 Graph API

```
GET /api/knowledge/graph
→ { nodes: GraphNode[], edges: GraphEdge[], stats: {...} }
```

Nodes represent files. Edges represent relationships. The graph supports D3 force-directed visualization at `/knowledge`.

---

## 8. RBAC & Access Control

### 8.1 Access Levels

Every NKS file declares an `access` level:

| Level | Value | Description |
|-------|-------|-------------|
| Public | `public` | Anyone with the bundle can read |
| Internal | `internal` | NewLeaf staff only |
| Restricted | `restricted` | Admins + specific roles only |
| Customer | `customer` | Visible to end customers |

### 8.2 RBAC Integration

NKS access levels integrate with:
- **NextAuth** session roles (super_admin, admin, sales_agent, customer)
- **Twenty CRM** RBAC (Admin, Member roles)
- **Vercel** deployment protection

### 8.3 Access Enforcement

```typescript
function canAccess(fileAccess: string, userRole: string): boolean {
  if (fileAccess === "public") return true;
  if (fileAccess === "internal" && userRole !== "customer") return true;
  if (fileAccess === "restricted" && ["super_admin", "admin"].includes(userRole)) return true;
  if (fileAccess === "customer") return true;
  return false;
}
```

---

## 9. Validation & Compliance

### 9.1 NKS Validator

```typescript
import { z } from "zod";

const NksFrontmatterSchema = z.object({
  type: z.enum(["index", "concept", "prd", "spec", "playbook", "skill",
    "connector", "mission", "research", "memory", "workflow", "template",
    "audit", "design"]),
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(500),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  access: z.enum(["public", "internal", "restricted", "customer"]),
  // Optional
  tags: z.array(z.string()).optional(),
  domain: z.string().optional(),
  author: z.string().email().optional(),
  status: z.enum(["draft", "review", "stable", "deprecated", "archived"]).optional(),
  links: z.array(z.string()).optional(),
  // NKS extensions
  priority: z.enum(["P0", "P1", "P2", "P3", "P4", "P5"]).optional(),
  intent_tags: z.array(z.string()).optional(),
  model_routing: z.record(z.string()).optional(),
  associated_skills: z.array(z.string()).optional(),
  associated_connectors: z.array(z.string()).optional(),
  workflows: z.array(z.string()).optional(),
  self_code: z.boolean().optional(),
  ui_components: z.array(z.object({
    name: z.string(),
    path: z.string(),
    props: z.array(z.string()).optional(),
  })).optional(),
});
```

### 9.2 Compliance Checklist

- ✅ Every directory has `index.md`
- ✅ Every `.md` file has `type` field
- ✅ All required frontmatter fields present
- ✅ No broken cross-links
- ✅ Access levels set on all files
- ✅ Version numbers follow semver
- ✅ Dates are ISO 8601
- ✅ Tags are lowercase, hyphenated
- ✅ File names are kebab-case (except SKILL.md, PLAYBOOK.md)

---

## 10. Migration Guide: OKF ↔ Neptune

### 10.1 OKF → NKS (Upgrade)

1. **Add `access` field** to all YAML frontmatter
   ```bash
   npx tsx scripts/generate-okf-indexes.ts
   ```
2. **Add NKS-specific fields** as needed (playbook routing, skill definitions, etc.)
3. **Run validator** to check compliance
4. **Regenerate index files** if needed

### 10.2 NKS → OKF (Downgrade/Export)

1. **Run export tool**
   ```bash
   npx tsx scripts/export-okf-bundle.ts --output /tmp/okf-bundle
   ```
2. NKS-extension fields are **stripped** from the export
3. All files are still valid OKF files
4. `manifest.yaml` uses OKF format (domains + files, no NKS extensions)

### 10.3 Field Mapping

| NKS Field | OKF Export Behavior |
|-----------|-------------------|
| `type` | ✅ Preserved (new values mapped to `concept` if unrecognized) |
| `access` | ❌ Stripped (OKF has no access concept) |
| `priority` | ❌ Stripped |
| `intent_tags` | ❌ Stripped |
| `model_routing` | ❌ Stripped |
| `scope_connectors` | ❌ Stripped |
| `self_code` | ❌ Stripped |
| `ui_components` | ❌ Stripped |
| `trigger_tools` | ❌ Stripped |
| `workflows` | ❌ Stripped |

---

## 11. Reference Implementation

### 11.1 Production Instance

**Neptune Chat** is the living reference implementation of NKS v1.0.

- **URL:** https://neptune-chat-ashy.vercel.app
- **Knowledge UI:** https://neptune-chat-ashy.vercel.app/knowledge
- **Repo:** github.com/abhiswami2121/neptune-chat
- **Stats:** 500+ knowledge files, 187 index.md, 258 typed frontmatter entries

### 11.2 TypeScript Types

```typescript
// lib/neptune-spec/types.ts
export type NksType = 
  | "index" | "concept" | "prd" | "spec" | "playbook" | "skill"
  | "connector" | "mission" | "research" | "memory" | "workflow"
  | "template" | "audit" | "design";

export type NksAccess = "public" | "internal" | "restricted" | "customer";
export type NksStatus = "draft" | "review" | "stable" | "deprecated" | "archived";
export type NksPriority = "P0" | "P1" | "P2" | "P3" | "P4" | "P5";

export interface NksFrontmatter {
  // Required
  type: NksType;
  name: string;
  description: string;
  version: string;
  updated: string;
  access: NksAccess;
  // Optional
  tags?: string[];
  domain?: string;
  author?: string;
  status?: NksStatus;
  links?: string[];
  // NKS extensions
  priority?: NksPriority;
  intent_tags?: string[];
  model_routing?: Record<string, string>;
  associated_skills?: string[];
  associated_connectors?: string[];
  workflows?: string[];
  self_code?: boolean;
  ui_components?: NksUiComponent[];
}

export interface NksUiComponent {
  name: string;
  path: string;
  props?: string[];
}
```

### 11.3 Sample Bundles

Five reference bundles demonstrate NKS across different use cases:

1. **Billing Playbook Bundle** — Complete billing domain with playbook, skills, connectors
2. **Dispute Management Bundle** — Credit dispute workflow with state machine
3. **Twenty CRM Bundle** — CRM integration with custom objects, workflows, permissions
4. **Agent Orchestration Bundle** — Multi-agent coordination with playbook router
5. **VPS Operations Bundle** — Infrastructure management with runbooks

---

## 12. Appendix: Reserved Fields

### 12.1 Reserved YAML Frontmatter Fields

These field names are reserved by NKS and should not be repurposed:

```yaml
# Core (OKF-compatible)
type, name, description, version, updated, tags, domain, author, status, links

# NKS Playbook
scope, scope_connectors, triggers, trigger_tools, headline, auto_load

# NKS Skill
mcp, custom_client, total_actions, mcp_config, custom_client_path

# NKS Mission
state, artifacts, progress, events

# NKS Memory
memory_id, memory_type, persistence, ttl_days, referenced_by

# NKS Template
template_for, generates, required_inputs, scripts

# NKS UI
ui_components, ui_schema

# NKS Workflow
schedule, steps, depends_on, condition, notify_on_completion

# NKS Self-Coding
self_code, self_code_limits, self_code_pattern

# NKS Audit
audit_date, audit_scope, findings, compliance

# NKS RBAC
access, priority, intent_tags, model_routing
associated_skills, associated_connectors, associated_domains
```

### 12.2 Reserved Directory Names

```
connectors/   playbooks/   skills/   shared-skills/   workflows/
jarvis/cortex/   docs/   proofs/   scripts/   app/
_okf/   _template/   result-renderers/   tools/
```

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-06-17 | 1.0.0 | Initial publication. Full OKF v0.1 compatibility + 10 NKS innovations |
| 2026-06-12 | 0.1.0-draft | Draft circulated after Google OKF v0.1 release |

---

*Neptune-Knowledge-Spec v1.0 — A production-grade superset of OKF v0.1.*  
*Built 6 months ahead of Google's spec. Augmenting, not competing.*  
*MIT License. github.com/abhiswami2121/neptune-chat*
