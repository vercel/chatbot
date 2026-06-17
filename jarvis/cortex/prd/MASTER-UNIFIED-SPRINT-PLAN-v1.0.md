---
type: "prd"
name: "MASTER UNIFIED SPRINT PLAN V1.0"
description: "Auto-generated description for MASTER UNIFIED SPRINT PLAN V1.0"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# MASTER UNIFIED SPRINT PLAN v1.0

## Neptune Platform v1.0 — Production AI Agent Platform

**Version:** 1.0.0
**Date:** 2026-06-17
**Type:** prd
**Status:** ACTIVE
**Owner:** hermes
**Budget:** 155,000t (across all phases)
**ETA:** 16-20 weeks (Phases 34-50)
**Dependencies:** NEPTUNE-KNOWLEDGE-SPEC v1.0, Neptune Chat (28+ commits), V2 (9 commits), Twenty CRM (6 custom objects live)

---

## TABLE OF CONTENTS

1. [North Star](#1-north-star)
2. [Current Position](#2-current-position)
3. [Sprint Sequence — Phases 34-50](#3-sprint-sequence--phases-34-50)
4. [Dependency Graph](#4-dependency-graph)
5. [Timeline](#5-timeline)
6. [Resource Allocation](#6-resource-allocation)
7. [Risk Register](#7-risk-register)
8. [Success Metrics](#8-success-metrics)
9. [Phase Budget Summary](#9-phase-budget-summary)

---

## 1. NORTH STAR

> **Neptune Platform v1.0** — A production-grade AI agent platform with:
> - **OKF-aligned knowledge layer** (NEPTUNE-KNOWLEDGE-SPEC v1.0)
> - **Twenty CRM** as operational backbone (replacing Base44)
> - **V2 coding agent** for autonomous software development
> - **Command Center** for sales/billing/support agents

### 1.1 Platform Architecture (End State)

```
┌──────────────────────────────────────────────────────────────┐
│                    NEPTUNE PLATFORM v1.0                     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │  CHAT    │  │    V2    │  │  PORTAL  │  │  COMMAND    │  │
│  │ Next.js  │  │ Next.js  │  │ Next.js  │  │  CENTER     │  │
│  │ AI SDK 6 │  │Sandbox   │  │  Clerk   │  │  Twenty     │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └─────┬──────┘  │
│       │             │             │               │         │
│       └─────────┬───┴─────────────┴───────────────┘         │
│                 │                                            │
│     ┌───────────▼──────────────────────────┐                │
│     │      KNOWLEDGE LAYER (NKS v1.0)     │                │
│     │  Skills │ Playbooks │ PRDs │ Memory │                │
│     │  Graphify (code) + Graphiti (ops)   │                │
│     └───────────┬──────────────────────────┘                │
│                 │                                            │
│     ┌───────────▼──────────────────────────┐                │
│     │         INTEGRATION BUS              │                │
│     │  NMI │ Slack │ n8n │ Resend │ VAPI  │                │
│     │  GHL │ Linear │ Freshcaller │ Clerk │                │
│     └──────────────────────────────────────┘                │
│                                                              │
│     ┌──────────────────────────────────────┐                │
│     │       TWENTY CRM (Docker)            │                │
│     │  22 Custom Objects │ Code Nodes     │                │
│     │  Bidirectional Base44 Sync           │                │
│     └──────────────────────────────────────┘                │
│                                                              │
│     ┌──────────────────────────────────────┐                │
│     │          VPS INFRASTRUCTURE           │                │
│     │  Postgres (neon) │ n8n │ Docker     │                │
│     │  Redis │ Vercel Deployments          │                │
│     └──────────────────────────────────────┘                │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 Why This Matters

We are building the **reference implementation** for production AI agents. Google released OKF v0.1 (June 12, 2026) — a vendor-neutral markdown spec for AI agent context. We have been 6+ months ahead of this, building the exact same concepts but with 10 production-grade extensions. Our position:

- **Augment, not compete.** We are 100% OKF-compatible.
- **Reference implementation.** Anyone who wants to see OKF in production can look at Neptune.
- **10 extensions.** We solve problems OKF doesn't address (memory, missions, self-code, MCP, generative UI).
- **Open source.** github.com/abhiswami2121/neptune-knowledge-spec

---

## 2. CURRENT POSITION

### 2.1 Production Snapshot (2026-06-17)

| Metric | Value |
|--------|-------|
| Total Customers | 2,000+ |
| Enrolled Customers | 169 |
| MRR | $33,750 |
| Haley AI Leads | 1,779 |
| Base44 Entities | 200+ (to be migrated to Twenty) |
| Custom Twenty Objects | 6 deployed |
| V2 Commits | 9 (Vercel READY) |
| Chat Commits | 28+ |
| Knowledge Files | 200+ (skills, PRDs, research, missions) |
| Ops Slack Channels | 8 |

### 2.2 What's Already Done

| Phase | Description | Status |
|-------|-------------|--------|
| Phases 1-28 | Chat MVP, auth, panels, command center, library | ✅ COMPLETE |
| Phase 29 | Knowledge graph foundation (Graphify, Graphiti) | ✅ COMPLETE |
| Phase 30 | V2 coding agent (Vercel, GitHub PR, swarm) | ✅ COMPLETE |
| Phase 31 | Twenty CRM install + 6 custom objects | ✅ COMPLETE |
| Phase 32 | Twenty bidirectional sync + ConnectorSkill | ✅ COMPLETE |
| Phase 33 | Playbook + workflow integration (partial) | ⚠️ PARTIAL |

### 2.3 What's Next (Phases 34-50)

17 phases across 16-20 weeks. Total budget: ~155,000 tool calls.

---

## 3. SPRINT SEQUENCE — PHASES 34-50

---

### PHASE 34: OKF Compatibility Pass

| Field | Value |
|-------|-------|
| **Duration** | 1 week |
| **Budget** | 8,000t |
| **Priority** | P0 — STRATEGIC |
| **Depends On** | Phase 33 (playbook structure) |
| **Blocks** | Phases 35, 36 |
| **Owner** | hermes |

**Objective:** Bring entire `cortex/` into NKS v1.0 conformance.

**Scope:**
1. Add `index.md` to every directory (skills/, playbooks/, prd/, research/, missions/, memories/)
2. Add `log.md` to every domain directory
3. Add `type` field to all existing YAML frontmatter
4. Rename flat skill files to SKILL.md in named directories
5. Generate OKF export bundle from cortex
6. Verify bundle against OKF v0.1 spec
7. Generate static HTML visualizer
8. Verify visualizer renders correctly

**Acceptance Criteria:**
- [ ] Every cortex directory has index.md
- [ ] Every domain has log.md
- [ ] All .md files have type field
- [ ] okf-export.ts produces valid OKF bundle
- [ ] okf-verify.ts passes with 0 errors
- [ ] Visualizer renders knowledge graph

**Deliverables:**
- 200+ updated files with frontmatter compliance
- 50+ new index.md files
- 15+ new log.md files
- OKF export bundle (validated)
- Static HTML visualizer

---

### PHASE 35: Knowledge Visualizer

| Field | Value |
|-------|-------|
| **Duration** | 1 week |
| **Budget** | 6,000t |
| **Priority** | P0 — USER-FACING |
| **Depends On** | Phase 34 (OKF compliance) |
| **Blocks** | — |
| **Owner** | hermes |

**Objective:** Build interactive knowledge graph visualization at `/knowledge` route.

**Scope:**
1. Create `/knowledge` route in Neptune Chat
2. Build D3.js force-directed graph component
3. Add Twin View toggle (Library / Playbook)
4. Add concept card hover preview
5. Add search bar with full-text search
6. Add domain filter (billing, support, disputes, etc.)
7. Add type filter (skill, playbook, prd, mission, research, memory)
8. Add click-to-open file viewer with markdown rendering
9. Add recent changes timeline
10. Add OKF export download button
11. Add graph zoom, pan, and node pinning

**Acceptance Criteria:**
- [ ] /knowledge route loads within 3 seconds
- [ ] Graph renders with all cortex nodes
- [ ] Twin view toggle works
- [ ] Search returns results in <500ms
- [ ] Filters work independently and combined
- [ ] File viewer renders markdown with syntax highlighting
- [ ] OKF export button downloads valid bundle
- [ ] Mobile responsive (375px+)

**Deliverables:**
- `app/(harness)/knowledge/page.tsx`
- `app/(harness)/knowledge/client.tsx`
- `components/knowledge/knowledge-graph.tsx`
- `components/knowledge/concept-card.tsx`
- `components/knowledge/search-bar.tsx`
- `components/knowledge/domain-filter.tsx`
- `components/knowledge/file-viewer.tsx`
- `lib/knowledge/parser.ts`
- `lib/knowledge/graph-builder.ts`

---

### PHASE 36: NEPTUNE-KNOWLEDGE-SPEC GitHub Release

| Field | Value |
|-------|-------|
| **Duration** | 1 week |
| **Budget** | 5,000t |
| **Priority** | P0 — COMMUNITY |
| **Depends On** | Phase 34 (OKF compliance), Phase 35 (visualizer) |
| **Blocks** | — |
| **Owner** | hermes |

**Objective:** Open-source the NEPTUNE-KNOWLEDGE-SPEC as a standalone GitHub repository.

**Scope:**
1. Create `github.com/abhiswami2121/neptune-knowledge-spec` repo
2. Publish NEPTUNE-KNOWLEDGE-SPEC-v1.0.md as repo's README
3. Create reference implementation directory
4. Create public docs site (Vercel Pages)
5. Write blog post: "Neptune Knowledge Spec — OKF Superset for Production AI Agents"
6. Write Twitter/X thread (10 tweets)
7. Create community contribution guide (CONTRIBUTING.md)
8. Set up GitHub Discussions
9. Add comparison table: OKF v0.1 vs NKS v1.0
10. Create sample bundles (Neptune billing, GA4 for comparison)

**Acceptance Criteria:**
- [ ] Repo public with README
- [ ] Docs site live on Vercel
- [ ] Blog post published
- [ ] Twitter thread posted
- [ ] CONTRIBUTING.md clear
- [ ] Sample bundles validate against OKF

**Deliverables:**
- `github.com/abhiswami2121/neptune-knowledge-spec`
- `docs.neptune-knowledge-spec.vercel.app`
- Blog post + Twitter thread
- 3 sample bundles

---

### PHASE 37: Twenty CRM Wave 1 — Lead + VAPICall Migration

| Field | Value |
|-------|-------|
| **Duration** | 2 weeks |
| **Budget** | 10,000t |
| **Priority** | P0 — OPERATIONAL |
| **Depends On** | Phase 33 (Twenty sync) |
| **Blocks** | Phases 38-42 (all Twenty waves) |
| **Owner** | hermes |

**Objective:** Migrate lead management and VAPI call records to Twenty CRM.

**Scope:**
1. Define `lead` custom object in Twenty (full field spec)
2. Define `vapiCall` custom object in Twenty
3. Build Slack submission parser → Twenty lead creation
4. Implement bidirectional lead sync (Base44 ↔ Twenty)
5. Implement VAPI webhook → Twenty vapiCall creation
6. Migrate 50 test customers (profile + leads + call history)
7. Build Lead pipeline view in Twenty
8. Build VAPI call log view in Twenty
9. Verify sync integrity (no data loss)

**Acceptance Criteria:**
- [ ] lead object with all required fields deployed
- [ ] vapiCall object with transcript + outcome fields deployed
- [ ] Slack parser creates leads in Twenty <30s
- [ ] Bidirectional sync verified (create in Base44 → appears in Twenty, vice versa)
- [ ] 50 customers migrated with data integrity verified
- [ ] Lead pipeline kanban renders
- [ ] VAPI call log renders with transcript preview

**Deliverables:**
- `twenty-newleaf-extensions/src/objects/lead.field.ts`
- `twenty-newleaf-extensions/src/objects/vapi-call.field.ts`
- Slack submission parser (n8n workflow)
- Bidirectional sync connector
- Migration script (50 customers)

---

### PHASE 38: Twenty CRM Wave 2 — Sales Workflow

| Field | Value |
|-------|-------|
| **Duration** | 2 weeks |
| **Budget** | 12,000t |
| **Priority** | P0 — OPERATIONAL |
| **Depends On** | Phase 37 (Lead + VAPI in Twenty) |
| **Blocks** | Phase 42 (Customer Portal) |
| **Owner** | hermes |

**Objective:** Full sales pipeline in Twenty CRM with enrollment workflow.

**Scope:**
1. Build Sales Pipeline kanban view in Twenty
2. Create Enrollment wizard (multi-step form)
3. Build Agent Dashboard with metrics (leads/day, conversion rate, pipeline value)
4. Define `agreement` custom object
5. Define `payment-method` custom object
6. Implement document generation (agreement PDF)
7. Implement e-signature flow
8. Migrate remaining 119 enrolled customers (total: 169)
9. Build agent leaderboard in Twenty
10. Implement Quick Actions modal (Send Payment Link, SMS, Note, Ticket)

**Acceptance Criteria:**
- [ ] Sales Pipeline kanban drag-and-drop works
- [ ] Enrollment wizard completes in <8 steps
- [ ] Agent Dashboard loads in <1s
- [ ] Agreement generation produces valid PDF
- [ ] E-signature flow completes end-to-end
- [ ] All 169 enrolled customers migrated
- [ ] Agent leaderboard updates in real-time
- [ ] Quick Actions modal renders in <200ms

**Deliverables:**
- `twenty-newleaf-extensions/src/objects/agreement.field.ts`
- `twenty-newleaf-extensions/src/objects/payment-method.field.ts`
- Enrollment wizard component
- Agent Dashboard component
- Document generation service
- Quick Actions component

---

### PHASE 39: Twenty CRM Wave 3 — Billing Migration

| Field | Value |
|-------|-------|
| **Duration** | 2 weeks |
| **Budget** | 12,000t |
| **Priority** | P0 — SACRED (NMI Vault) |
| **Depends On** | Phase 38 (Sales pipeline) |
| **Blocks** | Phase 42 (Customer Portal), Phase 44 (Reporting) |
| **Owner** | hermes |

**Objective:** Full billing operations in Twenty CRM with NMI integration (SACRED).

**CARDINAL RULE:** NMI vault configuration (memory 6a1f118b) is SACRED. Never override, never expose, never modify payment processing logic without explicit human approval.

**Scope:**
1. Define `billing-recovery-task` custom object
2. Define `payment-record` custom object (refine existing)
3. Build Billing Calendar view (subscriptions, payment dates, recovery tasks)
4. Build Recovery Campaign manager
5. Build Payment Link Generator
6. Implement card sync (NMI vault ↔ Twenty)
7. Build subscription management interface
8. Build decline recovery workflow (auto-retry logic)
9. Build billing dashboard with MRR, churn, recovery rate
10. Migrate billing data for 169 enrolled customers

**Acceptance Criteria:**
- [ ] NMI vault NEVER modified by automated processes
- [ ] Billing Calendar renders all active subscriptions
- [ ] Recovery Campaign creates tasks for all declined payments
- [ ] Payment Link Generator produces valid NMI links
- [ ] Card sync updates within 60s of NMI webhook
- [ ] Subscription status syncs bidirectionally
- [ ] Decline recovery workflow retries up to 3 times
- [ ] Billing dashboard shows real-time MRR

**Deliverables:**
- `billing-recovery-task.field.ts`
- `payment-record.field.ts` (refined)
- Billing Calendar component
- Recovery Campaign manager
- Payment Link Generator
- Card sync service
- Billing Dashboard

---

### PHASE 40: Twenty CRM Wave 4 — Disputes

| Field | Value |
|-------|-------|
| **Duration** | 2 weeks |
| **Budget** | 10,000t |
| **Priority** | P0 — OPERATIONAL |
| **Depends On** | Phase 39 (Billing), Phase 38 (Agreements) |
| **Blocks** | Phase 42 (Customer Portal) |
| **Owner** | hermes |

**Objective:** Full credit dispute management in Twenty CRM.

**Scope:**
1. Define `dispute-letter` custom object
2. Define `negative-item` custom object
3. Define `credit-report` custom object
4. Build Dispute Round pipeline (kanban)
5. Build Letter Generator (templates + merge fields)
6. Build Response Tracker (bureau responses, timelines)
7. Build Bureau Integration (Equifax, Experian, TransUnion tracking)
8. Build dispute dashboard with success rates
9. Implement FCRA compliance checks
10. Build dispute timeline view

**Acceptance Criteria:**
- [ ] Dispute Round pipeline tracks all stages
- [ ] Letter Generator produces compliant letters (FCRA)
- [ ] Response Tracker shows bureau response timelines
- [ ] All 3 bureaus tracked per dispute
- [ ] Credit report parser extracts all negative items
- [ ] Dispute dashboard shows success rate by bureau
- [ ] FCRA compliance auto-flag works

**Deliverables:**
- `dispute-letter.field.ts`
- `negative-item.field.ts`
- `credit-report.field.ts`
- Dispute Round pipeline component
- Letter Generator with templates
- Response Tracker
- Bureau Integration module

---

### PHASE 41: Twenty CRM Wave 5 — Support + Communications

| Field | Value |
|-------|-------|
| **Duration** | 2 weeks |
| **Budget** | 10,000t |
| **Priority** | P0 — OPERATIONAL |
| **Depends On** | Phase 38 (Sales), Phase 39 (Billing) |
| **Blocks** | Phase 42 (Customer Portal) |
| **Owner** | hermes |

**Objective:** Support ticket system and multi-channel communications in Twenty CRM.

**Scope:**
1. Refine `supportTicket` custom object (SLA tracking, auto-assignment)
2. Define `email-message` custom object (Resend integration)
3. Define `sms-message` custom object (GHL integration)
4. Define `call-log` custom object (VAPI + Freshcaller)
5. Build Support Inbox (unified view: email + SMS + calls + Slack)
6. Build SLA enforcement system (breach alerts, escalation)
7. Build Customer 360 view (all comms + payments + disputes + tickets)
8. Build Compose interface (email, SMS, call trigger)
9. Build Communications timeline per customer
10. Build support analytics (resolution time, CSAT, volume)

**Acceptance Criteria:**
- [ ] Support Inbox shows all channels unified
- [ ] SLA breach triggers Slack alert to #jarvis-admin
- [ ] Customer 360 loads in <2s
- [ ] Compose interface sends email via Resend
- [ ] Compose interface sends SMS via GHL
- [ ] Communications timeline is chronological
- [ ] Support analytics dashboard functional

**Deliverables:**
- `email-message.field.ts`
- `sms-message.field.ts`
- `call-log.field.ts`
- Support Inbox component
- SLA enforcement service
- Customer 360 component
- Compose interface
- Support Analytics dashboard

---

### PHASE 42: Twenty CRM Wave 6 — Customer Portal v2

| Field | Value |
|-------|-------|
| **Duration** | 3 weeks |
| **Budget** | 15,000t |
| **Priority** | P0 — USER-FACING |
| **Depends On** | Phases 38-41 (all Twenty data in place) |
| **Blocks** | — |
| **Owner** | hermes |

**Objective:** End-customer self-service portal reading Twenty CRM via GraphQL.

**Scope:**
1. Build Customer Portal Vercel app (separate Next.js deployment)
2. Implement Twenty GraphQL read integration
3. Build Account Home page (summary cards)
4. Build Payments page (history, upcoming, payment method)
5. Build Documents page (agreements, dispute letters, credit reports)
6. Build Disputes page (status tracker per dispute round)
7. Build Messages page (email/SMS history, compose)
8. Build Profile page (personal info, contact prefs)
9. Implement Clerk auth with Twenty JWT bridge
10. Mobile-first responsive design (375px+)
11. Accessibility audit (WCAG 2.1 AA)
12. Performance budget (<3s LCP, <100ms FID)

**Acceptance Criteria:**
- [ ] Portal loads for authenticated customer
- [ ] Account Home shows accurate summary
- [ ] Payment history matches NMI records
- [ ] Document downloads work
- [ ] Dispute status matches Twenty data
- [ ] Message compose sends via Resend/GHL
- [ ] Clerk auth bridge to Twenty verified
- [ ] Mobile responsive passes Lighthouse audit
- [ ] WCAG 2.1 AA compliance

**Deliverables:**
- Customer Portal Vercel app
- Account Home, Payments, Documents, Disputes, Messages, Profile pages
- Clerk ↔ Twenty auth bridge
- Mobile-responsive UI

---

### PHASE 43: V2 Coding Agent Maturation

| Field | Value |
|-------|-------|
| **Duration** | 2 weeks |
| **Budget** | 12,000t |
| **Priority** | P0 — PLATFORM |
| **Depends On** | Phase 34 (OKF compliance), Stream 9 (V2 knowledge integration) |
| **Blocks** | — |
| **Owner** | hermes |

**Objective:** Production-grade V2 coding agent with knowledge graph integration.

**Scope:**
1. Polish swarm mode (multi-agent coordination)
2. Implement MoA (Mixture of Agents) orchestration
3. Polish GitHub PR workflow (create, update, merge)
4. Polish Vercel deploy flow
5. Integrate knowledge graph (V2 loads NKS context)
6. Implement self-code capability (V2 writes back to cortex)
7. Build coding agent analytics (success rate, time-to-complete, cost)
8. Implement sandbox workspace persistence
9. Build session resume capability
10. Performance optimization (<5s first token)

**Acceptance Criteria:**
- [ ] Swarm mode completes multi-file tasks
- [ ] MoA orchestration routes to correct sub-agent
- [ ] GitHub PR workflow works end-to-end
- [ ] Vercel deploy works for generated code
- [ ] Knowledge graph context loaded for every coding session
- [ ] Self-code writes back to cortex with git tracking
- [ ] Sandbox workspace survives agent restart
- [ ] Session resume works within 24h

**Deliverables:**
- Swarm mode polisher
- MoA orchestrator
- Knowledge loader for V2
- Self-code module
- Analytics dashboard for coding agent

---

### PHASE 44: Reporting + Analytics

| Field | Value |
|-------|-------|
| **Duration** | 2 weeks |
| **Budget** | 10,000t |
| **Priority** | P1 |
| **Depends On** | Phases 38-41 (Twenty data) |
| **Blocks** | — |
| **Owner** | hermes |

**Objective:** Comprehensive reporting and analytics dashboards.

**Scope:**
1. Build MRR Dashboard (current, trend, forecast)
2. Build Agent Leaderboard (sales, billing, support metrics)
3. Build Pipeline Funnel (lead → enrolled → paying)
4. Build Custom Report Builder (drag-and-drop)
5. Build Export to CSV/PDF
6. Build Scheduled Report delivery (Slack + email)
7. Build Sync Health Dashboard (Twenty ↔ Base44)
8. Build System Health Dashboard (uptime, latency, error rates)

**Acceptance Criteria:**
- [ ] MRR Dashboard updates daily
- [ ] Agent Leaderboard real-time
- [ ] Pipeline Funnel accurate
- [ ] Custom reports exportable
- [ ] Scheduled reports deliver on time
- [ ] Sync Health shows discrepancy count
- [ ] System Health shows 7-day trends

---

### PHASE 45: VAPI Voice Agent Integration

| Field | Value |
|-------|-------|
| **Duration** | 2 weeks |
| **Budget** | 8,000t |
| **Priority** | P1 |
| **Depends On** | Phase 37 (VAPI call objects) |
| **Blocks** | — |
| **Owner** | hermes |

**Objective:** Voice AI agent for outbound campaigns and inbound IVR.

**Scope:**
1. Build outbound campaign manager (target lists, scheduling)
2. Implement inbound IVR with skill routing
3. Build Call Analysis dashboard (sentiment, outcomes, transcripts)
4. Implement call recording storage and retrieval
5. Build campaign performance analytics
6. Implement DNC (Do Not Call) compliance

**Acceptance Criteria:**
- [ ] Outbound campaign sends calls to target list
- [ ] Inbound IVR routes to correct skill
- [ ] Call transcripts searchable
- [ ] DNC list enforced
- [ ] Campaign analytics show conversion rates

---

### PHASE 46: Email + SMS Automation

| Field | Value |
|-------|-------|
| **Duration** | 1 week |
| **Budget** | 6,000t |
| **Priority** | P1 |
| **Depends On** | Phase 41 (Support + Comms in Twenty) |
| **Blocks** | — |
| **Owner** | hermes |

**Objective:** Automated email and SMS campaigns.

**Scope:**
1. Resend email integration (transactional + marketing)
2. Build Drip Sequence builder
3. Build SMS automation triggers (payment reminder, appointment, follow-up)
4. Build email template library
5. Build campaign performance analytics (open rate, click rate, conversion)

**Acceptance Criteria:**
- [ ] Transactional emails send within 30s
- [ ] Drip sequences trigger on enrollment
- [ ] SMS sends via GHL
- [ ] Template library accessible from Twenty
- [ ] Campaign analytics dashboard functional

---

### PHASE 47: Compliance + Audit

| Field | Value |
|-------|-------|
| **Duration** | 2 weeks |
| **Budget** | 8,000t |
| **Priority** | P0 — LEGAL |
| **Depends On** | All operational phases |
| **Blocks** | Phase 48 (Multi-tenancy) |
| **Owner** | hermes |

**Objective:** SOC 2 preparation, secret rotation, audit logging.

**Scope:**
1. SOC 2 controls documentation
2. Secret rotation automation (NMI, Slack, GitHub tokens)
3. Comprehensive audit log (who did what when)
4. Automated backup verification
5. Access control audit (who has access to what)
6. Data retention policy implementation
7. Vulnerability scanning integration
8. Incident response playbook

**Acceptance Criteria:**
- [ ] SOC 2 controls documented
- [ ] Secrets rotate on schedule
- [ ] Audit log captures all mutations
- [ ] Backups verified daily
- [ ] Access control matrix reviewed
- [ ] Data retention enforced
- [ ] Vulnerability scan pass

---

### PHASE 48: Multi-tenancy

| Field | Value |
|-------|-------|
| **Duration** | 3 weeks |
| **Budget** | 15,000t |
| **Priority** | P2 — GROWTH |
| **Depends On** | Phase 47 (Compliance) |
| **Blocks** | — |
| **Owner** | hermes |

**Objective:** Partner workspaces with RBAC and white-label.

**Scope:**
1. Build Partner Workspace system (isolated data per partner)
2. Implement RBAC matrix (admin, manager, agent, viewer)
3. Build white-label configuration (logo, colors, domain)
4. Build partner onboarding flow
5. Implement cross-workspace reporting (aggregate for admin)
6. Build billing per workspace

**Acceptance Criteria:**
- [ ] Partner data isolated per workspace
- [ ] RBAC enforced on all endpoints
- [ ] White-label renders correctly
- [ ] Partner onboarding <1 hour
- [ ] Cross-workspace reporting correct
- [ ] Workspace billing accurate

---

### PHASE 49: Mobile PWA

| Field | Value |
|-------|-------|
| **Duration** | 3 weeks |
| **Budget** | 12,000t |
| **Priority** | P2 |
| **Depends On** | Phases 42 (Portal), 43 (V2) |
| **Blocks** | — |
| **Owner** | hermes |

**Objective:** Progressive Web App with offline support and push notifications.

**Scope:**
1. PWA manifest and service worker
2. Offline support (cache NKS, recent conversations)
3. Push notifications (payment confirmations, support updates)
4. Mobile-first UX polish (375px baseline)
5. Touch gesture support
6. Install prompt
7. Background sync for offline actions

**Acceptance Criteria:**
- [ ] PWA installable on iOS and Android
- [ ] Offline mode shows cached knowledge
- [ ] Push notifications arrive within 5s
- [ ] Touch gestures work (swipe, pinch)
- [ ] Lighthouse PWA score >90

---

### PHASE 50: Knowledge Base for AI (RAG)

| Field | Value |
|-------|-------|
| **Duration** | 2 weeks |
| **Budget** | 10,000t |
| **Priority** | P2 |
| **Depends On** | Phase 34 (OKF compliance), Phase 35 (visualizer) |
| **Blocks** | — |
| **Owner** | hermes |

**Objective:** Customer-facing AI chatbot powered by NKS + RAG.

**Scope:**
1. Build customer-facing chatbot widget (portal embed)
2. Implement RAG pipeline (embed NKS, query on customer questions)
3. Build knowledge graph queries (semantic search across cortex)
4. Build generative answer pipeline with citations
5. Implement human handoff when confidence < threshold
6. Build chatbot analytics (resolution rate, CSAT, topics)

**Acceptance Criteria:**
- [ ] Chatbot answers questions from NKS
- [ ] Citations link to source documents
- [ ] Human handoff triggers below confidence threshold
- [ ] Resolution rate tracked
- [ ] RAG pipeline updates when NKS changes

---

## 4. DEPENDENCY GRAPH

```
Phase 34 (OKF Compat)
  ├──→ Phase 35 (Visualizer)
  ├──→ Phase 36 (GitHub Release)
  └──→ Phase 43 (V2 Maturation) ──→ Phase 50 (RAG KB)

Phase 37 (Twenty Wave 1: Lead+VAPI)
  └──→ Phase 38 (Twenty Wave 2: Sales)
         ├──→ Phase 39 (Twenty Wave 3: Billing)
         │      ├──→ Phase 40 (Twenty Wave 4: Disputes)
         │      ├──→ Phase 44 (Reporting)
         │      └──→ Phase 42 (Portal)
         ├──→ Phase 41 (Twenty Wave 5: Support)
         │      ├──→ Phase 42 (Portal)
         │      └──→ Phase 46 (Email+SMS)
         └──→ Phase 45 (VAPI Voice)

Phase 42 (Portal) ──→ Phase 49 (Mobile PWA)

Phase 47 (Compliance) ──→ Phase 48 (Multi-tenancy)
```

### Critical Path (Longest Chain)

```
Phase 37 → Phase 38 → Phase 39 → Phase 42 → Phase 49
(2wk)     (2wk)      (2wk)      (3wk)      (3wk)
= 12 weeks
```

### Parallel Tracks

| Track | Phases | Duration |
|-------|--------|----------|
| **Knowledge Layer** | 34 → 35 → 36 → 50 | 6 weeks |
| **Twenty CRM** | 37 → 38 → 39 → 40 → 41 → 42 | 13 weeks |
| **Platform** | 43 → 45 → 46 | 5 weeks |
| **Ops** | 44 → 47 → 48 | 7 weeks |
| **Mobile** | 49 (after 42) | 3 weeks |

---

## 5. TIMELINE

### 5.1 Week-by-Week

| Week | Phase(s) Running | Budget | Status |
|------|-----------------|--------|--------|
| 1 | 34 (OKF Compat) | 8,000t | — |
| 2 | 35 (Visualizer), 37 (Twenty Wave 1) | 16,000t | — |
| 3 | 36 (GitHub Release), 37 cont., 38 (Twenty Wave 2) | 15,000t | — |
| 4 | 38 cont., 39 (Twenty Wave 3) | 12,000t | — |
| 5 | 39 cont., 40 (Twenty Wave 4) | 11,000t | — |
| 6 | 40 cont., 41 (Twenty Wave 5) | 10,000t | — |
| 7 | 41 cont., 43 (V2 Maturation) | 11,000t | — |
| 8 | 42 (Portal), 43 cont. | 13,500t | — |
| 9 | 42 cont. | 5,000t | — |
| 10 | 42 cont., 44 (Reporting) | 10,000t | — |
| 11 | 44 cont., 45 (VAPI Voice) | 9,000t | — |
| 12 | 45 cont., 46 (Email+SMS) | 7,000t | — |
| 13 | 47 (Compliance) | 4,000t | — |
| 14 | 47 cont., 48 (Multi-tenancy) | 9,000t | — |
| 15 | 48 cont. | 5,000t | — |
| 16 | 48 cont., 49 (Mobile PWA) | 8,000t | — |
| 17 | 49 cont. | 6,000t | — |
| 18 | 49 cont., 50 (RAG KB) | 7,000t | — |
| 19 | 50 cont. | 5,000t | — |
| 20 | Buffer / Hardening | 3,500t | — |

**Total: 20 weeks | ~155,000t**

### 5.2 Milestones

| Milestone | Week | Celebration |
|-----------|------|-------------|
| M1: Knowledge Layer Live | Week 3 | /knowledge route + GitHub spec published |
| M2: Sales Ops in Twenty | Week 4 | All 169 customers migrated, pipeline live |
| M3: Billing in Twenty | Week 6 | NMI integrated, recovery campaigns live |
| M4: Full CRM Migration | Week 9 | All 6 Twenty waves complete |
| M5: V2 Matured | Week 8 | Self-code + knowledge integration live |
| M6: Portal Live | Week 9 | Customers can self-serve |
| M7: Reporting Live | Week 11 | MRR + leaderboards + funnels |
| M8: Compliance Ready | Week 14 | SOC 2 controls documented |
| M9: Multi-tenant | Week 16 | Partner workspaces live |
| M10: Platform v1.0 | Week 20 | All phases complete, production hardened |

---

## 6. RESOURCE ALLOCATION

### 6.1 Agent Allocation

| Agent | Primary Phases | Secondary Phases |
|-------|---------------|-----------------|
| **hermes** (this agent) | 34, 35, 36, 43, 50 | All oversight |
| **skill-author** | 34 (skill files) | 50 (RAG content) |
| **mission-runner** | 37-42 (Twenty migration) | 44-49 |
| **V2 coding agent** | 43 (self-polish) | 35, 37, 42, 49 |
| **slack-bot** | Landings (all phases) | Monitoring |

### 6.2 Tool Budget by Agent

| Agent | Total Budget | Phases |
|-------|-------------|--------|
| hermes | 80,000t | All phases (primary executor) |
| skill-author | 15,000t | 34, 50 |
| mission-runner | 25,000t | 37-42 |
| V2 coding agent | 20,000t | 35, 37, 42, 43, 49 |
| slack-bot | 5,000t | All landings |
| **Total** | **145,000t** | + 10,000t buffer = 155,000t |

### 6.3 External Services Budget

| Service | Monthly Cost | Notes |
|---------|-------------|-------|
| Vercel Pro | $20/mo | Chat + V2 + Portal deployments |
| Neon Postgres | $19/mo | Serverless Postgres |
| Twenty Docker | $0 | Self-hosted on VPS |
| n8n | $0 | Self-hosted on VPS |
| NMI | $99/mo | Payment gateway (existing) |
| Resend | $20/mo | Email API |
| GHL | $97/mo | CRM bridge during migration |
| VAPI | $0.05/min | Voice AI |
| Clerk | $25/mo | Auth (existing) |
| **Total** | **~$280/mo** | |

---

## 7. RISK REGISTER

| ID | Risk | Severity | Probability | Mitigation | Phase |
|----|------|----------|-------------|------------|-------|
| R1 | NMI vault override by automated code | CRITICAL | LOW | SACRED rule enforced, code review required for any NMI code | 39 |
| R2 | Data loss during Base44→Twenty migration | HIGH | MEDIUM | Incremental migration (50 customers at a time), backup before each wave | 37-42 |
| R3 | Twenty Docker instability on VPS | MEDIUM | MEDIUM | Daily backups, VPS monitoring, rollback plan | 37-42 |
| R4 | OKF spec changes after our release | LOW | LOW | We are superset — any OKF changes are additive to us | 34-36 |
| R5 | Vercel deploy delays during critical push | MEDIUM | LOW | GitHub deployments as fallback, local dev always works | 11 |
| R6 | NKS spec too complex for community adoption | MEDIUM | MEDIUM | Progressive disclosure, good docs, sample bundles | 36 |
| R7 | V2 self-code corrupts knowledge layer | HIGH | LOW | Git-tracked, rollback-able, verification after every write | 43 |
| R8 | Customer data exposure in portal | CRITICAL | LOW | Clerk auth bridge, GraphQL row-level security, penetration test | 42 |
| R9 | Schedule slip on critical path (12 weeks) | HIGH | MEDIUM | Buffer weeks built in, parallel tracks when possible | All |
| R10 | Slack rate limits during landings | LOW | LOW | Batch messages, use threads, monitor rate limits | All |

### 7.1 Risk Heatmap

```
Probability
    HIGH │  R2  │       │  R9  │
         │      │       │      │
  MEDIUM │ R5   │ R3,R6 │      │ R7
         │      │       │      │
     LOW │ R10  │ R4    │ R1,R8│
         └──────┴───────┴──────┴──────
           LOW    MEDIUM  HIGH   CRITICAL
                    Severity
```

---

## 8. SUCCESS METRICS

### 8.1 Platform Metrics

| Metric | Current | Target (Post-Phase 50) |
|--------|---------|------------------------|
| Knowledge files NKS-conformant | 0% | 100% |
| OKF export validity | N/A | 100% pass |
| Twenty custom objects | 6 | 22 |
| Customers in Twenty | 0 | 2000+ |
| Base44 ↔ Twenty sync latency | N/A | <60s |
| Agent response time (Chat) | <5s | <3s |
| V2 coding agent success rate | ~70% | >90% |
| Portal load time (LCP) | N/A | <3s |
| Knowledge graph query time | N/A | <500ms |
| Customer self-service rate | 0% | >60% |
| MRR tracking accuracy | Manual | Automated ±1% |

### 8.2 OKF Community Metrics (Phase 36+)

| Metric | 1 Month Target | 6 Month Target |
|--------|---------------|----------------|
| GitHub stars | 50 | 500 |
| Community contributors | 2 | 20 |
| NKS-adopting projects | 1 (us) | 10 |
| Blog post views | 1,000 | 10,000 |

### 8.3 Business Metrics

| Metric | Current | Target |
|--------|---------|--------|
| MRR | $33,750 | $50,000+ |
| Enrolled customers | 169 | 300+ |
| Customer churn | Unknown (no tracking) | <5% monthly |
| Agent efficiency (leads/agent/day) | Unknown | Measured + optimized |
| Payment recovery rate | Unknown | >40% |

---

## 9. PHASE BUDGET SUMMARY

| Phase | Name | Weeks | Budget (t) | Priority | Status |
|-------|------|-------|-----------|----------|--------|
| 34 | OKF Compatibility Pass | 1 | 8,000 | P0 | PLANNED |
| 35 | Knowledge Visualizer | 1 | 6,000 | P0 | PLANNED |
| 36 | NKS GitHub Release | 1 | 5,000 | P0 | PLANNED |
| 37 | Twenty Wave 1: Lead+VAPI | 2 | 10,000 | P0 | PLANNED |
| 38 | Twenty Wave 2: Sales | 2 | 12,000 | P0 | PLANNED |
| 39 | Twenty Wave 3: Billing | 2 | 12,000 | P0 | PLANNED |
| 40 | Twenty Wave 4: Disputes | 2 | 10,000 | P0 | PLANNED |
| 41 | Twenty Wave 5: Support+Comms | 2 | 10,000 | P0 | PLANNED |
| 42 | Twenty Wave 6: Portal v2 | 3 | 15,000 | P0 | PLANNED |
| 43 | V2 Coding Agent Maturation | 2 | 12,000 | P0 | PLANNED |
| 44 | Reporting + Analytics | 2 | 10,000 | P1 | PLANNED |
| 45 | VAPI Voice Agent | 2 | 8,000 | P1 | PLANNED |
| 46 | Email + SMS Automation | 1 | 6,000 | P1 | PLANNED |
| 47 | Compliance + Audit | 2 | 8,000 | P0 | PLANNED |
| 48 | Multi-tenancy | 3 | 15,000 | P2 | PLANNED |
| 49 | Mobile PWA | 3 | 12,000 | P2 | PLANNED |
| 50 | Knowledge Base (RAG) | 2 | 10,000 | P2 | PLANNED |
| — | **Buffer** | — | 3,500 | — | — |
| **TOTAL** | **17 phases** | **20 weeks** | **155,000t** | | |

---

## END OF SPRINT PLAN

**Version:** 1.0.0
**Total Phases:** 17 (34-50)
**Timeline:** 16-20 weeks
**Total Budget:** ~155,000t
**North Star:** Neptune Platform v1.0 — Production AI Agent Platform

*"Augment. Do not compete. Be the reference implementation. Push hard. No ceiling."*

— Master Unified Sprint Plan v1.0, June 17, 2026
