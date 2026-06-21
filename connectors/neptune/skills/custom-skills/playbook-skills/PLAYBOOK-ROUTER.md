---
type: "playbook"
name: "PLAYBOOK ROUTER"
description: "Auto-generated description for PLAYBOOK ROUTER"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# PLAYBOOK ROUTER — The Master Index (Phase 24)
# Neptune Chat Playbook-First Architecture

> **Version:** 24.0.0 | **Date:** 2026-06-16 | **Status:** CANONICAL
> **Architecture:** Playbook-First Platform (Chat + KG + V2)
> **Role:** THE file every agent MUST read FIRST on every message. No exceptions.

---

## How This Platform Works

Neptune Chat is a **playbook-first AI operations platform** consisting of three integrated systems:

1. **Chat (Discovery & Workflow):** The conversational interface. Every user message is matched against this router, the appropriate playbook is loaded, and the playbook's SOP guides execution. Chat = intent routing + SOP execution + outcome annotation.

2. **V2 (Coding & Refactoring):** A specialized coding agent with full repo access, multi-file editing, sandbox execution, and long-running task capabilities. V2 is invoked via **handoff triggers** — not every coding task goes to V2, but tasks exceeding complexity thresholds do.

3. **KG (Knowledge Graph — Your Brain):** A graph database (Neo4j/Cortex) that stores connectors, playbooks, panels, V2 handoffs, and models as nodes. Edges represent relationships: `uses`, `pairs_with`, `succeeded_in`, `depends_on`. Every interaction enriches the KG. The KG is the **source of truth for intent matching** — not training data.

### The Playbook-First Promise

- **Every tool call flows through a playbook.** No ad-hoc tool usage.
- **Every playbook declares its requirements.** connectors, skills, functions, workflows — all in manifest.yaml.
- **Every execution is annotated.** Outcomes, errors, and learnings flow back to the playbook.
- **The router IS the map.** No need to grep the filesystem — this document tells you where everything lives.

---

## The Knowledge Graph (Your Brain)

The KG is a graph database where every architectural component is a node, and every relationship is an edge.

### Node Types
| Node Type | Examples | Description |
|-----------|----------|-------------|
| **Connector** | nmi, slack, github, base44 | External service integrations |
| **Playbook** | billing, disputes, deploy | Domain SOP documents |
| **Panel** | billing-dashboard, dispute-tracker | UI panels paired with playbooks |
| **V2 Handoff** | multi-file-refactor, deploy-pipeline | When Chat hands off to V2 |
| **Model** | claude-sonnet-4, deepseek-v4 | AI models available for routing |
| **Skill** | ai-agent-sdk, spreadsheet-creator | Reusable agent capabilities |
| **Function** | charge-customer, create-ticket | Individual callable functions |
| **Workflow** | intent-routing, deploy-pipeline | Multi-step automated flows |

### Edge Types
| Edge | Meaning | Example |
|------|---------|---------|
| `uses` | Playbook/function uses a connector | `billing` --uses--> `nmi` |
| `pairs_with` | Panel is paired with a playbook | `dispute-tracker` --pairs_with--> `disputes` |
| `succeeded_in` | A model succeeds at a task type | `claude-sonnet-4` --succeeded_in--> `billing-charge` |
| `depends_on` | A component requires another | `payment-reminders` --depends_on--> `nmi` |
| `handsoff_to` | Chat hands off to V2 for a domain | `engineering` --handsoff_to--> `V2` |

### KG Query Rule (CARDINAL)
**Always query the KG for intent matching, never rely on training data.** The KG reflects the current state of the system. Training data is stale. Run `query_code_graph` or `query_cortex_graph` before making routing decisions.

---

## Discovery Flow (3 Steps)

```
User Message
    │
    ▼
Step 1: Read THIS Router First
    Always. Before any tool call. Before any KG query.
    This is the canonical map of all 17 playbooks.
    │
    ▼
Step 2: Match Intent → Playbook
    Query the KG with the user's message.
    Get back a playbook with a confidence score.
    Route to the highest-confidence playbook above threshold.
    │
    ▼
Step 3: Load Playbook → Execute SOP
    Read the playbook's PRE-CHECK KNOWLEDGE section.
    Read the playbook's Safeguards section.
    Execute the playbook's Routines in order.
    Annotate the outcome back to the playbook.
```

### Routing Priority
1. **P0 (Critical):** billing, disputes, customer-support — money, legal, or customer trust at stake
2. **P1 (High):** deploy, engineering, agent-orchestration, reporting, vps-ops, vercel-discipline
3. **P2 (Standard):** planning, marketing, hr, sales, video-generation
4. **P2 (Fallback):** other — orphan catcher for unclassified intents

---

## V2 Handoff Triggers

Not every coding task goes to V2. Chat handles simple edits. V2 handles complex work.

### Hand Off to V2 When:
| Trigger | Threshold | Example |
|---------|-----------|---------|
| Multi-file code changes | 3+ files touched | Refactoring auth across 5 files |
| Bug fix requiring repo access | Deep investigation needed | Tracing a bug through 3 services |
| Feature build | > 100 lines of new code | Building a new API endpoint |
| Long-running refactor | > 5 minutes estimated | Migrating from REST to GraphQL |
| Deploy pipeline work | Production deployment | Merging to main, creating release |

### Keep in Chat When:
| Trigger | Example |
|---------|---------|
| Single-file edit | Fixing a typo in one component |
| Configuration change | Updating an env var |
| Playbook/SOP work | Editing playbook files, manifests |
| Research/Planning | Writing PRDs, doing research |
| Data queries | Querying Base44, reporting hub |

---

## All Available Playbooks (17)

| # | Playbook | Priority | Intent Triggers | Connectors Used | V2 Handoff? |
|---|----------|----------|-----------------|-----------------|-------------|
| 1 | **billing** | P0 | "charge", "payment", "NMI", "subscription", "invoice", "refund", "billing link", "decline", "CVV", "card on file", "vault", "hyperswitch", "recurring" | nmi, hyperswitch, base44, slack | Sometimes |
| 2 | **customer-support** | P0 | "ticket", "customer issue", "support", "help with", "customer 360", "look up customer", "complaint", "chargeback", "account access", "where's my" | base44, slack, vapi | Sometimes |
| 3 | **disputes** | P0 | "dispute", "credit report", "FCRA", "bureau", "Equifax", "Experian", "TransUnion", "remove from credit", "fix credit", "draft letter" | forth, base44, slack, affy | Sometimes |
| 4 | **planning** | P2 | "plan", "PRD", "TRD", "roadmap", "phase", "spec", "research", "gap analysis", "architecture diagram", "mission", "dispatch", "implementation plan", "synthesize" | github, base44, wiki, slack, neptune | Sometimes |
| 5 | **deploy** | P1 | "deploy", "ship", "release", "merge", "PR", "pull request", "rollback", "stale UI", "push to prod" | github, vercel, slack | Often |
| 6 | **engineering** | P1 | "code", "refactor", "build", "repo", "debug", "bug", "error", "review", "implement", "edit file", "fix code" | github, vercel, base44 | Often |
| 7 | **agent-orchestration** | P1 | "dispatch", "multi-agent", "parallel agents", "agent status", "spawn", "handoff", "sandbox", "V2", "task delegation" | neptune, slack | Sometimes |
| 8 | **reporting** | P1 | "report", "dashboard", "analytics", "metrics", "morning pulse", "daily summary", "MRR", "churn", "funnel", "sync health", "stats" | base44, slack | Rarely |
| 9 | **vps-ops** | P1 | "VPS", "server", "nginx", "pm2", "hostinger", "health check", "crash", "outage", "SSL", "certificate", "logs", "incident" | neptune | Rarely |
| 10 | **vercel-discipline** | P1 | "Vercel", "deploy rules", "preview", "domain", "env vars", "security headers", "edge", "build status" | vercel, github | Sometimes |
| 11 | **marketing** | P2 | "campaign", "email blast", "outreach", "lead nurture", "SMS", "DNC", "broadcast", "dialer", "automation sequence" | ghl, slack, base44 | Rarely |
| 12 | **hr** | P2 | "hire", "interview", "onboarding", "team status", "agent availability", "compliance training", "staffing" | slack, linear | Rarely |
| 13 | **sales** | P2 | "deal", "pipeline", "lead", "close", "CRM", "lead qualification", "prospect", "enrollment funnel", "opportunity" | ghl, base44, slack | Rarely |
| 14 | **video-generation** | P2 | "video", "notebooklm", "generate video", "podcast", "edit video", "script to video", "AI video" | neptune | Rarely |
| 15 | **other** | P2 | "fun", "random", "utility", "misc", "experimental", "unknown", "unclassified", catch-all | cat-facts, affy | Sometimes |
| 16 | **loop-engineering** | P1 | "loop", "ralph", "paul", "long-running", "sprint", "coding loop", "iterate until done", "autonomous agent", "agent loop", "fix loop" | slack, base44 | Sometimes |
| 17 | **twenty-crm** | P0 | "twenty", "crm", "workspace", "custom object", "sales pipeline", "contact", "opportunity", "client record", "twenty workflow", "twenty function", "defineObject", "logic function", "webhook", "custom field", "GraphQL", "API key", "role", "permission", "app publish", "self-host", "newleaf crm", "payment record", "subscription", "credit dispute", "enrollment" | twenty, postgres, redis, nmi, hyperswitch, slack, ghl | Rarely |
| 18 | **hermes-vps** | P0 | "send to vps", "dispatch to vps", "send prd to vps", "run on vps", "fix on vps", "quick fix vps", "vps please", "execute on vps", "send this task", "kick off mission" | base44, slack | Never — this IS the handoff |

---

## Always-Check Rules (Before ANY Tool Call)

```
[ ] 1. Read THIS router FIRST — before any tool call, before any KG query
[ ] 2. Match intent via KG query, not training data — use query_cortex_graph
[ ] 3. Load the playbook SOP before executing — read PRE-CHECK KNOWLEDGE section
[ ] 4. Read Safeguards before any tool call — each playbook has domain-specific rules
[ ] 5. Respect Anti-Patterns — if a playbook says "NEVER do X," you NEVER do X
[ ] 6. Annotate outcome + learning after execution — update the playbook's Refinement Notes
[ ] 7. ONE playbook at a time — pick based on dominant intent, complete before switching
[ ] 8. Run validate-playbooks.ts after any playbook edit — keep the architecture clean
[ ] 9. Check V2 handoff triggers — if task meets threshold, hand off to V2
[ ] 10. Never grep tools directly — the playbook tells you EXACTLY what to use
```

---

## Cardinal Rules (LOCKED — NEVER VIOLATE)

### Architecture Rules
1. **PLAYBOOK-ROUTER.md is THE entry point.** Read it FIRST on every user message. No exceptions.
2. **ONE playbook at a time.** Pick based on dominant intent. Complete before switching domains.
3. **NEVER grep tools directly.** The playbook tells you what connectors, skills, functions, and workflows to use.
4. **Safeguards BEFORE execution.** Read the playbook's Safeguards section before any tool call.
5. **Anti-patterns are law.** If a playbook says "NEVER do X," you NEVER do X — no matter what the user asks.
6. **KG for routing, not training data.** Always query `query_cortex_graph` or `query_code_graph` for intent matching.
7. **Annotate after execution.** Every playbook execution must update the playbook's Refinement Notes with outcome, duration, errors, and learnings.

### Operational Rules
8. **Slack #jarvis-admin ONLY.** Never post to newleaf-admin.
9. **NEVER real customer data** in test/smoke scenarios.
10. **Commit author:** abhiswami2121 <abhiswami2121@gmail.com>.
11. **NEVER cancel other agent sessions.**
12. **Pattern A+1:** Only 7 tools (the 6 gatekeepers + run_workflow). No additional tool discovery.
13. **Vercel REST API only** — never use Vercel CLI on VPS.
14. **NEVER edit VPS Python scripts or pm2 reload** (cardinal 6a153d63).

### Phase 24 Rules
15. **Validate after every playbook edit.** Run `pnpm run playbooks:validate` before committing.
16. **Manifest completeness required.** Every playbook must have: playbook name, version, description, and requires section with connectors/skills/functions/workflows arrays.
17. **Patterns.md required for P0/P1 playbooks.** Extract always-check rules and anti-patterns into stand-alone patterns.md.
18. **Custom-knowledge.md required for P0 playbooks.** Business-specific knowledge (doctrines, error codes, compliance rules) lives here.
19. **V2 handoff conscious.** Evaluate whether the task exceeds Chat's threshold before executing.
20. **Router is self-documenting.** When playbooks change, this router MUST be updated.

---

## Playbook File Paths (Quick Reference)

```
playbook-skills/playbooks/
├── billing/playbook-billing.md                       (P0 — Payments & Billing)
├── customer-support/playbook-support.md              (P0 — Customer Support & Triage)
├── disputes/playbook-disputes.md                     (P0 — Credit Disputes & FCRA)
├── planning/playbook-planning.md                     (P0 — Planning & Research)
├── deploy/playbook-deploy.md                         (P1 — Deploy & Ship)
├── engineering/playbook-engineering.md               (P1 — Engineering & Code)
├── agent-orchestration/playbook-agent-orchestration.md (P1 — Agent Orchestration)
├── reporting/playbook-reporting.md                   (P1 — Reporting & Analytics)
├── vps-ops/playbook-vps-ops.md                       (P1 — VPS Operations)
├── vercel-discipline/playbook-vercel-discipline.md     (P1 — Vercel Discipline)
├── marketing/playbook-marketing.md                   (P2 — Marketing & Leads)
├── hr/playbook-hr.md                                 (P2 — HR & Team)
├── sales/playbook-sales.md                           (P2 — Sales & Pipeline)
├── video-generation/playbook-video-generation.md     (P2 — Video Generation)
├── other/playbook-other.md                           (P2 — Fallback: Orphan Catcher)
└── loop-engineering/playbook-loop-engineering.md     (P1 — Loop Engineering: Ralph & Paul)
```

---

## Connector Skills Library (NEW — Phase 24)

All connector technical documentation lives in `connector-skills/` — a dedicated folder inside playbook-skills. Each connector has a standardized 5-file structure that enables the Universal Connector Card framework.

### Structure
```
playbook-skills/connector-skills/
├── nmi/              (💳 Payment Gateway — P0)
├── slack/            (💬 Communication — P0)
├── ghl/              (📊 CRM + Marketing — P1)
├── vapi/             (📞 Voice AI — P1)
├── hyperswitch/      (🔄 Alt Payment Gateway — P1)
├── freshcaller/      (🎧 Call Center — P2)
├── forth-dpp/        (⚖️ Credit Disputes — P0)
├── base44/           (🗄️ Internal Data Platform — P0)
├── github/           (🐙 Repository Operations — P1)
├── vercel/           (☁️ Deployments — P1)
├── hostinger-vps/    (🖥️ Server Management — P1)
├── hermes-vps/       (⚡ Quick VPS Claude SDK Dispatch — P0)
└── resend/           (✉️ Email Delivery — P2)
```

### Per-Connector Files (7 files each)
| File | Purpose |
|------|---------|
| `skill.md` | Purpose, when-to-use, env vars, patterns, cross-refs |
| `playbook.md` | Operational SOP, safeguards, self-healing notes |
| `functions.yaml` | Available function calls, parameters, return shapes |
| `ui-schema.yaml` | Universal Connector Card visual config (icon, accentColor, keyFields, expandedLayout) |
| `patterns.md` | Always-check rules, success patterns |
| `anti-patterns.md` | BANNED operations, common mistakes |
| `tools.yaml` | Legacy tool definitions (deprecated in favor of functions.yaml) |

### Playbook → Connector-Skill Dependency Map
| Playbook | Connector Skills Used |
|----------|----------------------|
| billing | nmi, hyperswitch, base44, slack |
| customer-support | base44, slack, vapi, freshcaller |
| disputes | forth-dpp, base44, slack |
| planning | base44, slack, github |
| deploy | github, vercel, slack |
| engineering | github, vercel, base44 |
| agent-orchestration | slack |
| reporting | base44, slack |
| sales | ghl, base44, slack |
| marketing | ghl, slack, base44 |
| vps-ops | hostinger-vps |
| vercel-discipline | vercel, github |
| video-generation | (neptune-native) |
| hr | slack |
| lead-flow | ghl, base44, resend |
| compliance-audit | base44, forth-dpp |
| mcp-edits | github |
| hermes-vps | base44, slack |

### How to Add a New Connector
1. Create folder: `connector-skills/<name>/`
2. Add 5 files: `skill.md`, `tools.yaml`, `patterns.md`, `anti-patterns.md`, `layout.json`
3. Define `layout.json` with at least 1 cardType following schema
4. Register in `lib/connectors/layouts.ts` (auto-discovered via fs.readdirSync)
5. UniversalConnectorCard auto-renders — zero React code needed

---

*End of PLAYBOOK-ROUTER.md — Phase 24. Load your playbook now.*
