# NEPTUNE KNOWLEDGE SPEC v1.0

## OKF Superset for Production AI Agents

**Version:** 1.0.0  
**Date:** 2026-06-17  
**Status:** RELEASED  
**Author:** abhiswami2121@gmail.com  
**Type:** SPEC  
**Tags:** okf, knowledge-layer, neptune-platform, ai-agents, spec, v1.0  

---

## TABLE OF CONTENTS

1. [Vision](#1-vision)
2. [OKF v0.1 Compatibility Matrix](#2-okf-v01-compatibility-matrix)
3. [File Structure Specification](#3-file-structure-specification)
4. [YAML Frontmatter Specification](#4-yaml-frontmatter-specification)
5. [Linking Specification](#5-linking-specification)
6. [Producer / Consumer Contract](#6-producer--consumer-contract)
7. [Neptune Extensions (10 Beyond OKF)](#7-neptune-extensions-10-beyond-okf)
8. [Reference Implementations](#8-reference-implementations)
9. [OKF Export Protocol](#9-okf-export-protocol)
10. [Migration Guide](#10-migration-guide)
11. [Governance](#11-governance)
12. [Appendix: Full Schema](#12-appendix-full-schema)

---

## 1. VISION

### 1.1 What This Is

The **Neptune Knowledge Spec (NKS)** is a vendor-neutral, markdown-native specification for organizing, linking, and operationalizing AI agent knowledge. It is a **superset of Google's OKF v0.1** (Open Knowledge Format, released June 12, 2026) — every OKF-conformant file is valid NKS, and every NKS file can be losslessly exported to pure OKF.

NKS extends OKF with 10 production-grade capabilities that OKF does not address, making it suitable for **real-world AI agent platforms** that need versioned skills, domain playbooks, cross-session memory, mission tracking, and recursive self-improvement.

### 1.2 The Problem We Solve

AI agents today suffer from knowledge fragmentation:

- **Skills** are scattered across markdown files, code comments, Notion docs, and Slack threads
- **Playbooks** (domain-specific operating procedures) lack a standard format
- **PRDs and technical specs** have no canonical structure linking them to implementation
- **Memory** is ephemeral — agents forget between sessions
- **No graph** connects skills to playbooks to missions to code
- **No vendor-neutral format** — every platform invents its own knowledge format

NKS solves this with:

```
SKILLS ──┐
PLAYBOOKS ──┤
PRDs + TRDs ──┼──→ NEPTUNE KNOWLEDGE GRAPH ──→ AI AGENT
MISSIONS ──┤              │
MEMORIES ──┤              ▼
RESEARCH ──┘      OKF EXPORT (pure)
                  T win View (library + playbook)
                  Visualizer (D3 graph)
                  Self-Code (agents write back)
```

### 1.3 Design Principles

| # | Principle | Meaning |
|---|-----------|---------|
| P1 | **Vendor-Neutral** | Markdown + YAML only. No proprietary formats. Any text editor or LLM can read/write. |
| P2 | **OKF Superset** | 100% read-compatible with OKF v0.1. All OKF required fields are present. Extensions are clearly marked as `NEPTUNE EXTENSION`. |
| P3 | **Graph-Native** | All cross-references use markdown relative links. Graph engines (Graphify + Graphiti) index these automatically. The file system IS the graph. |
| P4 | **Agent-Authorable** | AI agents can create, update, and verify NKS files. The `skill-author` agent produces conformant SKILL.md files. |
| P5 | **Versioned** | Every file version is tracked via `log.md` (git history + structured changelog). YAML frontmatter carries `version` fields. |
| P6 | **Operational** | NKS files are not just documentation — they are consumed at runtime by AI agents via the Knowledge Router. |
| P7 | **Progressive Disclosure** | Level 1 (index.md) → Level 2 (main file) → Level 3 (architecture/code-patterns/operational). Agents navigate depth as needed. |
| P8 | **Self-Describing** | Every file declares its type in YAML frontmatter. Validation scripts verify conformance. |

### 1.4 Strategic Position

```
GOOGLE OKF v0.1 (released June 12, 2026)
├── Static knowledge format
├── index.md + frontmatter + log.md
├── Visualizer (static HTML)
├── Sample bundles (GA4, SO, Bitcoin)
│
NEPTUNE KNOWLEDGE SPEC v1.0 (released June 17, 2026)
├── ALL OKF v0.1 features ✓
├── + 10 EXTENSIONS:
│   1. Twin View (Library + Playbook dual perspective)
│   2. Playbook Layer (with manifest.yaml + connectors + workflows)
│   3. Graph Engines (Graphify code graph + Graphiti ops graph)
│   4. Memory System (cross-session persistent memory)
│   5. Mission Tracking (JarvisTask + missions/ lifecycle)
│   6. Skill-Author (AI agents write conformant skills)
│   7. Self-Code (agents modify their own knowledge)
│   8. MCP Integration (Model Context Protocol bridge)
│   9. Workflow Linking (n8n workflow ↔ playbook steps)
│  10. Generative UI (MissionCard, HandoffCard, KnowledgeGraph)
└── Reference implementation: Neptune Chat + V2 + Twenty CRM
```

**Positioning:** We are 6+ months ahead of Google's OKF. We do not compete — we **augment**. Any tool that reads OKF can read NKS. Any NKS bundle exports to pure OKF. We are the reference implementation for production AI agent knowledge layers.

---

## 2. OKF v0.1 COMPATIBILITY MATRIX

### 2.1 Required OKF v0.1 Fields — All Supported

| OKF v0.1 Field | NKS Support | Status | Notes |
|----------------|-------------|--------|-------|
| `type` (required) | ✅ FULL | `COMPATIBLE` | All NKS files declare `type` in YAML frontmatter. Extended with Neptune types. |
| `name` (required) | ✅ FULL | `COMPATIBLE` | Present in all NKS files. |
| `description` (optional) | ✅ FULL | `COMPATIBLE` | Present in all NKS files. |
| `version` (optional) | ✅ FULL | `COMPATIBLE` | Present. NKS uses semver (major.minor.patch). |
| `tags` (optional) | ✅ FULL | `COMPATIBLE` | YAML list. Used for filtering and search. |
| Related links in body | ✅ FULL | `COMPATIBLE` | Standard markdown `[text](path)` links. |
| `index.md` per directory | ✅ FULL | `COMPATIBLE` | Auto-generated listing all files in directory with frontmatter excerpts. |
| `log.md` per domain | ✅ FULL | `COMPATIBLE` | Append-only changelog with ISO timestamps. |
| Static HTML visualizer | ✅ FULL | `COMPATIBLE` | Fork of Google's visualizer with Neptune extensions. |

### 2.2 OKF v0.1 File Type Mapping

| OKF Type | NKS Equivalent | Notes |
|----------|---------------|-------|
| `concept` | (supported) | Used for knowledge-base entries. |
| `skill` | `skill` | Anthropic-format SKILL.md. NEPTUNE EXTENSIONS: domain, mcp, custom_client fields. |
| `playbook` | `playbook` | Domain operating procedure. NEPTUNE EXTENSIONS: manifest.yaml, connectors, skills, workflows, functions. |
| `research` | `research` | Investigation findings with source links. |
| (not in OKF) | `prd` | NEPTUNE EXTENSION: Full product requirement with TRD, design, nav, impl. |
| (not in OKF) | `mission` | NEPTUNE EXTENSION: Tracked execution with session_id and budget. |
| (not in OKF) | `memory` | NEPTUNE EXTENSION: Cross-session persistent memory entries. |
| (not in OKF) | `connector` | NEPTUNE EXTENSION: External service integration specs. |
| (not in OKF) | `workflow` | NEPTUNE EXTENSION: n8n workflow definitions linked to playbooks. |

### 2.3 Read Compatibility Guarantee

> **Any OKF-compliant tool can parse any NKS file.**  
> All Neptune-extended frontmatter fields are strictly additive. A parser that understands OKF v0.1 will extract `type`, `name`, `description`, `version`, and `tags` from any NKS file without modification. Additional Neptune fields are silently ignored by OKF-only parsers.

### 2.4 Write Compatibility Guarantee

> **Any NKS bundle can be exported to pure OKF v0.1.**  
> The `okf-export.ts` script strips Neptune-extended frontmatter fields, removes non-OKF file types from index.md listings, and produces a pure OKF-compliant bundle. The export is lossy by design (Neptune extensions are stripped) but the core knowledge graph is preserved.

### 2.5 Compatibility Test Suite

```bash
# Verify NKS conformance
pnpm tsx scripts/knowledge-layer/okf-verify.ts

# Export pure OKF bundle
pnpm tsx scripts/knowledge-layer/okf-export.ts --output /tmp/okf-bundle

# Validate against Google's OKF visualizer
# (open /tmp/okf-bundle in OKF visualizer)
```

---

## 3. FILE STRUCTURE SPECIFICATION

### 3.1 Top-Level Structure

```
cortex/                          ← ROOT KNOWLEDGE LAYER
├── index.md                     ← OKF top-level: lists all directories
├── log.md                       ← OKF top-level: global changelog
│
├── skills/                      ← AI agent skills (Anthropic format)
│   ├── index.md                 ← OKF: skill listing
│   └── <skill-name>/            ← One directory per skill
│       ├── SKILL.md             ← Main skill file (Anthropic spec)
│       ├── index.md             ← OKF: sub-index for this skill
│       ├── log.md               ← OKF: skill changelog
│       ├── architecture/        ← NEPTUNE EXTENSION: architecture docs
│       │   └── overview.md
│       ├── code-patterns/       ← NEPTUNE EXTENSION: code patterns
│       │   └── patterns.md
│       ├── operational/         ← NEPTUNE EXTENSION: ops runbooks
│       │   └── runbook.md
│       └── knowledge-base/      ← NEPTUNE EXTENSION: domain knowledge
│           └── concepts.md
│
├── playbooks/                   ← Domain operating procedures
│   ├── index.md                 ← OKF: playbook listing
│   └── <domain>/                ← One directory per domain
│       ├── playbook.md          ← Main playbook (4-section format)
│       ├── index.md             ← OKF: sub-index
│       ├── log.md               ← OKF: playbook changelog
│       ├── manifest.yaml        ← NEPTUNE EXTENSION: metadata
│       ├── connectors/          ← NEPTUNE EXTENSION: integrations
│       ├── skills/              ← NEPTUNE EXTENSION: linked skills
│       ├── functions/           ← NEPTUNE EXTENSION: serverless functions
│       └── workflows/           ← NEPTUNE EXTENSION: n8n workflows
│
├── prd/                         ← Product requirement documents
│   ├── index.md                 ← OKF: PRD listing
│   └── <prd-name>/              ← One directory per PRD
│       ├── prd.md               ← Product requirements
│       ├── trd.md               ← NEPTUNE EXTENSION: Technical requirements
│       ├── design-doc.md        ← NEPTUNE EXTENSION: Design specification
│       ├── navigation.md        ← NEPTUNE EXTENSION: Navigation flows
│       ├── implementation.md    ← NEPTUNE EXTENSION: Implementation plan
│       └── log.md               ← OKF: PRD changelog
│
├── research/                    ← Investigation findings
│   ├── index.md                 ← OKF: research listing
│   └── <topic>/                 ← One directory per research topic
│       ├── research.md          ← Main findings
│       └── log.md               ← OKF: research changelog
│
├── missions/                    ← Tracked execution runs
│   ├── index.md                 ← OKF: mission listing
│   └── <mission-name>/          ← One directory per mission
│       ├── mission.md           ← Mission definition + status
│       ├── log.md               ← OKF: mission changelog
│       └── results/             ← NEPTUNE EXTENSION: output artifacts
│           └── *.md
│
└── memories/                    ← Cross-session persistent memory
    ├── index.md                 ← OKF: memory listing
    └── <memory-id>.md           ← Individual memory entry
```

### 3.2 index.md Specification

Every directory MUST contain an `index.md` that lists all files and subdirectories.

**Format:**
```markdown
# <Directory Name>

> Auto-generated index for OKF compatibility. [View in Knowledge Graph](/knowledge)

## Files

| Name | Type | Description | Version | Tags |
|------|------|-------------|---------|------|
| [SKILL.md](./SKILL.md) | skill | Billing flow agent skill | 1.0.0 | billing, p0 |
| [index.md](./index.md) | index | This index | - | - |
| [log.md](./log.md) | log | Skill changelog | - | - |

## Subdirectories

| Path | Description |
|------|-------------|
| [architecture/](./architecture/) | Architecture documentation |
| [code-patterns/](./code-patterns/) | Code pattern references |
| [operational/](./operational/) | Operational runbooks |
| [knowledge-base/](./knowledge-base/) | Domain knowledge base |
```

### 3.3 log.md Specification

Every directory SHOULD contain a `log.md` with an append-only ISO-timestamped changelog.

**Format:**
```markdown
# Changelog — <Directory Name>

## 2026-06-17 10:00 UTC
- **feat:** Initial NKS v1.0 conformance pass
- **author:** skill-author agent
- **commit:** abc1234

## 2026-06-12 09:30 UTC
- **create:** Directory created
- **author:** hermes agent
- **commit:** def5678
```

### 3.4 Directory Naming Convention

- All directory names: **kebab-case** (lowercase, hyphens for spaces)
- No special characters except `-` and `.`
- Examples: `billing-flow/`, `credit-disputes/`, `v2-coding-agent/`
- Skill directories match the skill name in SKILL.md frontmatter
- Playbook directories match domain name (e.g., `billing/`, `support-triage/`)

---

## 4. YAML FRONTMATTER SPECIFICATION

### 4.1 Core Fields (OKF Compatible)

Every NKS file MUST include YAML frontmatter between `---` delimiters with these fields:

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `name` | ✅ YES | string | Human-readable name. Used for display and search. |
| `type` | ✅ YES | string | File type. Must be one of the valid types below. |
| `description` | ✅ YES | string | One-paragraph description. Max 500 chars. |
| `version` | RECOMMENDED | string | Semver version (e.g., "1.0.0"). Default: "0.1.0". |
| `tags` | RECOMMENDED | list[string] | Search tags. Lowercase, kebab-case. |

### 4.2 Valid Types

| Type | Used In | Description |
|------|---------|-------------|
| `skill` | SKILL.md | AI agent skill definition (Anthropic format) |
| `playbook` | playbook.md | Domain operating procedure |
| `prd` | prd.md | Product requirement document |
| `trd` | trd.md | Technical requirements document |
| `design` | design-doc.md | Design specification |
| `navigation` | navigation.md | Navigation flow document |
| `implementation` | implementation.md | Implementation plan |
| `research` | research.md | Investigation findings |
| `mission` | mission.md | Tracked execution run |
| `memory` | *.md | Persistent memory entry |
| `connector` | connector.md | External service integration |
| `workflow` | workflow.md | n8n workflow definition |
| `concept` | concepts.md | Knowledge base concept entry |
| `index` | index.md | Directory index |
| `log` | log.md | Changelog |

### 4.3 Skill Frontmatter (Full)

```yaml
---
name: "Billing Flow Agent"
description: "Handles payment collection, decline recovery, and billing inquiries."
version: "2.3.0"
type: skill
domain: billing
mcp: nmi_mcp_bridge, slack_mcp_bridge
custom_client: false
tags:
  - billing
  - p0
  - nmi
  - payments
---
```

**Neptune-Extended Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `domain` | string | Primary domain this skill belongs to. One of: billing-flow, credit-disputes, customer-enrollment, compliance-audit, support-triage, agent-payments, reporting, customer-comms, lead-flow, mcp-edits. |
| `mcp` | string | Comma-separated list of MCP servers this skill uses. |
| `custom_client` | boolean | Whether this skill requires a custom API client. |

### 4.4 Playbook Frontmatter (Full)

```yaml
---
name: "Billing Domain Playbook"
description: "Operating procedures for payment collection, decline recovery, subscription management, and NMI vault operations."
version: "4.0.0"
type: playbook
domain: billing
connectors:
  - nmi
  - hyperswitch
  - slack
skills:
  - billing-payment-collection
  - billing-decline-recovery
  - billing-subscription-mgmt
workflows:
  - on-payment-declined
  - monthly-recovery-campaign
functions:
  - nmi-charge
  - nmi-refund
  - payment-link-generator
tags:
  - billing
  - p0
  - nmi
  - payments
  - subscriptions
---
```

**Neptune-Extended Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `domain` | string | Domain identifier (lowercase, kebab-case). |
| `connectors` | list[string] | External services this playbook integrates with. |
| `skills` | list[string] | Linked skills that implement playbook steps. |
| `workflows` | list[string] | n8n workflow names linked to this playbook. |
| `functions` | list[string] | Serverless functions used by this playbook. |

### 4.5 PRD Frontmatter (Full)

```yaml
---
name: "Phase 34 — OKF Compatibility Pass"
description: "Bring entire cortex into OKF v0.1 conformance: add index.md, log.md, type fields, and generate OKF export bundle."
version: "1.0.0"
type: prd
status: planned
owner: hermes
budget: 8000
eta: "2026-06-24"
dependencies:
  - knowledge-graph-core
tags:
  - okf
  - phase-34
  - knowledge-layer
  - p0
---
```

**Neptune-Extended Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | One of: planned, in_progress, review, completed, archived. |
| `owner` | string | Agent or human responsible. |
| `budget` | number | Estimated tool call budget (in tool runs). |
| `eta` | string | ISO date or relative (e.g., "2 weeks"). |
| `dependencies` | list[string] | PRD or system dependencies. |

### 4.6 Mission Frontmatter (Full)

```yaml
---
name: "OKF Export Generation"
description: "Generate OKF bundle from current cortex and verify conformance."
version: "1.0.0"
type: mission
prd_ref: phase-34-okf-compatibility
session_id: "20260617-abc123"
budget: 3000
status: in_progress
tags:
  - okf
  - export
  - verification
---
```

**Neptune-Extended Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `prd_ref` | string | Reference to parent PRD this mission implements. |
| `session_id` | string | Unique session identifier for tracking. |
| `status` | string | One of: planned, dispatched, in_progress, completed, failed. |

### 4.7 Research Frontmatter

```yaml
---
name: "Twenty CRM Installation Audit"
description: "Verify Twenty CRM self-hosted installation status, custom objects, and integration readiness."
version: "1.0.0"
type: research
sources:
  - "/home/neptune/twenty/"
  - "https://docs.twenty.com"
  - "Slack #jarvis-admin thread 2026-06-17"
summary: "Twenty running on Docker, 6 custom objects deployed, API accessible on port 3001."
tags:
  - twenty
  - crm
  - audit
---
```

### 4.8 Memory Frontmatter

```yaml
---
name: "NMI Vault Configuration"
description: "Sacred memory: NMI vault IDs, security key location, and PCI scope boundaries."
version: "1.0.0"
type: memory
persistence: permanent
scope: global
refs:
  - memory-6a1f118b
  - prd/nmi-vault-security/prd.md
tags:
  - nmi
  - sacred
  - security
  - vault
---
```

**Neptune-Extended Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `persistence` | string | `permanent` (never expires) or `session` (cleared after session). |
| `scope` | string | `global` (all agents) or `user` (specific agent/context). |
| `refs` | list[string] | Links to related memories or documents. |

---

## 5. LINKING SPECIFICATION

### 5.1 Link Format

All cross-references use **standard markdown relative links**:

```markdown
[See Phase 33 PRD](../prd/phase-33/prd.md)
[Billing Playbook](../playbooks/billing/playbook.md)
[V2 Coding Agent Skill](../skills/v2-coding-agent/SKILL.md)
[Research: Twenty Audit](../research/twenty-crm-audit/research.md)
```

### 5.2 Link Rules

| Rule | Description |
|------|-------------|
| **Relative Only** | All links are relative to the current file's directory. No absolute paths. |
| **File-Level** | Links target `.md` files, not directories. The index.md of a directory handles directory-level linking. |
| **Fragment Support** | Links can include `#section-headers` for deep linking. |
| **Bidirectional** | If A links to B, B's index.md SHOULD link back to A. Graph engines verify this. |
| **No Broken Links** | CI validates all markdown links on commit. Broken links block PR merge. |

### 5.3 Link Types

| Link Type | Example | Purpose |
|-----------|---------|---------|
| Skill → Playbook | `[Billing Playbook](../../playbooks/billing/playbook.md)` | Skill declares its domain context. |
| Playbook → Skill | `[Payment Collection](../../skills/billing-payment-collection/SKILL.md)` | Playbook references implementing skill. |
| PRD → Implementation | `[Implementation Plan](./implementation.md)` | PRD links to its implementation plan. |
| Mission → PRD | `[Phase 34 PRD](../../prd/phase-34-okf/prd.md)` | Mission references parent PRD. |
| Research → PRD | `[Phase 37 PRD](../../prd/phase-37-twenty-wave1/prd.md)` | Research informs a PRD. |
| Memory → Anything | `[NMI Vault Config](../../prd/nmi-security/prd.md)` | Memory anchors to related documents. |
| Playbook → Workflow | `[on-payment-declined](./workflows/on-payment-declined.md)` | Playbook step links to n8n workflow. |
| Skill → Architecture | `[Architecture](./architecture/overview.md)` | Skill links to detailed architecture. |

### 5.4 Graph Engine Integration

Links are consumed by two graph engines:

1. **Graphify** (Code Graph) — Indexes skills, playbooks, code patterns, and architecture. Powers V2's coding agent knowledge retrieval.

2. **Graphiti** (Ops Graph) — Indexes PRDs, missions, research, and memories. Powers the /knowledge visualizer and operational dashboards.

Both engines:
- Crawl all `.md` files in `cortex/`
- Parse markdown links as graph edges
- Index YAML frontmatter as node properties
- Expose query APIs: `query_code_graph()` and `query_cortex_graph()`

---

## 6. PRODUCER / CONSUMER CONTRACT

### 6.1 Producers

| Producer | What It Creates | Format Guarantee |
|----------|----------------|------------------|
| **Humans** | Skills, playbooks, PRDs, research | Manual authoring. Must pass `okf-verify.ts`. |
| **skill-author agent** | SKILL.md files | Outputs NKS-conformant SKILL.md with all required frontmatter. |
| **mission-runner agent** | mission.md + log.md + results/*.md | Creates mission directory, updates status, appends to log. |
| **memory-writer agent** | memory-*.md | Creates/updates memory entries with frontmatter. |
| **okf-export script** | Pure OKF bundle | Strips Neptune extensions, produces OKF-compliant output. |
| **index-generator script** | index.md files | Auto-generates directory indices from file frontmatter. |
| **log-writer** | log.md entries | Appends timestamped entries from git commit messages. |

### 6.2 Consumers

| Consumer | What It Reads | How It Uses |
|----------|---------------|-------------|
| **Neptune Chat Router** | SKILL.md, playbook.md | Routes user messages to the right skill based on domain classification. |
| **V2 Coding Agent** | All skills + code-patterns + architecture | Loads relevant context before generating code. |
| **Knowledge Router** | index.md (all) | Provides `/knowledge` route with graph visualization. |
| **Graphify** | All markdown links | Builds code knowledge graph for semantic search. |
| **Graphiti** | All frontmatter + links | Builds ops knowledge graph for dashboards. |
| **OKF Visualizer** | Pure OKF bundle | Renders interactive force-directed graph. |
| **Command Center** | PRDs + missions | Shows roadmap progress and mission status. |
| **Slack Bot** | log.md | Posts knowledge changes to #jarvis-admin. |

### 6.3 Contract Enforcement

```typescript
// Verification script validates:
// 1. Every .md file has valid YAML frontmatter with required fields
// 2. Every directory has index.md
// 3. Every domain directory has log.md
// 4. All markdown links resolve to existing files
// 5. All file types match allowed types
// 6. Version fields are valid semver
// 7. Tags are lowercase kebab-case
```

---

## 7. NEPTUNE EXTENSIONS (10 BEYOND OKF)

### Extension 1: Twin View

**What:** Dual perspective on knowledge — Library View (flat, searchable) and Playbook View (domain-organized, operational).

**OKF difference:** OKF provides only a single graph visualization. Neptune adds a **twin view** toggle that switches between:
- **Library View:** All files listed by type with search, filter, sort. Optimized for browsing and discovery.
- **Playbook View:** Domain-organized with manifest.yaml metadata. Shows connectors, skills, workflows, and functions per domain. Optimized for operations.

**Implementation:** `/knowledge?view=library` and `/knowledge?view=playbook` routes.

---

### Extension 2: Playbook Layer (with manifest.yaml)

**What:** Domain operating procedures with structured metadata in `manifest.yaml`.

**OKF difference:** OKF has no concept of operational playbooks. Neptune adds:
- `playbook.md` — 4-section format (Overview, Procedures, Escalations, Self-Healing)
- `manifest.yaml` — Machine-readable metadata: domain, connectors, skills, workflows, functions, owners, SLAs
- `connectors/` — Integration specifications
- `workflows/` — n8n workflow definitions linked to playbook steps

**manifest.yaml format:**
```yaml
domain: billing
version: "4.0.0"
owners:
  - agent: hermes
    role: primary
connectors:
  - name: nmi
    mcp: nmi_mcp_bridge
    sacred: true
  - name: hyperswitch
    mcp: null
    optional: true
skills:
  - billing-payment-collection
  - billing-decline-recovery
workflows:
  - id: on-payment-declined
    n8n_webhook: "https://n8n.newleaf.financial/webhook/declined"
functions:
  - nmi-charge
  - nmi-refund
slas:
  payment_processing: "5m"
  decline_response: "1h"
```

---

### Extension 3: Graph Engines (Graphify + Graphiti)

**What:** Dual-graph architecture — code knowledge (Graphify) and operational knowledge (Graphiti).

**OKF difference:** OKF's visualizer is static HTML. Neptune runs two live graph engines:
- **Graphify:** Indexes skills, code patterns, architecture. Powers V2's coding agent with relevant context retrieval.
- **Graphiti:** Indexes PRDs, missions, playbooks, research, memories. Powers dashboards and operational intelligence.

**APIs:**
```typescript
// Graphify — Code Graph
query_code_graph({ query: "billing NMI vault", limit: 10 })
// Returns: matching skill nodes, code patterns, architecture docs

// Graphiti — Ops Graph
query_cortex_graph({ query_type: "search", query: "phase 34 okf" })
// Returns: matching PRDs, missions, research, playbooks
```

---

### Extension 4: Memory System

**What:** Cross-session persistent memory with scoping and linking.

**OKF difference:** OKF has no memory concept. Neptune adds:
- `memories/` directory with individual memory entries
- `persistence` field: `permanent` (never expires) or `session` (cleared)
- `scope` field: `global` (all agents) or `user` (specific context)
- Memory anchors: each memory links to related documents
- Memory recall: agents query memories before executing

**Memory API:**
```typescript
// Store a memory
memory_append({
  conversationId: "session-xyz",
  content: "NMI vault security key location: /home/neptune/neptune-chat/secrets/nmi-vault.key",
  tags: ["nmi", "sacred", "security"]
})

// Recall memories
memory_read({
  conversationId: "session-xyz",
  limit: 10
})
```

---

### Extension 5: Mission Tracking

**What:** Tracked execution runs with lifecycle, budget, and results.

**OKF difference:** OKF has no execution tracking. Neptune adds:
- `missions/` directory with structured mission files
- Mission lifecycle: `planned → dispatched → in_progress → completed | failed`
- Budget tracking: estimated tool calls vs actual
- Results directory: output artifacts from mission execution
- `prd_ref`: link back to parent PRD
- `session_id`: unique identifier for cross-reference

**Mission lifecycle:**
```
planned ──→ dispatched ──→ in_progress ──→ completed
                                    └──→ failed (rollback + post-mortem)
```

---

### Extension 6: Skill-Author

**What:** AI agent that writes conformant SKILL.md files.

**OKF difference:** OKF assumes humans write knowledge. Neptune adds:
- `skill-author` agent: given a domain and capability, it produces NKS-conformant SKILL.md
- Auto-fills frontmatter (name, type, version, domain, mcp, tags)
- Follows Anthropic SKILL.md format (4-section: Overview, Procedures, Escalations, Self-Healing)
- Validates output against NKS schema before committing
- Appends to log.md with author attribution

---

### Extension 7: Self-Code

**What:** Agents modify their own knowledge files autonomously.

**OKF difference:** OKF is static documentation. Neptune adds:
- Agents with `selfCode` capability can write back to `cortex/`
- Changes are git-tracked with agent attribution in commit message
- `log.md` is auto-appended
- Rollback: git revert if change causes regression
- Guardrails: NMI vault files are SACRED (never modifiable by self-code)

**Self-Code protocol:**
```typescript
// Agent requests self-modification
await selfCode({
  path: "cortex/skills/billing-flow/SKILL.md",
  operation: "update_section",
  section: "procedures",
  content: "# Updated procedure...",
  reason: "NMI API changed from v2 to v3"
})
// → Creates git commit, updates log.md, triggers verification
```

---

### Extension 8: MCP Integration

**What:** Skills declare MCP (Model Context Protocol) server dependencies in frontmatter.

**OKF difference:** OKF doesn't know about tool dependencies. Neptune adds:
- `mcp` field in SKILL.md frontmatter
- Knowledge router reads MCP dependencies and warns if servers are unavailable
- Playbooks declare connector MCP servers in manifest.yaml

**MCP declaration:**
```yaml
mcp: nmi_mcp_bridge, slack_mcp_bridge, query_warehouse
```

---

### Extension 9: Workflow Linking (n8n)

**What:** Playbook steps link to executable n8n workflows.

**OKF difference:** OKF has no workflow execution. Neptune adds:
- `workflows/` directory in each playbook
- n8n workflow definitions stored as YAML/JSON
- Playbook steps reference workflows: `[on-payment-declined](./workflows/on-payment-declined.json)`
- Workflows triggered by: webhooks, Slack events, Twenty CRM events, schedules
- Status tracking: workflow runs logged in playbook's log.md

---

### Extension 10: Generative UI

**What:** Knowledge entries render as rich UI components, not just markdown.

**OKF difference:** OKF is static HTML. Neptune adds:
- **MissionCard:** 4-state card (planned/dispatched/active/completed) with progress bar
- **HandoffCard:** Rich card showing V2 coding agent spawn details
- **KnowledgeGraph:** Interactive D3 force-directed graph with hover previews
- **PlaybookView:** Domain-organized with connector status indicators
- All components render from NKS files — the format drives the UI

---

## 8. REFERENCE IMPLEMENTATIONS

### 8.1 Neptune Chat (`/home/neptune/neptune-chat/`)

The primary reference implementation of NKS. Demonstrates:
- Full NKS directory structure under `cortex/`
- `/knowledge` route with Twin View
- `/admin/roadmap` route with phase tracker
- Knowledge router that loads skills and playbooks at runtime
- OKF export and verification scripts

### 8.2 V2 Coding Agent (`apps/web/`)

Demonstrates:
- Coding agent reads NKS for context before generating code
- Knowledge loader (`lib/knowledge/load-okf-bundle.ts`)
- Skill-author capability (writes NKS-conformant files)
- Graphify integration for code knowledge retrieval

### 8.3 Twenty CRM Extensions (`twenty-newleaf-extensions/`)

Demonstrates:
- Custom objects defined with NKS-playbook alignment
- AI Customer Summary component reads from NKS
- Workflow code nodes use NKS playbook context

### 8.4 OKF Export Script (`scripts/knowledge-layer/okf-export.ts`)

Demonstrates:
- Walking the NKS directory tree
- Stripping Neptune extensions
- Generating pure OKF bundles
- Validating output against OKF v0.1 spec

---

## 9. OKF EXPORT PROTOCOL

### 9.1 Export Process

```
1. Walk cortex/ tree
2. For each .md file:
   a. Parse YAML frontmatter
   b. Strip Neptune-extended fields (domain, mcp, custom_client, budget, eta, dependencies, etc.)
   c. Keep OKF fields (type, name, description, version, tags)
   d. Remove Neptune-specific directories (architecture/, code-patterns/, operational/, workflows/)
   e. Convert all links to relative within the bundle
3. Generate bundle index.md with only OKF-recognized types
4. Write output to /tmp/okf-bundle/
5. Verify bundle against OKF v0.1 schema
```

### 9.2 Stripped Fields (Neptune-Extended Only)

| Field | Reason Stripped |
|-------|----------------|
| `domain` | OKF has no domain concept |
| `mcp` | OKF has no MCP integration |
| `custom_client` | OKF has no client concept |
| `budget` | OKF has no budget tracking |
| `eta` | OKF has no timeline |
| `dependencies` | OKF links are implicit |
| `status` | OKF has no lifecycle |
| `owner` | OKF has no ownership |
| `session_id` | OKF has no session tracking |
| `prd_ref` | OKF has no PRD linking |
| `persistence` | OKF has no memory system |
| `scope` | OKF has no scoping |
| `refs` | OKF links are inline |
| `connectors` | OKF has no connector concept |
| `skills` (in playbook) | OKF has no skill linking |
| `workflows` (in playbook) | OKF has no workflow linking |
| `functions` | OKF has no function linking |
| `sources` (in research) | OKF has no source tracking |
| `summary` (in research) | OKF has no summary field |

### 9.3 Preserved Fields

| Field | Reason Preserved |
|-------|-----------------|
| `type` | Required by OKF |
| `name` | Required by OKF |
| `description` | Required by OKF |
| `version` | Recommended by OKF |
| `tags` | Recommended by OKF |

---

## 10. MIGRATION GUIDE

### 10.1 Migrating Existing Skills to NKS

**Current state:**
```
jarvis/cortex/skills/<skill-name>.md  (flat files)
```

**Target state:**
```
cortex/skills/<skill-name>/
  ├── SKILL.md         (renamed from <skill-name>.md)
  ├── index.md         (NEW)
  ├── log.md           (NEW)
  ├── architecture/    (optional)
  ├── code-patterns/   (optional)
  ├── operational/     (optional)
  └── knowledge-base/  (optional)
```

**Migration steps:**
1. `mkdir cortex/skills/<skill-name>/`
2. `mv cortex/skills/<skill-name>.md cortex/skills/<skill-name>/SKILL.md`
3. Add `type: skill` and other frontmatter
4. Run `add-index-md.ts` to generate index.md
5. Run `add-log-md.ts` to generate log.md from git history

### 10.2 Migrating Playbooks

**Current state:**
```
playbooks/<domain>/playbook-<domain>.md
```

**Target state:**
```
cortex/playbooks/<domain>/
  ├── playbook.md      (renamed)
  ├── index.md         (NEW)
  ├── log.md           (NEW)
  ├── manifest.yaml    (NEW)
  ├── connectors/      (NEW)
  ├── skills/          (NEW)
  ├── functions/       (NEW)
  └── workflows/       (NEW)
```

### 10.3 Automated Migration

```bash
# Run the full migration script
pnpm tsx scripts/knowledge-layer/add-type-field.ts
pnpm tsx scripts/knowledge-layer/add-index-md.ts
pnpm tsx scripts/knowledge-layer/add-log-md.ts

# Verify NKS conformance
pnpm tsx scripts/knowledge-layer/okf-verify.ts
```

---

## 11. GOVERNANCE

### 11.1 Version Policy

- **MAJOR:** Breaking changes to NKS spec (incompatible with prior version's files).
- **MINOR:** New optional fields, new extensions, new file types. Backward compatible.
- **PATCH:** Clarifications, typo fixes, documentation improvements.

### 11.2 Spec Maintenance

- **Owner:** abhiswami2121@gmail.com
- **Repo:** github.com/abhiswami2121/neptune-knowledge-spec (Phase 36)
- **Changes:** PR with spec diff + migration guide + test update
- **Review:** At least one human review required for MAJOR/MINOR changes

### 11.3 Compliance Levels

| Level | Requirements |
|-------|-------------|
| **OKF Compatible** | File has `type` and `name` in frontmatter. Links use relative markdown. |
| **NKS Conformant** | All OKF Compatible + Neptune-required fields (`description`, `version`, `tags`). Directory has `index.md`. Domain has `log.md`. |
| **NKS Complete** | All NKS Conformant + Neptune-extended fields filled + all optional directories present + link verification passes. |

### 11.4 CI/CD Integration

```yaml
# .github/workflows/nks-verify.yml
name: NKS Verification
on: [push, pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm tsx scripts/knowledge-layer/okf-verify.ts
      - run: pnpm tsx scripts/knowledge-layer/okf-export.ts --verify-only
```

---

## 12. APPENDIX: FULL SCHEMA

### 12.1 SKILL.md Schema

```yaml
# Required
name: string              # Human-readable skill name
type: "skill"             # Always "skill"
description: string       # One-paragraph description (max 500 chars)

# Recommended
version: string           # Semver, e.g. "2.3.0"
tags: list[string]        # Search tags, lowercase kebab-case

# Neptune Extensions
domain: string            # Primary domain (billing-flow, credit-disputes, etc.)
mcp: string               # Comma-separated MCP server names
custom_client: boolean    # Whether skill needs custom API client
```

### 12.2 Playbook Schema

```yaml
# Required
name: string              # Human-readable playbook name
type: "playbook"          # Always "playbook"
description: string       # One-paragraph description

# Recommended
version: string           # Semver
tags: list[string]

# Neptune Extensions
domain: string            # Domain identifier
connectors: list[string]  # External service names
skills: list[string]      # Linked skill names
workflows: list[string]   # Linked n8n workflow names
functions: list[string]   # Serverless function names
```

### 12.3 PRD Schema

```yaml
# Required
name: string
type: "prd"
description: string

# Recommended
version: string
tags: list[string]

# Neptune Extensions
status: string            # planned | in_progress | review | completed | archived
owner: string             # Agent or human responsible
budget: number            # Estimated tool call budget
eta: string               # ISO date or relative
dependencies: list[string]# PRD or system dependencies
```

### 12.4 Mission Schema

```yaml
# Required
name: string
type: "mission"
description: string

# Recommended
version: string
tags: list[string]

# Neptune Extensions
prd_ref: string           # Parent PRD name
session_id: string        # Unique session identifier
budget: number            # Tool call budget
status: string            # planned | dispatched | in_progress | completed | failed
```

### 12.5 Research Schema

```yaml
# Required
name: string
type: "research"
description: string

# Recommended
version: string
tags: list[string]

# Neptune Extensions
sources: list[string]     # URLs, files, references
summary: string           # One-paragraph executive summary
```

### 12.6 Memory Schema

```yaml
# Required
name: string
type: "memory"
description: string

# Recommended
version: string
tags: list[string]

# Neptune Extensions
persistence: string       # permanent | session
scope: string             # global | user
refs: list[string]        # Related document paths
```

### 12.7 Index Schema

```yaml
# Required
name: string              # Directory name
type: "index"             # Always "index"
description: string       # "Index of <directory name>"

# All other fields optional
```

### 12.8 Log Schema

```yaml
# Required
name: string              # Directory name + "Changelog"
type: "log"               # Always "log"
description: string       # "Changelog for <directory name>"

# All other fields optional
```

---

## END OF SPECIFICATION

**Version:** 1.0.0  
**Total Extensions Beyond OKF v0.1:** 10  
**OKF Compatibility:** 100% Read, 100% Write (via export)  
**Reference Implementation:** Neptune Chat + V2 + Twenty CRM  
**Next Spec Version:** TBD (community feedback driven)  

---

*"The file system is the graph. The format is the contract. The agent is the consumer. The human is the governor."*

— Neptune Knowledge Spec v1.0, June 17, 2026
