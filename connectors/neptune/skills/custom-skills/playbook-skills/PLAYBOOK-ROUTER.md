# PLAYBOOK-ROUTER.md — Single Entry Point for ALL Agent Operations

> **Version:** 2.0.0 | **Date:** 2026-06-15 | **Status:** ACTIVE
> **Architecture:** Fractal Library + Router-as-Map (Phase 21 V3)
> **Role:** THE file every agent reads FIRST on every user message. Do not bypass.
> **Canonical:** `connectors/neptune/skills/custom-skills/playbook-skills/PLAYBOOK-ROUTER.md`

---

## FRACTAL LIBRARY MAP (Self-Documenting Tree)

```
neptune-chat/                                          [ROOT]
│
├── NEPTUNE.md                                         ← Runtime persona
│
├── connectors/                                        [EXTERNAL CAPABILITIES]
│   ├── nmi/ | slack/ | linear/ | ghl/ | base44/
│   ├── github/ | vercel/ | wiki/ | forth/ | affy/ | mcp-hub/
│   │
│   └── neptune/                                       [AGENT-AS-CONNECTOR] ⭐
│       └── skills/
│           ├── native-agent-skills/
│           │   └── ai-agent-sdk/
│           │       └── functions/   (read, write, bash, edit)
│           │
│           └── custom-skills/
│               ├── opendesign/      (UI design)
│               ├── spreadsheet-creator/ (reports)
│               └── playbook-skills/ ⭐ THE META-SKILL
│                   │
│                   ├── PLAYBOOK-ROUTER.md ← YOU ARE HERE
│                   │
│                   ├── functions/
│                   │   ├── route-intent.ts
│                   │   ├── create-playbook.ts
│                   │   ├── update-playbook.ts
│                   │   ├── organize-knowledge-graph.ts
│                   │   ├── session-start-handler.ts
│                   │   └── session-end-handler.ts
│                   │
│                   ├── playbooks/  ⭐ ALL BUSINESS PLAYBOOKS
│                   │   ├── playbook-billing.md     (P0)
│                   │   ├── playbook-support.md     (P0)
│                   │   ├── playbook-disputes.md    (P0)
│                   │   ├── playbook-planning.md    (P0)
│                   │   ├── playbook-engineering.md (P1)
│                   │   ├── playbook-reporting.md   (P1)
│                   │   ├── playbook-deploy.md      (P1)
│                   │   ├── playbook-vercel-discipline.md (P1)
│                   │   ├── playbook-vps-ops.md     (P1)
│                   │   ├── playbook-agent-orchestration.md (P1)
│                   │   ├── playbook-marketing.md   (P2)
│                   │   ├── playbook-hr.md          (P2)
│                   │   ├── playbook-sales.md       (P2)
│                   │   ├── playbook-video-generation.md (P2)
│                   │   ├── playbook-newleaf.md     (ORG)
│                   │   └── playbook-index.md       (META)
│                   │
│                   └── workflows/
│                       ├── intent-routing.workflow.ts
│                       └── session-end-logger.workflow.ts
│
└── docs/playbook-architecture/  [THE KB PROJECT]
    ├── README.md
    ├── 00-foundations.md
    ├── 01-connectors-catalog.md
    ├── 02-skills-catalog.md
    ├── 03-functions-catalog.md
    ├── 04-workflows-catalog.md
    ├── 05-playbooks-catalog.md
    ├── 06-cross-reference-matrix.md
    ├── 07-redundancy-analysis.md
    ├── 08-gap-analysis.md
    ├── 09-self-evolution-flow.md
    ├── 10-portability-guide.md
    └── 11-bootstrap-new-org.md
```

## FRACTAL PATTERN (Sacred)

Every Skill is a **mini-library** with identical shape to the top-level library:

```
Top-level:           connectors/   +   playbooks/   +   workflows/
                      ↕                  ↕                  ↕
Skill-level:        functions/    +   playbooks/   +   workflows/
```

**FRACTAL TRUTH:** A Skill mirrors the whole library. Functions always live within a Skill, never standalone. `playbook-skills` is THE meta-skill containing all business playbooks.

---

## PORTABILITY PATTERN (Twin View Architecture)

**VIEW A — Library View (Canonical):**
This file IS the library. All playbooks, functions, and workflows live here in `playbook-skills/`. This is the single source of truth. All edits happen here. The router contains the complete fractal MAP.

**VIEW B — Portable Package View (Snapshot):**
Copy the entire `playbook-skills/` folder and you get:
- ALL 16 playbooks (with manifest.yaml stubs)
- ALL 6 functions (route-intent, create-playbook, etc.)
- ALL 2 workflows (intent-routing, session-end-logger)
- The complete router with inline MAP
- Root `manifest.yaml` declaring all requirements

Anyone can bootstrap a new org by copying ONE folder. The package is a SNAPSHOT from the canonical library — it doesn't auto-sync. For updates, re-copy from canonical or run `create-playbook` to scaffold fresh.

**KEY INSIGHT:** "Anybody could just copy this one playbook-skills folder, and it comes with all my playbooks AND all the connectors AND all the skills AND functions — it's almost like a portable library." — Abhi

## CARDINAL RULE #1: READ THIS FILE FIRST

On EVERY user message, your FIRST action is to read this router. Match the user's dominant intent to one playbook. Load that playbook. Execute its SOP. NEVER grep tools or browse the filesystem directly without going through this router.

## CARDINAL RULE #2: ONE PLAYBOOK AT A TIME

Pick the ONE playbook that best matches the user's dominant intent. NEVER load multiple playbooks at once. If the user asks about multiple domains, handle the primary intent first, then ask about the secondary.

## CARDINAL RULE #3: NEVER GREP TOOLS DIRECTLY

Do NOT search for tools, skills, or functions by grepping the filesystem. The playbook you load tells you EXACTLY which connectors, skills, and functions to use. Trust the playbook.

---

## INTENT → PLAYBOOK MAP (98+ Routes)

### P0: BILLING & PAYMENTS (Money Movement)

| # | User Intent | Trigger Keywords | Playbook | Why |
|---|------------|-----------------|----------|-----|
| 1 | Charge a customer | charge, bill, payment, collect, run card, process, transaction | `playbook-skills/playbooks/playbook-billing.md` | NMI vault + CIT/MIT rules |
| 2 | Refund a customer | refund, return money, reverse charge, give back | `playbook-skills/playbooks/playbook-billing.md` | Requires original txn verification |
| 3 | Check payment status | did payment go through, charge status, txn lookup, verify payment | `playbook-skills/playbooks/playbook-billing.md` | NMI transaction_query |
| 4 | Recover declined card | decline, failed, insufficient funds, do not honor, card declined | `playbook-skills/playbooks/playbook-billing.md` | Smart Retry Engine + billing link |
| 5 | Create billing link | billing link, pay now, update card, new payment, Collect.js | `playbook-skills/playbooks/playbook-billing.md` | NMI Collect.js + vault create |
| 6 | Manage subscriptions | subscription, recurring, cancel sub, pause, resume, next charge | `playbook-skills/playbooks/playbook-billing.md` | NMI subscription CRUD |
| 7 | Vault health check | vault check, CoF health, card on file, vault audit, vanished vault | `playbook-skills/playbooks/playbook-billing.md` | Golden Vault architecture |
| 8 | Fix billing chain | broken chain, orphan sub, ghost CRM, billing recon, missing sub | `playbook-skills/playbooks/playbook-billing.md` | 123-124 broken chains tracked |
| 9 | Payment date change | reschedule, change date, payment date, move charge | `playbook-skills/playbooks/playbook-billing.md` | NMI subscription date sync |
| 10 | CVV/billing error | cvv mismatch, 225, card error, validation, config decline | `playbook-skills/playbooks/playbook-billing.md` | CVV token pass-through fix |
| 11 | NMI operations | nmi, network token, DPAN, customer vault, merchant initiated | `playbook-skills/playbooks/playbook-billing.md` | NMI connector mastery |
| 12 | Hyperswitch payments | hyperswitch, newleaf-pay, payment routes, gateway | `playbook-skills/playbooks/playbook-billing.md` | Hyperswitch connector |

### P0: CUSTOMER SUPPORT & TRIAGE (Human Safety Net)

| # | User Intent | Trigger Keywords | Playbook | Why |
|---|------------|-----------------|----------|-----|
| 13 | Customer 360 lookup | customer 360, look up, who is, check on, pull up, find customer, account | `playbook-skills/playbooks/playbook-support.md` | Full cross-system dossier |
| 14 | Create support ticket | ticket, create ticket, open issue, support request, help ticket | `playbook-skills/playbooks/playbook-support.md` | SupportTicket entity |
| 15 | Triage a ticket | triage, classify, route, assign, priority, sla | `playbook-skills/playbooks/playbook-support.md` | SLA tracking (4h critical) |
| 16 | Resolve a ticket | resolve, close ticket, fix issue, ticket done | `playbook-skills/playbooks/playbook-support.md` | Resolution + 48h cooldown |
| 17 | Chargeback risk | chargeback, unauthorized, didn't authorize, bank shut down | `playbook-skills/playbooks/playbook-support.md` | P0 escalation → disputes |
| 18 | Customer complaint | complaint, angry, frustrated, unhappy, mad | `playbook-skills/playbooks/playbook-support.md` | Sentiment + escalation |
| 19 | General customer inquiry | question, ask, how do I, what is, explain to customer | `playbook-skills/playbooks/playbook-support.md` | First-line support |

### P0: DISPUTES & FCRA COMPLIANCE

| # | User Intent | Trigger Keywords | Playbook | Why |
|---|------------|-----------------|----------|-----|
| 20 | Start dispute round | dispute, challenge, remove from credit, fix credit, delete item | `playbook-skills/playbooks/playbook-disputes.md` | FCRA 30-day clock |
| 21 | Track dispute response | dispute status, bureau response, what happened with, responded | `playbook-skills/playbooks/playbook-disputes.md` | Response tracking mandatory |
| 22 | Prepare dispute letter | draft letter, write dispute, bureau letter, fcRA letter | `playbook-skills/playbooks/playbook-disputes.md` | Forth letter generation |
| 23 | Round 2 dispute | round 2, second dispute, escalated, reinvestigation | `playbook-skills/playbooks/playbook-disputes.md` | Supervisor review required |
| 24 | Credit report review | credit report, pull report, check credit, score, negative items | `playbook-skills/playbooks/playbook-disputes.md` | NegativeItem identification |
| 25 | FCRA compliance check | fcra, compliance, statutory, deadline, violation | `playbook-skills/playbooks/playbook-disputes.md` | 30/45-day statutory windows |

### P0: PLANNING & RESEARCH (Primary User Domain)

| # | User Intent | Trigger Keywords | Playbook | Why |
|---|------------|-----------------|----------|-----|
| 26 | Write a PRD | write prd, create prd, product requirement, spec out, document requirements, prd for, feature spec, requirement doc | `playbook-skills/playbooks/playbook-planning.md` | 12-section PRD template + research |
| 27 | Draft a TRD | draft trd, write trd, technical design, architecture doc, design document, system design, technical spec, tech spec | `playbook-skills/playbooks/playbook-planning.md` | C4 diagrams + OpenAPI contracts |
| 28 | Create implementation plan | implementation plan, impl plan, build plan, execution plan, sprint plan, phase plan, roadmap, project plan | `playbook-skills/playbooks/playbook-planning.md` | Phases + budgets + dependency graph |
| 29 | Deep research | research, investigate, explore, compare, state of, deep dive, learn about, background on, survey | `playbook-skills/playbooks/playbook-planning.md` | 5-source parallel research engine |
| 30 | Gap analysis | gap analysis, gap, what is missing, audit, compare current vs target, delta, discrepancy | `playbook-skills/playbooks/playbook-planning.md` | 8-dimension systematic diff |
| 31 | Plan mode (multi-phase gate) | plan mode, approve plan, review plan, multi-phase, complex task, large plan | `playbook-skills/playbooks/playbook-planning.md` | Auto-detect >=3 phases, approval gate |
| 32 | Mission dispatch | dispatch mission, create mission, start mission, launch task, mission, deploy mission | `playbook-skills/playbooks/playbook-planning.md` | YAML mission + hybridDispatch |
| 33 | Architecture diagram | diagram, architecture diagram, flowchart, sequence diagram, mermaid, visualize, draw, illustrate | `playbook-skills/playbooks/playbook-planning.md` | 8 Mermaid diagram types |
| 34 | Extract cardinal rules | cardinal rules, locked rules, constraints, rules to follow, what rules apply, governing rules | `playbook-skills/playbooks/playbook-planning.md` | Pull from memory + cortex |
| 35 | Synthesize sources | synthesize, combine, merge, consolidate, summary of, bring together, unify | `playbook-skills/playbooks/playbook-planning.md` | Weighted merge: confidence + recency + relevance |
| 36 | Design workflow | design workflow, create workflow, new workflow, workflow for, build workflow, define workflow | `playbook-skills/playbooks/playbook-planning.md` | YAML scaffolding tool |
| 37 | Save to cortex | save this, persist, store, archive, keep this, remember this, save for later | `playbook-skills/playbooks/playbook-planning.md` | Canonical artifact persistence |
| 38 | Plan review | review plan, check plan, validate plan, plan quality, is this plan good, plan audit | `playbook-skills/playbooks/playbook-planning.md` | Completeness + consistency + feasibility |
| 39 | Full planning pipeline | full plan, end to end plan, complete plan, plan everything, master plan, comprehensive plan | `playbook-skills/playbooks/playbook-planning.md` | PRD → TRD → impl-plan → approve → dispatch |
| 40 | Quick planning scan | quick scan, fast plan, brief overview, plan summary, quick assessment, tl;dr plan | `playbook-skills/playbooks/playbook-planning.md` | Condensed fast-path planning |
| 41 | Research execution | run research, search for, find information, look up research, query research | `playbook-skills/playbooks/playbook-planning.md` | POST /api/research/execute |

### P1: DEPLOY & SHIP (Vercel + GitHub)

| # | User Intent | Trigger Keywords | Playbook | Why |
|---|------------|-----------------|----------|-----|
| 26 | Ship a feature | ship, deploy, land, merge, release, push to prod | `playbook-skills/playbooks/playbook-deploy.md` | Vercel + GitHub PR flow |
| 27 | Create a PR | pr, pull request, open pr, create pr, merge request | `playbook-skills/playbooks/playbook-deploy.md` | GitHub connector PR workflow |
| 28 | Diagnose stale UI | stale, not updating, old version, cache, didn't change | `playbook-skills/playbooks/playbook-deploy.md` | Vercel cache + rebuild |
| 29 | Rollback deployment | rollback, revert, undo deploy, go back, previous version | `playbook-skills/playbooks/playbook-deploy.md` | Vercel rollback |
| 30 | Deploy to Vercel | vercel, deploy to vercel, push live, ship to cloud | `playbook-skills/playbooks/playbook-vercel-discipline.md` | Vercel deployment standards |
| 31 | Check deployment status | is it live, deploy status, build status, vercel check | `playbook-skills/playbooks/playbook-vercel-discipline.md` | Build + deployment verification |
| 32 | Vercel security/config | env vars, vercel config, domain, security headers, edge | `playbook-skills/playbooks/playbook-vercel-discipline.md` | Environment audit |

### P1: ENGINEERING & CODE

| # | User Intent | Trigger Keywords | Playbook | Why |
|---|------------|-----------------|----------|-----|
| 33 | Code review | review, code review, audit code, look at this code | `playbook-skills/playbooks/playbook-engineering.md` | Review patterns + quality gates |
| 34 | Architecture decision | should we, which approach, architecture, design, pattern | `playbook-skills/playbooks/playbook-engineering.md` | ADR process |
| 35 | Write a PRD | write prd, spec out, plan feature, document requirement | `playbook-skills/playbooks/playbook-engineering.md` | PRD template + standards |
| 36 | Refactor code | refactor, clean up, improve, restructure, reorganize | `playbook-skills/playbooks/playbook-engineering.md` | Pattern mapping |
| 37 | Debug an issue | debug, bug, error, not working, broken, crash, why is | `playbook-skills/playbooks/playbook-engineering.md` | Scientific debug method |
| 38 | Build a feature | build, create, implement, add, make, new feature | `playbook-skills/playbooks/playbook-engineering.md` | Feature implementation |
| 39 | MCP/code edit | edit file, fix code, change, modify, update code | `playbook-skills/playbooks/playbook-engineering.md` | MCP edits discipline |

### P1: AGENT ORCHESTRATION

| # | User Intent | Trigger Keywords | Playbook | Why |
|---|------------|-----------------|----------|-----|
| 40 | Dispatch a task | dispatch, send to agent, assign, handoff, delegate | `playbook-skills/playbooks/playbook-agent-orchestration.md` | Agent routing + dispatch |
| 41 | Multi-agent coordination | multi agent, parallel, team, swarm, collaborate | `playbook-skills/playbooks/playbook-agent-orchestration.md` | Cross-agent task delegation |
| 42 | Agent failure recovery | agent failed, retry, stuck, error, dispatch error | `playbook-skills/playbooks/playbook-agent-orchestration.md` | Self-healing after failure |
| 43 | Check agent status | agent status, who is working, what is running, tasks | `playbook-skills/playbooks/playbook-agent-orchestration.md` | Agent availability + load |
| 44 | Spawn coding agent | spawn, v2 sandbox, sandbox, coding agent, handoff to v2 | `playbook-skills/playbooks/playbook-agent-orchestration.md` | V2 E2B sandbox handoff |

### P1: REPORTING & ANALYTICS

| # | User Intent | Trigger Keywords | Playbook | Why |
|---|------------|-----------------|----------|-----|
| 45 | Morning pulse | morning pulse, daily report, today summary, overview | `playbook-skills/playbooks/playbook-reporting.md` | reportingHub.overview |
| 46 | Customer metrics | how many customers, mrr, revenue, churn, growth | `playbook-skills/playbooks/playbook-reporting.md` | Aggregated metrics |
| 47 | Billing recon | billing chain, recon, broken chains, sync health | `playbook-skills/playbooks/playbook-reporting.md` | Hourly chain reconciliation |
| 48 | Agent performance | agent metrics, commissions, performance, sales | `playbook-skills/playbooks/playbook-reporting.md` | Agent KPIs |
| 49 | Sync health audit | sync health, data freshness, warehouse, ingestion | `playbook-skills/playbooks/playbook-reporting.md` | Warehouse + ChromaDB |
| 50 | Enrollment funnel | enrollment stats, funnel, conversion, stuck, pipeline | `playbook-skills/playbooks/playbook-reporting.md` | Enrollment funnel metrics |
| 51 | Create custom report | report, analytics, query, stats, dashboard, metrics | `playbook-skills/playbooks/playbook-reporting.md` | Custom reporting hub queries |

### P1: VPS OPERATIONS

| # | User Intent | Trigger Keywords | Playbook | Why |
|---|------------|-----------------|----------|-----|
| 52 | VPS health check | vps health, server status, system check, cpu, memory | `playbook-skills/playbooks/playbook-vps-ops.md` | pm2 + nginx + Cloudflare |
| 53 | VPS incident response | vps down, server crashed, outage, offline, not responding | `playbook-skills/playbooks/playbook-vps-ops.md` | Incident playbook |
| 54 | Deploy to VPS | vps deploy, update server, restart service, pm2 | `playbook-skills/playbooks/playbook-vps-ops.md` | pm2 + git pull workflow |
| 55 | Check logs | logs, error log, access log, nginx log, pm2 log | `playbook-skills/playbooks/playbook-vps-ops.md` | Log inspection |
| 56 | SSL/certificate | ssl, cert, https, certificate, tls, expired | `playbook-skills/playbooks/playbook-vps-ops.md` | Certbot + Cloudflare |

### P2: MARKETING & LEAD FLOW

| # | User Intent | Trigger Keywords | Playbook | Why |
|---|------------|-----------------|----------|-----|
| 57 | Campaign management | campaign, dialer, outbound, call campaign, auto dialer | `playbook-skills/playbooks/playbook-marketing.md` | GHL campaigns |
| 58 | Lead nurture | nurture, sequence, follow up, drip, sms sequence | `playbook-skills/playbooks/playbook-marketing.md` | Automation sequences |
| 59 | SMS/email blast | blast, mass sms, bulk email, broadcast, send to all | `playbook-skills/playbooks/playbook-marketing.md` | 10DLC compliance |
| 60 | DNC compliance | dnc, do not call, opt out, unsubscribe, stop | `playbook-skills/playbooks/playbook-marketing.md` | DncList entity |
| 61 | Marketing analytics | campaign roi, conversion rate, lead source, attribution | `playbook-skills/playbooks/playbook-marketing.md` | Campaign performance |
| 62 | Enrollment sequence | enrollment flow, signup, onboarding sequence, welcome | `playbook-skills/playbooks/playbook-marketing.md` | 3,165 active sequences |

### P2: HR & TEAM

| # | User Intent | Trigger Keywords | Playbook | Why |
|---|------------|-----------------|----------|-----|
| 63 | Team status check | team, who is working, agent availability, staffing | `playbook-skills/playbooks/playbook-hr.md` | Agent availability |
| 64 | Onboarding | onboard, new hire, new agent, welcome, setup account | `playbook-skills/playbooks/playbook-hr.md` | Personnel onboarding |
| 65 | Compliance training | training, pci training, compliance, certification | `playbook-skills/playbooks/playbook-hr.md` | PCI DSS training tracking |

### P2: SALES & LEAD FLOW (Phase 21 V3)

| # | User Intent | Trigger Keywords | Playbook | Why |
|---|------------|-----------------|----------|-----|
| 66 | Sales pipeline | sales, pipeline, deal, opportunity, lead flow, conversion, prospect | `playbook-skills/playbooks/playbook-sales.md` | GHL pipeline + enrollment |
| 67 | Lead qualification | qualify lead, lead score, hot lead, warm lead, cold lead | `playbook-skills/playbooks/playbook-sales.md` | Lead scoring + routing |
| 68 | Enrollment funnel | enrollment stats, funnel, conversion rate, stuck leads | `playbook-skills/playbooks/playbook-sales.md` | Enrollment funnel metrics |

### P2: VIDEO GENERATION (Phase 21 V3)

| # | User Intent | Trigger Keywords | Playbook | Why |
|---|------------|-----------------|----------|-----|
| 69 | Generate video | create video, make video, generate video, ai video, produce video | `playbook-skills/playbooks/playbook-video-generation.md` | AI video generation pipeline |
| 70 | Edit video | edit video, trim, cut, add caption, subtitle, overlay | `playbook-skills/playbooks/playbook-video-generation.md` | Video editing tools |
| 71 | Video from script | script to video, text to video, convert script, article to video | `playbook-skills/playbooks/playbook-video-generation.md` | Script → video pipeline |

### CROSS-CUTTING: CONNECTOR-SPECIFIC

| # | User Intent | Trigger Keywords | Playbook | Why |
|---|------------|-----------------|----------|-----|
| 66 | Slack operations | slack, post to slack, send message, channel, dm, notify | `connectors/slack/PLAYBOOK.md` | Slack connector mastery |
| 67 | GitHub operations | github, repo, commit, branch, clone, git, push | `connectors/github/PLAYBOOK.md` | GitHub connector mastery |
| 68 | Vercel operations | vercel, deploy, preview, production, domain, env | `connectors/vercel/PLAYBOOK.md` | Vercel connector mastery |
| 69 | Vapi call operations | vapi, call, haley, phone, dial, transcript | `connectors/vapi/PLAYBOOK.md` | Vapi connector mastery |
| 70 | Linear project mgmt | linear, issue, project, sprint, ticket, backlog | `connectors/linear/PLAYBOOK.md` | Linear connector |
| 71 | GHL marketing ops | ghl, gohighlevel, crm, pipeline, contact | `connectors/ghl/PLAYBOOK.md` | GHL connector |
| 72 | Wiki/docs operations | wiki, docs, document, knowledge base, confluence | `connectors/wiki/PLAYBOOK.md` | Wiki connector |
| 73 | Hyperswitch payment | hyperswitch, payment gateway, processor, routing | `connectors/hyperswitch/PLAYBOOK.md` | Hyperswitch connector |
| 74 | Affy operations | affy, affiliate, partner, referral | `connectors/affy/PLAYBOOK.md` | Affy connector |
| 75 | Forth operations | forth, credit, bureau, equifax, experian, transunion | `connectors/forth/PLAYBOOK.md` | Forth connector |
| 76 | MCP hub operations | mcp hub, connect, integration, api, register | `connectors/mcp-hub/PLAYBOOK.md` | MCP hub connector |
| 77 | Base44 operations | base44, entity, query, customer, create, update | `connectors/base44/PLAYBOOK.md` | Base44 connector mastery |

### FALLBACK & META

| # | User Intent | Trigger Keywords | Playbook | Why |
|---|------------|-----------------|----------|-----|
| 78 | List all playbooks | what playbooks exist, list domains, show operations | `playbook-skills/playbooks/playbook-index.md` | Domain discovery |
| 79 | What can you do | capabilities, what can you do, help, how to use | `playbook-skills/playbooks/playbook-index.md` | Capability discovery |
| 80 | I don't know where | not sure, don't know, which playbook, where should I | `playbook-skills/playbooks/playbook-index.md` | Fallback: list all domains |
| 81 | Create new skill | new skill, author skill, create skill, build skill | `playbook-skills/playbooks/playbook-engineering.md` | skill-author capability |
| 82 | System/I need meta help | anything not matching above | `playbook-skills/playbooks/playbook-index.md` | Default: show the index |

---

## ANTI-PATTERNS (WHAT THE AGENT MUST NEVER DO)

| # | Anti-Pattern | Why Wrong | Correct Approach |
|---|-------------|----------|-----------------|
| 1 | **Skipping the router** — going directly to grep/tools | 400+ tools/functions, you WILL pick the wrong one | Read THIS file first. Match intent. Load playbook. |
| 2 | **Loading multiple playbooks** | Fragmented context — you'll mix safeguards from different domains | Pick ONE playbook based on DOMINANT intent |
| 3 | **Guessing a routine** — not loading the playbook | You'll miss critical safeguards and anti-patterns | `load_skill` the playbook BEFORE executing |
| 4 | **Grep-searching tools** instead of following playbook | The playbook tells you EXACTLY which tools to use | Trust the playbook's Toolbox section |
| 5 | **Reading files directly** without playbook guidance | You'll read wrong files, miss related context | The playbook maps files → functions → connectors |
| 6 | **Executing without safeguards** | Billing: might charge without vault check. Disputes: might miss FCRA deadline. | Read Safeguards section BEFORE any tool call |
| 7 | **Using deprecated API fields** (e.g., `source_transaction_id`) | Breaks billing chain, causes chargebacks | Playbook Anti-Patterns section lists banned fields |
| 8 | **Parallelizing across domains** | Each domain has different safeguards, mixing them breaks both | Complete one domain task before starting another |

---

## HOW TO USE THIS ROUTER (Agent Protocol)

1. **Step 1: Read intent.** Extract the user's dominant business intent from their message.
2. **Step 2: Match trigger.** Find matching trigger keywords in the table above. If multiple match, pick the highest-priority (P0 > P1 > P2).
3. **Step 3: Load playbook.** Use `load_skill` with the exact playbook path from the table.
4. **Step 4: Read safeguards.** Before executing ANY tool call, read the playbook's Safeguards and Anti-Patterns sections.
5. **Step 5: Execute SOP.** Follow the playbook's workflow steps in order. Respect [PARALLEL] markers.
6. **Step 6: Annotate.** After completion, append outcome + learnings back to the playbook (annotation loop).

---

## PLAYBOOK FILE PATHS (Quick Reference)

```
Playbooks (Domain SOPs):
  playbook-skills/playbooks/playbook-planning.md   — Planning & Research (PRIMARY USER DOMAIN)
  playbook-skills/playbooks/playbook-billing.md                     — Billing & Payments
  playbook-skills/playbooks/playbook-support.md   — Support Triage
  playbook-skills/playbooks/playbook-disputes.md                   — Credit Disputes
  playbook-skills/playbooks/playbook-deploy.md         — Deploy & Ship
  playbook-skills/playbooks/playbook-engineering.md             — Engineering & Code
  playbook-skills/playbooks/playbook-agent-orchestration.md — Agent Orchestration
  playbook-skills/playbooks/playbook-reporting.md                 — Reporting & Analytics
  playbook-skills/playbooks/playbook-vps-ops.md                     — VPS Operations
  playbook-skills/playbooks/playbook-vercel-discipline.md — Vercel Discipline
  playbook-skills/playbooks/playbook-marketing.md                 — Marketing & Leads
  playbook-skills/playbooks/playbook-hr.md                               — HR & Team

Connector Playbooks (Tool Mastery):
  connectors/base44/PLAYBOOK.md   connectors/slack/PLAYBOOK.md
  connectors/nmi/PLAYBOOK.md      connectors/github/PLAYBOOK.md
  connectors/vercel/PLAYBOOK.md   connectors/vapi/PLAYBOOK.md
  connectors/ghl/PLAYBOOK.md      connectors/linear/PLAYBOOK.md
  connectors/wiki/PLAYBOOK.md     connectors/hyperswitch/PLAYBOOK.md
  connectors/forth/PLAYBOOK.md    connectors/affy/PLAYBOOK.md
  connectors/mcp-hub/PLAYBOOK.md

Index:
  playbooks/playbook-index.md — Full domain catalog (use when unsure)
```

---

## CARDINAL RULES (LOCKED — NEVER VIOLATE)

1. **PLAYBOOK-ROUTER.md is THE entry point.** Read it FIRST on every user message.
2. **ONE playbook at a time.** Pick based on dominant intent.
3. **NEVER grep tools directly.** The playbook tells you what to use.
4. **Safeguards BEFORE execution.** Read the playbook's Safeguards section before any tool call.
5. **Anti-patterns are law.** If a playbook says "NEVER do X," you NEVER do X.
6. **Slack #jarvis-admin ONLY.** Never newleaf-admin.
7. **NEVER real customer data** in test/smoke scenarios.
8. **Commit author:** abhiswami2121 <abhiswami2121@gmail.com>.
9. **NEVER cancel other agent sessions.**
10. **After every execution, annotate** back to the playbook (outcome, duration, error, learning).
11. **Pattern A+1:** Only 7 tools (the 6 gatekeepers + run_workflow). No additional tool discovery.
12. **Vercel REST API only** — never use Vercel CLI on VPS.
13. **NEVER edit VPS Python scripts or pm2 reload** (cardinal 6a153d63).

---

*End of PLAYBOOK-ROUTER.md. Load your playbook now.*
