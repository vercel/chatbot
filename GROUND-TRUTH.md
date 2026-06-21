# GROUND-TRUTH.md — NewLeaf Stack Authoritative State
## Locked 2026-06-21 | Version 2.0 | M-VERIFY-EVERYTHING Verified
## This document is the SINGLE SOURCE OF TRUTH for all agents (Jarvis, Hermes, Neptune).

---

## LAYER 0: VPS INFRASTRUCTURE (Host: Hermes VPS @ 187.127.250.171)

| Service | Port | Status | Notes |
|---|---|---|---|
| claude-agent-api (PM2) | 8102 | Running | Hermes executor runtime |
| Twenty CRM | 3002 (→3000) | Docker | twenty-newleaf-server |
| Twenty DB (Postgres 16) | 5434 | Docker | twenty-newleaf-db |
| Twenty Redis | 6382 | Docker | twenty-newleaf-redis |
| Twenty Worker | — | Docker | twenty-newleaf-worker |
| Neptune Postgres | 5436 | Docker | neptune-postgres |
| NMI MCP Bridge | internal | Base44 MCP | Payment operations |
| Slack MCP Bridge | internal | Base44 MCP | Communications |
| LangGraph Postgres | 5432 | Docker | langgraph-postgres |
| Hyperswitch PG | 5433 | Docker | hyperswitch-pg-1 |
| N8N Postgres | 5435 | Docker | n8n_postgres (legacy/idle) |

## LAYER 1: TWENTY CRM (VERIFIED 2026-06-21)

- **Deployment**: Docker (twentycrm/twenty:latest)
- **Server**: http://localhost:3002 (port 3002→3000 container)
- **Database**: Postgres 16 on port 5434, password: 77242982295764e06e103f5611b8b5c8
- **Active Workspace**: cebc5a0a-e707-409e-bed6-4373a675704e (NewLeaf Financial)
- **Active Schema**: workspace_c8m2rcs3dl62dv44m5jgl7scu
- **Extensions Repo**: /home/neptune/twenty-newleaf-extensions/

### VERIFIED NUMBERS (2026-06-21):
- **1504 persons** (claimed: 1500) — VERIFIED
- **304 with billing** (claimed: 304) — VERIFIED (base44Id + billingStatus populated)
- **5 frontComponents** (claimed: 5 widgets) — VERIFIED
- **49 views** (33 TABLE, 2 KANBAN, 14 FIELDS_WIDGET)
- **30 objectMetadata** (6 custom: activity, creditDispute, enrollment, paymentRecord, subscription, supportTicket)
- **520 fieldMetadata** total (38 billing-related across 5 objects)
- **18 navigationMenuItem, 18 pageLayout, 73 pageLayoutWidget, 1 agent, 2 roles**

### 🟠 CRITICAL: Data in ORPHANED workspace_1wgvd1injqtife6y4rvfbu3h5 schema
- All 1504 persons + 599 companies + 354 opportunities live here
- Active workspace (workspace_c8m2rcs) has ZERO persons/companies
- Migration required. Report: /home/hermes/data/twenty-actual-state-2026-06-21.json

## LAYER 2: NMI PAYMENT GATEWAY (VERIFIED 2026-06-21)

- **Domain**: ap.transactiongateway.com (Allied Payments)
- **Bridge**: nmiMcpBridge (Base44 MCP)
- **241 active subs** (claimed) — VERIFIED
- **Health breakdown**: 25 healthy (10.4%), 72 declining (29.9%), 90 relinked-still-declining (37.3%), 54 new-untested (22.4%), 0 recovered
- **Declines since 2026-03-01**: 1,272
- **At-risk MRR**: $34,499
- **Top decline reason**: Insufficient funds (38%)
- **Report**: /home/hermes/data/nmi-actual-state-2026-06-21.json

## LAYER 3: NEPTUNE CHAT (VERIFIED 2026-06-21 | Updated M-N-SELF-CODING)

- **Repo**: abhiswami2121/neptune-chat
- **Deploy URL**: https://neptune-chat-ashy.vercel.app (Vercel prj_bpG5ZHYNZ1wxAm7WDxr3MrBGoOBl)
- **Latest merged PR**: #14 (feat/youtube-research-connector, 2026-06-20)
- **PR #15** (generative UI cards): OPEN — build fixed by M-N-SELF-CODING
- **PR #16** (AgentSessionCard): OPEN — build fixed by M-N-SELF-CODING
- **PR #17** (GROUND-TRUTH lock): OPEN — build fixed by M-N-SELF-CODING
- **PR #18** (feat/m-n-self-coding-and-vercel-fix): ACTIVE BRANCH — 3-lane coding + Vercel fixes
- **/api/diagnostics**: Working (vps-health FIXED — 3-fallback approach using VPS bridge)
- **/api/health**: Returns HTML redirect (no JSON endpoint)
- **/api/self-code/apply**: NEW — direct GitHub + Vercel self-coding endpoint
- **NEPTUNE.md**: Updated with BEFORE ANY WORK directive
- **Report**: /home/hermes/data/neptune-chat-actual-state-2026-06-21.json

### 3-LANE CODING SYSTEM (M-N-SELF-CODING, 2026-06-21)

Neptune Chat now has 3 coding lanes with automatic health-aware fallback:

| Lane | Trigger | Backend | Use Case |
|---|---|---|---|
| **V2** | Long tasks (>500 chars), refactor, multi-file, scaffold | neptune-v2.vercel.app sandboxed agent | Complex multi-file PRs |
| **VPS** | Quick fixes (<300 chars), ephemeral dispatch | Base44 hybridDispatch → VPS Claude SDK | Short single-file fixes |
| **SELF** | Explicit "do it yourself" / fallback when V2+VPS down | GitHub REST API + Vercel REST API directly | Direct code apply + deploy |

**Fallback chain**: V2 → VPS → SELF (automatic, health-aware)
**Lane detection**: `lib/chat/router.ts` → `routeCodingTask()`
**Self-code endpoint**: `POST /api/self-code/apply` (extracts file changes, applies to GitHub, deploys to Vercel)
**SSE events**: 6 new event types (`self-code:plan-generated`, `applying-diff`, `tests-running`, `pr-opened`, `deploy-started`, `deploy-complete`)

### VERCEL PR BUILD STATUS (M-N-SELF-CODING Fix)

Root cause of PR #15/#16/#17 failures: `scripts/validate-playbooks.ts` crashed on non-array YAML `requires` fields + missing `pg` dependency.
- **Fix**: Safe array coercion in validate-playbooks.ts, stack-restore in YAML parser, `pg` added to dependencies
- **Build**: All branches now build (exit 0 verified locally)
- **Merge order**: #17 first (GROUND TRUTH, no code), #15 second (foundational cards), #16 third (extends #15). NEVER parallel.

### VPS-HEALTH DIAGNOSTICS FIX

- **Root cause**: `localhost:8102/health` unreachable from Vercel serverless functions
- **Fix**: 3-fallback health check — VPS bridge (port 8400), direct URL (HERMES_VPS_HEALTH_URL), Base44 proxy relay
- **Env vars needed on Vercel**: VPS_BRIDGE_URL or HERMES_VPS_HEALTH_URL

## LAYER 4: NEPTUNE V2 (VERIFIED 2026-06-21)

- **Repo**: abhiswami2121/neptune-v2
- **Deploy URL**: https://neptune-v2.vercel.app (Vercel prj_ToGOYRDOvnljHtaKk0M1p8IBOvKf)
- **Latest merged PR**: #2 (feat/nf1-auth-allowlist, 2026-06-11)
- **/api/health**: Working (status "ok", version "phase-28", all checks passing)
- **/api/agent-sessions**: 13 sessions, ALL in "started" state (none completed, oldest 8 days)
- **Internal Token**: 1f26d88bb8aeb160e3af5bd99cdb41626e67cd7735fe506690fb66d56c15c02d
- **Report**: /home/hermes/data/neptune-v2-actual-state-2026-06-21.json

## LAYER 5: JARVIS OS IOTA (Chat UI)

- **Repo**: abhiswami2121/newleaf-financial
- **Deploy URL**: https://jarvis-os-iota.vercel.app/chat
- **Framework**: Next.js + @assistant-ui/react 0.14.7 + @ai-sdk/react 3.0.193
- **Backend**: VPS claude-agent-api:8102 via SSE
- **Artifact Types**: data_table, chart, status_card, action_panel
- **Deploy Project**: jarvis-os-clean-ycjzllrom

## LAYER 6: BASE44 PLATFORM (Orchestrator)

- **URL**: https://base44.app
- **App**: new-leaf-financial (APP_ID: 692f9a5fce9fd7c889a4b4ac)
- **Primary Chat**: CommandCenterV2 (NOT where iota/Jarvis OS features go)
- **Key Functions**: nmiMcpBridge, slackMcpBridge, reportingHubQuery, jarvisTaskManager, entity CRUD
- **DIAG_KEY**: NL2026061471

## LAYER 7: DATA WAREHOUSE

- **360db**: /home/hermes/data/sqlite/newleaf_360.db (24MB, 21 tables)
- **Graphify Cortex**: 6,519 nodes, 512 communities (FalkorDB at localhost:6380)
- **Graphify Code**: /home/hermes/brain/graphify-out/
- **ChromaDB**: Local for agent knowledge embeddings

## LAYER 8: WIKI

- **Repo**: abhiswami2121/newleaf-wiki (private)
- **Deploy URL**: https://newleaf-wiki.vercel.app (Nextra-based)
- **GROUND-TRUTH.md**: ✅ Pushed to wiki repo root (2026-06-21)
- **Home page**: Updated to reference GROUND-TRUTH.md with quick reference table
- **Gap**: wiki_builder.py may overwrite generated content on next build

## LAYER 9: INTEGRATIONS (5 of 7 Canonical)

| Connector | SPEC Size | MDX Count | Status |
|---|---|---|---|
| NMI | 24KB | 6 | Canonical |
| Slack | 33KB | 6 | Canonical |
| Base44 | 40KB | 6 | Canonical |
| GHL | 40KB | 6 | Canonical |
| VAPI | 36KB | 6 | Canonical |
| GitHub | — | — | Queued |
| Freshcaller | — | — | Queued |

Neptune Chat additional connectors: forth, wiki, mcp-hub, affy, hyperswitch, youtube-research, pocock-engineering

## CARDINAL RULES (NON-NEGOTIABLE)

1. NEVER charge before promised date.
2. "Card Link DONE" ≠ "Charge Now."
3. Every charge → email + SMS confirmation.
4. NMI domain: ap.transactiongateway.com (NOT sandbox.nmi.com)
5. NEVER use source_transaction_id. Always customer_vault_id + initial_transaction_id.
6. Zero Base44 integration credits.
7. Support phone: (520) 223-9768 (NEVER (520) 314-1484)
8. Cross-validate every number (≥ 2 sources).
9. DB-first queries. Read entities before calling external APIs.
10. ADDITIVE changes only. Don't break, only enhance.
11. NEVER pm2 reload from inside a session.
12. NO n8n install or reference in new code (cardinal locked).
13. Enhancement research mandatory per cardinal 6a37787b.

## AGENT RESPONSIBILITIES

- **Hermes (VPS)**: Read /home/hermes/cortex/GROUND-TRUTH.md BEFORE any work (system_prompt_builder.py STEP 1)
- **Neptune (Chat)**: Read GROUND-TRUTH.md at repo root BEFORE any work (NEPTUNE.md directive)
- **Jarvis (Base44)**: Read GROUND-TRUTH.md from jarvis/cortex/ BEFORE any work
- **All Agents**: This file supersedes training data and memory. NO EXCEPTIONS.

## VERIFICATION HISTORY

| Date | Verifier | Scope | Result |
|---|---|---|---|
| 2026-06-21 | Hermes (M-VERIFY) | Full stack (9 layers) | 3 CRITICAL gaps found |

## ACTIVE GAPS (2026-06-21)

| # | Layer | Severity | Gap |
|---|---|---|---|
| 1 | Twenty CRM | 🟠 CRITICAL | 1504 persons in orphaned workspace — active workspace empty |
| 2 | NMI | 🔴 CRITICAL | 67% subs declining, $34.5K MRR at risk, 0 recovered |
| 3 | Neptune Chat | 🔴 HIGH | PR #15, #16 not merged — features not deployed |
| 4 | Neptune V2 | 🟡 MEDIUM | 13 agent sessions stuck in "started" state |
| 5 | Neptune Chat | 🟡 MEDIUM | No JSON /api/health endpoint |

## ENHANCEMENT OPPORTUNITIES (Cardinal 6a37787b)

1. Twenty CRM Data Migration (CRITICAL) | /home/hermes/cortex/research/enhancement-opportunities/
2. NMI Recovery Workflow (HIGH) | Vercel Workflow SDK for automated recovery cascade
3. GROUND-TRUTH Sync Pipeline (MEDIUM) | Auto-sync to all repos on cron
4. Agent Session Lifecycle (MEDIUM) | TTL/timeout for Neptune V2 sessions
5. Vercel Workflow SDK Migration (MEDIUM) | Replace VPS Python crons with serverless workflows

Full research: /home/hermes/cortex/research/enhancement-opportunities/m-verify-everything-2026-06-21.md

## KEY REPORTS

- Master: /home/hermes/data/MASTER-STATE-ALIGNMENT-2026-06-21.md
- Twenty: /home/hermes/data/twenty-actual-state-2026-06-21.json
- NMI: /home/hermes/data/nmi-actual-state-2026-06-21.json
- Neptune Chat: /home/hermes/data/neptune-chat-actual-state-2026-06-21.json
- Neptune V2: /home/hermes/data/neptune-v2-actual-state-2026-06-21.json

## APPENDICES

### A. Environment tokens (from /etc/newleaf/.env)
KIMI_API_KEY, DEEPSEEK_API_KEY, OLLAMA_KEY, DIAGNOSTICS_API_KEY (NL2026061471), HERMES_KEY, BASE44_APP_ID (692f9a5fce9fd7c889a4b4ac), BASE44_APP_API_KEY, GITHUB_TOKEN, SMITHERY_API_KEY, NEPTUNE_INTERNAL_TOKEN (1f26d88b...)

### B. Docker containers
twenty-newleaf-worker, twenty-newleaf-server, twenty-newleaf-db, twenty-newleaf-redis, neptune-postgres, n8n_postgres (legacy/idle), hyperswitch-pg-1, langgraph-postgres

### C. Key directories
/home/hermes/cortex/ — Cortex brain (skills, PRDs, memory, GROUND-TRUTH.md)
/home/hermes/claude-agent-api/ — Hermes runtime (system_prompt_builder.py)
/home/hermes/data/ — SQLite DBs, verification reports
/home/neptune/neptune-chat/ — Neptune Chat code (GROUND-TRUTH.md at root)
/home/neptune/neptune-v2/ — Neptune V2 code (GROUND-TRUTH.md at root)
/home/twenty/ — Twenty CRM GROUND-TRUTH.md reference
/home/neptune/playbook-os/ — V5 Playbook architecture
/home/neptune/twenty-newleaf-extensions/ — Twenty CRM custom extensions
/etc/newleaf/.env — Environment secrets
