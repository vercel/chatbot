# IMPLEMENTATION PLAN v1.0

## Neptune Platform v1.0 — Per-Phase Execution Guidance

**Version:** 1.0.0
**Date:** 2026-06-17
**Type:** implementation
**Status:** ACTIVE
**Owner:** hermes
**Dependencies:** MASTER-UNIFIED-SPRINT-PLAN v1.0, MASTER-TRD v1.0, MASTER-DESIGN-DOC v1.0, NAVIGATION-FLOWS v1.0
**Tags:** implementation, phase-plans, tasks, acceptance-criteria, testing, rollback

---

## TABLE OF CONTENTS

1. [Implementation Methodology](#1-implementation-methodology)
2. [Phase 34: OKF Compatibility Pass](#2-phase-34-okf-compatibility-pass)
3. [Phase 35: Knowledge Visualizer](#3-phase-35-knowledge-visualizer)
4. [Phase 36: NEPTUNE-KNOWLEDGE-SPEC GitHub Release](#4-phase-36-neptune-knowledge-spec-github-release)
5. [Phase 37: Twenty Wave 1 — Lead + VAPICall](#5-phase-37-twenty-wave-1--lead--vapicall)
6. [Phase 38: Twenty Wave 2 — Sales Workflow](#6-phase-38-twenty-wave-2--sales-workflow)
7. [Phase 39: Twenty Wave 3 — Billing Migration](#7-phase-39-twenty-wave-3--billing-migration)
8. [Phase 40: Twenty Wave 4 — Disputes](#8-phase-40-twenty-wave-4--disputes)
9. [Phase 41: Twenty Wave 5 — Support + Communications](#9-phase-41-twenty-wave-5--support--communications)
10. [Phase 42: Twenty Wave 6 — Customer Portal v2](#10-phase-42-twenty-wave-6--customer-portal-v2)
11. [Phase 43: V2 Coding Agent Maturation](#11-phase-43-v2-coding-agent-maturation)
12. [Phase 44: Reporting + Analytics](#12-phase-44-reporting--analytics)
13. [Phase 45: VAPI Voice Agent Integration](#13-phase-45-vapi-voice-agent-integration)
14. [Phase 46: Email + SMS Automation](#14-phase-46-email--sms-automation)
15. [Phase 47: Compliance + Audit](#15-phase-47-compliance--audit)
16. [Phase 48: Multi-tenancy](#16-phase-48-multi-tenancy)
17. [Phase 49: Mobile PWA](#17-phase-49-mobile-pwa)
18. [Phase 50: Knowledge Base (RAG)](#18-phase-50-knowledge-base-rag)

---

## 1. IMPLEMENTATION METHODOLOGY

### 1.1 Execution Protocol

Every phase follows this protocol:

```
1. DISPATCH  → Create mission.md, set status=dispatched, announce in Slack
2. SCOPE     → Read all prerequisite docs, verify dependencies met
3. BUILD     → Execute tasks sequentially, commit after each task
4. VERIFY    → Run acceptance criteria, typecheck, lint, build
5. TEST      → Live test on deployed URL
6. LAND      → Update phase status, post Slack landing report
7. ROLLBACK  → If failure: git revert, document post-mortem
```

### 1.2 Commit Standards

```
Format: <type>(<phase>): <description>

Types: feat, fix, refactor, docs, test, chore
Example: feat(phase34): add index.md to all skill directories
Example: fix(phase34): correct type field in playbook frontmatter
Example: docs(phase34): update log.md with migration changelog
```

### 1.3 Slack Landing Template

```
━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 PHASE <N> COMPLETE: <Name>
━━━━━━━━━━━━━━━━━━━━━━━━━
Status: ✅ COMPLETE
Duration: <X> hours
Tool Budget: <X>t used / <X>t allocated
Commits: <N>

✅ Acceptance Criteria: <M>/<N> passed
📄 Deliverables: <N> files
🔗 Deploy: <URL>
🔗 PR: <URL>

Next: Phase <N+1> — <Name>
━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 2. PHASE 34: OKF COMPATIBILITY PASS

### 2.1 Scope Summary

| Field | Value |
|-------|-------|
| **Duration** | 1 week |
| **Budget** | 8,000t |
| **Priority** | P0 — STRATEGIC |
| **Depends On** | Phase 33 complete |
| **Blocks** | Phases 35, 36, 43 |

### 2.2 Task Breakdown

| # | Task | Tool Budget | Dependencies | Deliverable |
|---|------|-------------|--------------|-------------|
| T1 | Inventory all cortex files | 200t | None | File manifest (cortex/index.md) |
| T2 | Add `type` field to all existing YAML frontmatter | 1,500t | T1 | Updated .md files (200+ files) |
| T3 | Create index.md for every directory | 1,000t | T1 | index.md files (50+ directories) |
| T4 | Create log.md for every domain | 500t | T1 | log.md files (15+ domains) |
| T5 | Migrate flat skill files to directory structure | 1,500t | T1 | skills/<name>/SKILL.md (200+ skills) |
| T6 | Write okf-export.ts script | 800t | T2-T5 | scripts/knowledge-layer/okf-export.ts |
| T7 | Write okf-verify.ts script | 600t | T2-T5 | scripts/knowledge-layer/okf-verify.ts |
| T8 | Write add-index-md.ts script | 400t | T2-T5 | scripts/knowledge-layer/add-index-md.ts |
| T9 | Write add-log-md.ts script | 400t | T2-T5 | scripts/knowledge-layer/add-log-md.ts |
| T10 | Write add-type-field.ts script | 400t | T2-T5 | scripts/knowledge-layer/add-type-field.ts |
| T11 | Test OKF export generation | 300t | T6 | Validated OKF bundle |
| T12 | Verify against OKF v0.1 spec | 200t | T7, T11 | Verification report |
| T13 | Generate static HTML visualizer | 200t | T11 | Visualizer HTML |

### 2.3 Acceptance Criteria

- [ ] AC-34.1: Every cortex directory contains index.md
- [ ] AC-34.2: Every domain directory contains log.md
- [ ] AC-34.3: All .md files have `type` field in YAML frontmatter
- [ ] AC-34.4: okf-export.ts runs without errors
- [ ] AC-34.5: okf-verify.ts passes with 0 errors
- [ ] AC-34.6: Exported OKF bundle is valid per OKF v0.1 spec
- [ ] AC-34.7: Static visualizer renders knowledge graph correctly
- [ ] AC-34.8: No broken links in exported bundle

### 2.4 Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Script overwrites valid files | Dry-run mode in all scripts, git diff before commit |
| Large file count causes timeout | Batch processing (100 files per batch) |
| OKF spec misinterpretation | Reference Google's sample bundles for conformance |

### 2.5 Testing Strategy

1. Run okf-verify.ts on current cortex → record baseline errors
2. Run add-type-field.ts with --dry-run → verify changes before commit
3. Run add-index-md.ts with --dry-run → verify indices
4. Full execution → run okf-verify.ts → must pass with 0 errors
5. Export OKF bundle → manually verify 5 random files
6. Validate with Google's visualizer (or equivalent)

### 2.6 Rollback Plan

```bash
git revert <commit-range>
# Individual scripts are idempotent — re-running produces same result
```

### 2.7 Slack Landing

```
🚀 PHASE 34 COMPLETE: OKF Compatibility Pass
Status: ✅ COMPLETE
Commits: ~15
Deliverables: 5 scripts + 200+ updated files + 50+ new files
OKF Export: Valid bundle generated
Verification: 0 errors
Next: Phase 35 — Knowledge Visualizer (1 week, 6,000t)
```

---

## 3. PHASE 35: KNOWLEDGE VISUALIZER

### 3.1 Scope Summary

| Field | Value |
|-------|-------|
| **Duration** | 1 week |
| **Budget** | 6,000t |
| **Priority** | P0 — USER-FACING |
| **Depends On** | Phase 34 |
| **Blocks** | — |

### 3.2 Task Breakdown

| # | Task | Tool Budget | Deliverable |
|---|------|-------------|-------------|
| T1 | Create knowledge parser library | 400t | lib/knowledge/parser.ts |
| T2 | Create graph builder (nodes from markdown links) | 600t | lib/knowledge/graph-builder.ts |
| T3 | Build knowledge-graph component (D3 force-directed) | 1,200t | components/knowledge/knowledge-graph.tsx |
| T4 | Build concept-card component (hover preview) | 400t | components/knowledge/concept-card.tsx |
| T5 | Build search-bar component | 400t | components/knowledge/search-bar.tsx |
| T6 | Build domain-filter component | 300t | components/knowledge/domain-filter.tsx |
| T7 | Build file-viewer component (markdown render) | 400t | components/knowledge/file-viewer.tsx |
| T8 | Build knowledge page (server component) | 600t | app/(harness)/knowledge/page.tsx |
| T9 | Build knowledge page (client component) | 600t | app/(harness)/knowledge/client.tsx |
| T10 | Add /knowledge route to navigation | 200t | Updated nav component |
| T11 | Implement Twin View toggle | 300t | Library/Playbook view switching |
| T12 | Live test + performance optimization | 200t | Verified production URL |

### 3.3 Acceptance Criteria

- [ ] AC-35.1: /knowledge route loads within 3 seconds
- [ ] AC-35.2: Force-directed graph renders with all cortex nodes
- [ ] AC-35.3: Hover on node shows concept card with metadata
- [ ] AC-35.4: Click node opens file viewer with markdown + syntax highlighting
- [ ] AC-35.5: Search returns results in <500ms
- [ ] AC-35.6: Domain filter filters graph in real-time
- [ ] AC-35.7: Type filter filters by skill/playbook/prd/mission
- [ ] AC-35.8: Twin View toggle switches between Library and Playbook
- [ ] AC-35.9: OKF export button downloads valid bundle
- [ ] AC-35.10: Graph supports zoom, pan, drag nodes
- [ ] AC-35.11: Mobile responsive (375px+)
- [ ] AC-35.12: Graph renders without errors (no console errors)

### 3.4 Testing Strategy

1. Unit test: parser.ts parses all NKS file types correctly
2. Unit test: graph-builder.ts produces valid nodes + edges
3. Component test: knowledge-graph renders without crashing
4. Integration test: /knowledge route serves page with graph
5. E2E test: search "billing" → graph filters → click node → file viewer opens
6. Performance test: Lighthouse audit (LCP <3s, no layout shifts)
7. Cross-browser: Chrome, Firefox, Safari

### 3.5 Rollback Plan

```bash
git revert <phase-35-commits>
# Knowledge visualizer is isolated — no effect on Chat core
```

---

## 4. PHASE 36: NEPTUNE-KNOWLEDGE-SPEC GITHUB RELEASE

### 4.1 Scope Summary

| Field | Value |
|-------|-------|
| **Duration** | 1 week |
| **Budget** | 5,000t |
| **Priority** | P0 — COMMUNITY |
| **Depends On** | Phases 34, 35 |

### 4.2 Task Breakdown

| # | Task | Tool Budget | Deliverable |
|---|------|-------------|-------------|
| T1 | Create GitHub repo `neptune-knowledge-spec` | 200t | github.com/abhiswami2121/neptune-knowledge-spec |
| T2 | Publish NEPTUNE-KNOWLEDGE-SPEC-v1.0.md as README | 300t | Repo README |
| T3 | Create reference implementation directory | 500t | reference-implementation/ |
| T4 | Create sample bundles (3) | 600t | samples/ (billing, GA4 comparison, generic) |
| T5 | Create public docs site (Vercel) | 1,000t | docs.neptune-knowledge-spec.vercel.app |
| T6 | Write blog post | 600t | Blog post (2,500+ words) |
| T7 | Write Twitter/X thread (10 tweets) | 300t | Thread content |
| T8 | Create CONTRIBUTING.md | 300t | CONTRIBUTING.md |
| T9 | Set up GitHub Discussions | 100t | Discussions enabled |
| T10 | Create comparison table (OKF v0.1 vs NKS v1.0) | 200t | COMPARISON.md |
| T11 | Publish everything | 100t | All live |
| T12 | Post to HN, Reddit, relevant communities | 500t | Community posts |

### 4.3 Acceptance Criteria

- [ ] AC-36.1: GitHub repo is public with complete README
- [ ] AC-36.2: Docs site live on Vercel with navigation
- [ ] AC-36.3: Blog post published (Medium or dev.to)
- [ ] AC-36.4: Twitter thread posted
- [ ] AC-36.5: CONTRIBUTING.md clear with PR template
- [ ] AC-36.6: 3 sample bundles validate against OKF v0.1
- [ ] AC-36.7: Comparison table accurate and compelling
- [ ] AC-36.8: GitHub Discussions enabled and welcoming

---

## 5. PHASE 37: TWENTY WAVE 1 — LEAD + VAPICALL

### 5.1 Scope Summary

| Field | Value |
|-------|-------|
| **Duration** | 2 weeks |
| **Budget** | 10,000t |
| **Priority** | P0 — OPERATIONAL |
| **Depends On** | Phase 33 |

### 5.2 Task Breakdown

| # | Task | Tool Budget | Deliverable |
|---|------|-------------|-------------|
| T1 | Define `lead` custom object (12 fields) | 600t | twenty-newleaf-extensions/src/objects/lead.field.ts |
| T2 | Define `vapiCall` custom object (15 fields) | 600t | twenty-newleaf-extensions/src/objects/vapi-call.field.ts |
| T3 | Build Slack submission parser (n8n workflow) | 800t | n8n workflow: slack-to-lead |
| T4 | Implement bidirectional lead sync | 1,200t | Sync connector: Base44 ↔ Twenty (leads) |
| T5 | Implement VAPI webhook → Twenty | 600t | Webhook handler for VAPI call events |
| T6 | Build Lead pipeline view | 1,000t | Twenty view configuration |
| T7 | Build VAPI call log view | 600t | Twenty view configuration |
| T8 | Migrate 50 test customers | 1,500t | Migration script + verification |
| T9 | Verify sync integrity | 500t | Sync report (no data loss) |
| T10 | Integration testing | 800t | Test suite |
| T11 | Documentation | 400t | Phase 37 runbook |
| T12 | Slack landing | 200t | Landing report |

### 5.3 Acceptance Criteria

- [ ] AC-37.1: `lead` object deployed in Twenty with all 12 fields
- [ ] AC-37.2: `vapiCall` object deployed with transcript + outcome fields
- [ ] AC-37.3: Slack submission creates lead in Twenty within 30s
- [ ] AC-37.4: Bidirectional sync: Base44 lead → Twenty lead → verified
- [ ] AC-37.5: Bidirectional sync: Twenty lead → Base44 lead → verified
- [ ] AC-37.6: VAPI webhook creates vapiCall record with transcript link
- [ ] AC-37.7: Lead pipeline kanban renders with 4 stages
- [ ] AC-37.8: VAPI call log renders with transcript preview
- [ ] AC-37.9: 50 customers migrated with data integrity verified
- [ ] AC-37.10: Zero data loss during migration

---

## 6. PHASE 38: TWENTY WAVE 2 — SALES WORKFLOW

### 6.1 Scope Summary

| Field | Value |
|-------|-------|
| **Duration** | 2 weeks |
| **Budget** | 12,000t |
| **Priority** | P0 — OPERATIONAL |
| **Depends On** | Phase 37 |

### 6.2 Task Breakdown

| # | Task | Tool Budget | Deliverable |
|---|------|-------------|-------------|
| T1 | Build Sales Pipeline kanban (full) | 1,500t | Twenty view |
| T2 | Create Enrollment wizard (7-step form) | 2,000t | defineFrontComponent |
| T3 | Build Agent Dashboard | 1,500t | defineFrontComponent |
| T4 | Define `agreement` custom object (10 fields) | 600t | agreement.field.ts |
| T5 | Define `paymentMethod` custom object (8 fields) | 600t | payment-method.field.ts |
| T6 | Implement document generation (agreement PDF) | 1,000t | PDF gen service |
| T7 | Implement e-signature flow | 800t | E-sign integration |
| T8 | Migrate all 169 enrolled customers | 1,500t | Migration script |
| T9 | Build Agent Leaderboard | 800t | defineFrontComponent |
| T10 | Build Quick Actions modal | 800t | QuickActionModals component |
| T11 | Testing + verification | 500t | Test suite |
| T12 | Slack landing | 200t | Landing report |

### 6.3 Acceptance Criteria

- [ ] AC-38.1: Sales Pipeline kanban supports drag-and-drop between stages
- [ ] AC-38.2: Enrollment wizard completes in ≤7 steps
- [ ] AC-38.3: Agent Dashboard loads in <1s
- [ ] AC-38.4: Agreement PDF generation takes <30s
- [ ] AC-38.5: E-signature flow completes end-to-end (test signature)
- [ ] AC-38.6: All 169 enrolled customers in Twenty
- [ ] AC-38.7: Agent Leaderboard updates in real-time
- [ ] AC-38.8: Quick Actions modal renders <200ms
- [ ] AC-38.9: Payment method linked to NMI vault (SACRED — read only)

---

## 7. PHASE 39: TWENTY WAVE 3 — BILLING MIGRATION

### 7.1 Scope Summary

| Field | Value |
|-------|-------|
| **Duration** | 2 weeks |
| **Budget** | 12,000t |
| **Priority** | P0 — SACRED (NMI) |
| **Depends On** | Phase 38 |

### 7.2 Task Breakdown

| # | Task | Tool Budget | Deliverable |
|---|------|-------------|-------------|
| T1 | Define `billingRecoveryTask` object (12 fields) | 600t | billing-recovery-task.field.ts |
| T2 | Refine `paymentRecord` object (14 fields) | 600t | payment-record.field.ts (refined) |
| T3 | Build Billing Calendar view | 1,200t | Twenty view |
| T4 | Build Recovery Campaign manager | 1,500t | defineFrontComponent |
| T5 | Build Payment Link Generator | 800t | defineFrontComponent |
| T6 | Implement card sync (NMI ↔ Twenty) | 1,500t | Card sync service (SACRED) |
| T7 | Build subscription management | 1,000t | Twenty view |
| T8 | Build decline recovery workflow | 1,200t | n8n workflow |
| T9 | Build Billing Dashboard | 1,000t | defineFrontComponent |
| T10 | Migrate billing data (169 customers) | 1,200t | Migration script |
| T11 | NMI vault audit | 400t | Audit report |
| T12 | Slack landing | 200t | Landing report |

### 7.3 Acceptance Criteria

- [ ] AC-39.1: NMI vault NEVER modified by automated processes
- [ ] AC-39.2: Billing Calendar renders all active subscriptions by date
- [ ] AC-39.3: Recovery Campaign creates tasks for all declined payments
- [ ] AC-39.4: Payment Link Generator produces valid NMI links
- [ ] AC-39.5: Card sync updates within 60s of NMI webhook
- [ ] AC-39.6: Subscription status syncs bidirectionally
- [ ] AC-39.7: Decline recovery retries up to 3 times
- [ ] AC-39.8: Billing Dashboard shows real-time MRR
- [ ] AC-39.9: All billing data migrated with no loss

---

## 8. PHASE 40: TWENTY WAVE 4 — DISPUTES

### 8.1 Key Tasks

| # | Task | Tool Budget |
|---|------|-------------|
| T1 | Define `disputeLetter` object (16 fields) | 600t |
| T2 | Define `negativeItem` object (14 fields) | 600t |
| T3 | Define `creditReport` object (10 fields) | 600t |
| T4 | Build Dispute Round pipeline (kanban) | 1,200t |
| T5 | Build Letter Generator (templates + merge) | 1,500t |
| T6 | Build Response Tracker | 1,000t |
| T7 | Build Bureau Integration (3 bureaus) | 1,200t |
| T8 | Build Dispute Dashboard | 800t |
| T9 | Implement FCRA compliance checks | 800t |
| T10 | Build Dispute Timeline view | 600t |
| T11 | Testing + migration | 600t |
| T12 | Slack landing | 200t |

### 8.2 Acceptance Criteria

- [ ] AC-40.1: Dispute Round pipeline tracks all stages
- [ ] AC-40.2: Letter Generator produces FCRA-compliant letters
- [ ] AC-40.3: Response Tracker shows 30-day bureau deadlines
- [ ] AC-40.4: All 3 bureaus tracked per dispute
- [ ] AC-40.5: Credit report parser extracts all negative items
- [ ] AC-40.6: Dispute dashboard shows success rate by bureau
- [ ] AC-40.7: FCRA compliance auto-flag catches issues before send

---

## 9. PHASE 41: TWENTY WAVE 5 — SUPPORT + COMMUNICATIONS

### 9.1 Key Tasks

| # | Task | Tool Budget |
|---|------|-------------|
| T1 | Refine `supportTicket` object (SLA, auto-assign) | 800t |
| T2 | Define `emailMessage` object (10 fields) | 500t |
| T3 | Define `smsMessage` object (8 fields) | 500t |
| T4 | Define `callLog` object (12 fields) | 500t |
| T5 | Build Unified Inbox (email + SMS + calls + Slack) | 1,500t |
| T6 | Build SLA enforcement | 1,000t |
| T7 | Build Customer 360 view | 1,500t |
| T8 | Build Compose interface | 800t |
| T9 | Build Communications timeline | 600t |
| T10 | Build Support Analytics | 800t |
| T11 | Integration testing | 600t |
| T12 | Slack landing | 200t |

### 9.2 Acceptance Criteria

- [ ] AC-41.1: Unified Inbox shows all channels in one view
- [ ] AC-41.2: SLA breach triggers Slack alert within 5 minutes
- [ ] AC-41.3: Customer 360 loads in <2s with all related data
- [ ] AC-41.4: Compose sends email via Resend
- [ ] AC-41.5: Compose sends SMS via GHL
- [ ] AC-41.6: Communications timeline is chronological and complete
- [ ] AC-41.7: Support analytics dashboard functional

---

## 10. PHASE 42: TWENTY WAVE 6 — CUSTOMER PORTAL V2

### 10.1 Key Tasks

| # | Task | Tool Budget |
|---|------|-------------|
| T1 | Scaffold Portal Next.js app (Vercel) | 600t |
| T2 | Implement Twenty GraphQL read client | 1,000t |
| T3 | Build Account Home page | 1,200t |
| T4 | Build Payments page | 1,500t |
| T5 | Build Documents page | 1,000t |
| T6 | Build Disputes page | 1,200t |
| T7 | Build Messages page | 1,000t |
| T8 | Build Profile page | 800t |
| T9 | Implement Clerk auth + Twenty JWT bridge | 1,500t |
| T10 | Mobile-first responsive (all pages) | 1,200t |
| T11 | Accessibility audit (WCAG 2.1 AA) | 800t |
| T12 | Performance optimization | 800t |
| T13 | End-to-end testing | 1,000t |
| T14 | Deploy + live test | 600t |
| T15 | Slack landing | 200t |

### 10.2 Acceptance Criteria

- [ ] AC-42.1: Portal loads for authenticated customer
- [ ] AC-42.2: Account Home shows accurate summary cards
- [ ] AC-42.3: Payment history matches NMI records exactly
- [ ] AC-42.4: Document download works (PDF)
- [ ] AC-42.5: Dispute status matches Twenty data
- [ ] AC-42.6: Message compose sends via Resend/GHL
- [ ] AC-42.7: Clerk ↔ Twenty auth bridge verified
- [ ] AC-42.8: Mobile responsive passes Lighthouse (>90)
- [ ] AC-42.9: WCAG 2.1 AA compliance (>90% checks)

---

## 11. PHASE 43: V2 CODING AGENT MATURATION

### 11.1 Key Tasks

| # | Task | Tool Budget |
|---|------|-------------|
| T1 | Polish swarm mode (multi-agent coordination) | 1,500t |
| T2 | Implement MoA orchestration | 1,500t |
| T3 | Polish GitHub PR workflow | 1,200t |
| T4 | Polish Vercel deploy flow | 1,000t |
| T5 | Integrate knowledge graph (load NKS context) | 1,200t |
| T6 | Implement self-code capability | 1,500t |
| T7 | Build coding agent analytics | 1,000t |
| T8 | Implement sandbox persistence | 1,000t |
| T9 | Build session resume | 800t |
| T10 | Performance optimization (<5s TTFT) | 800t |
| T11 | Slack landing | 200t |

### 11.2 Acceptance Criteria

- [ ] AC-43.1: Swarm mode completes multi-file tasks with coordination
- [ ] AC-43.2: MoA orchestration routes to correct sub-agent
- [ ] AC-43.3: GitHub PR workflow works end-to-end
- [ ] AC-43.4: Vercel deploy works for generated code
- [ ] AC-43.5: Knowledge context loaded for every coding session
- [ ] AC-43.6: Self-code writes back to cortex with git tracking
- [ ] AC-43.7: Sandbox workspace survives agent restart
- [ ] AC-43.8: Session resume works within 24h
- [ ] AC-43.9: First token <5s for 90% of requests

---

## 12. PHASE 44: REPORTING + ANALYTICS

### 12.1 Key Tasks

| # | Task | Tool Budget |
|---|------|-------------|
| T1 | Build MRR Dashboard | 1,500t |
| T2 | Build Agent Leaderboard | 1,200t |
| T3 | Build Pipeline Funnel | 1,000t |
| T4 | Build Custom Report Builder | 1,500t |
| T5 | Implement CSV/PDF export | 800t |
| T6 | Build scheduled report delivery | 1,000t |
| T7 | Build Sync Health Dashboard | 1,000t |
| T8 | Build System Health Dashboard | 1,000t |
| T9 | Testing + polish | 600t |
| T10 | Slack landing | 200t |

### 12.2 Acceptance Criteria

- [ ] AC-44.1: MRR Dashboard updates daily (automated)
- [ ] AC-44.2: Agent Leaderboard real-time (WebSocket)
- [ ] AC-44.3: Pipeline Funnel accurate to actual data
- [ ] AC-44.4: Custom reports exportable to CSV and PDF
- [ ] AC-44.5: Scheduled reports deliver on time (±5 min)
- [ ] AC-44.6: Sync Health shows discrepancy count and affected records
- [ ] AC-44.7: System Health shows 7-day trends

---

## 13. PHASE 45: VAPI VOICE AGENT INTEGRATION

### 13.1 Key Tasks

| # | Task | Tool Budget |
|---|------|-------------|
| T1 | Build outbound campaign manager | 1,500t |
| T2 | Implement inbound IVR with skill routing | 1,200t |
| T3 | Build Call Analysis dashboard | 1,000t |
| T4 | Implement call recording storage | 800t |
| T5 | Build campaign performance analytics | 800t |
| T6 | Implement DNC compliance | 600t |
| T7 | VAPI integration testing | 1,000t |
| T8 | Documentation + runbook | 500t |
| T9 | Slack landing | 200t |

### 13.2 Acceptance Criteria

- [ ] AC-45.1: Outbound campaign sends VAPI calls to target list
- [ ] AC-45.2: Inbound IVR routes caller to correct skill
- [ ] AC-45.3: Call transcripts searchable with keyword matching
- [ ] AC-45.4: DNC list enforced (attempts blocked, logged)
- [ ] AC-45.5: Campaign analytics show conversion and answer rates

---

## 14. PHASE 46: EMAIL + SMS AUTOMATION

### 14.1 Key Tasks

| # | Task | Tool Budget |
|---|------|-------------|
| T1 | Resend integration (transactional + marketing) | 800t |
| T2 | Build Drip Sequence builder | 1,200t |
| T3 | Build SMS automation triggers | 1,000t |
| T4 | Build email template library | 800t |
| T5 | Build campaign analytics | 800t |
| T6 | Testing (all sequences, all triggers) | 800t |
| T7 | Slack landing | 200t |

### 14.2 Acceptance Criteria

- [ ] AC-46.1: Transactional emails send within 30s of trigger
- [ ] AC-46.2: Drip sequences trigger on enrollment (7-step sequence)
- [ ] AC-46.3: SMS sends via GHL within 10s of trigger
- [ ] AC-46.4: Template library accessible from Twenty (Compose)
- [ ] AC-46.5: Campaign analytics show open rate, click rate, conversion

---

## 15. PHASE 47: COMPLIANCE + AUDIT

### 15.1 Key Tasks

| # | Task | Tool Budget |
|---|------|-------------|
| T1 | SOC 2 controls documentation | 1,500t |
| T2 | Secret rotation automation | 1,000t |
| T3 | Comprehensive audit logging | 1,200t |
| T4 | Automated backup verification | 800t |
| T5 | Access control audit | 800t |
| T6 | Data retention policy implementation | 600t |
| T7 | Vulnerability scanning integration | 600t |
| T8 | Incident response playbook | 600t |
| T9 | Testing + verification | 600t |
| T10 | Slack landing | 200t |

### 15.2 Acceptance Criteria

- [ ] AC-47.1: SOC 2 controls documented (all 12 trust criteria)
- [ ] AC-47.2: Secrets rotate on schedule (verifiable)
- [ ] AC-47.3: Audit log captures all mutations (create, update, delete)
- [ ] AC-47.4: Backups verified daily (automated check)
- [ ] AC-47.5: Access control matrix reviewed and documented
- [ ] AC-47.6: Data retention enforced (logs, PII, backups)
- [ ] AC-47.7: Vulnerability scan passes (0 critical/high)

---

## 16. PHASE 48: MULTI-TENANCY

### 16.1 Key Tasks

| # | Task | Tool Budget |
|---|------|-------------|
| T1 | Build Partner Workspace system | 2,500t |
| T2 | Implement RBAC matrix | 2,000t |
| T3 | Build white-label configuration | 1,500t |
| T4 | Build partner onboarding flow | 1,500t |
| T5 | Implement cross-workspace reporting | 1,500t |
| T6 | Build billing per workspace | 1,200t |
| T7 | Data isolation testing | 1,500t |
| T8 | Performance testing (multi-tenant) | 1,000t |
| T9 | Documentation | 1,000t |
| T10 | Slack landing | 200t |

### 16.2 Acceptance Criteria

- [ ] AC-48.1: Partner data isolated — no cross-workspace leakage
- [ ] AC-48.2: RBAC enforced on all endpoints (tested)
- [ ] AC-48.3: White-label renders correct logo, colors, domain
- [ ] AC-48.4: Partner onboarding completes in <1 hour
- [ ] AC-48.5: Cross-workspace reporting correct (admin view)
- [ ] AC-48.6: Workspace billing accurate per workspace

---

## 17. PHASE 49: MOBILE PWA

### 17.1 Key Tasks

| # | Task | Tool Budget |
|---|------|-------------|
| T1 | PWA manifest + service worker | 1,000t |
| T2 | Offline support (cache NKS, conversations) | 1,500t |
| T3 | Push notifications | 1,500t |
| T4 | Mobile-first UX polish (375px) | 2,000t |
| T5 | Touch gesture support | 1,000t |
| T6 | Install prompt | 600t |
| T7 | Background sync | 1,000t |
| T8 | Lighthouse audit + optimization | 1,000t |
| T9 | Cross-device testing | 1,000t |
| T10 | Slack landing | 200t |

### 17.2 Acceptance Criteria

- [ ] AC-49.1: PWA installable on iOS Safari and Android Chrome
- [ ] AC-49.2: Offline mode shows cached knowledge and recent conversations
- [ ] AC-49.3: Push notifications arrive within 5s (tested)
- [ ] AC-49.4: Touch gestures work (swipe, pinch-zoom, long-press)
- [ ] AC-49.5: Lighthouse PWA score >90

---

## 18. PHASE 50: KNOWLEDGE BASE (RAG)

### 18.1 Key Tasks

| # | Task | Tool Budget |
|---|------|-------------|
| T1 | Build customer-facing chatbot widget | 1,500t |
| T2 | Implement RAG pipeline (embed NKS) | 2,000t |
| T3 | Build knowledge graph queries (semantic search) | 1,500t |
| T4 | Build generative answer pipeline with citations | 1,500t |
| T5 | Implement human handoff | 800t |
| T6 | Build chatbot analytics | 800t |
| T7 | Testing + evaluation | 1,000t |
| T8 | Documentation | 500t |
| T9 | Slack landing | 200t |

### 18.2 Acceptance Criteria

- [ ] AC-50.1: Chatbot answers customer questions from NKS content
- [ ] AC-50.2: Answers include citations linking to source documents
- [ ] AC-50.3: Human handoff triggers when AI confidence <80%
- [ ] AC-50.4: Resolution rate tracked and >50% within 30 days
- [ ] AC-50.5: RAG pipeline updates within 5 minutes of NKS change
- [ ] AC-50.6: Chatbot does not hallucinate (verified by evaluation)

---

## END OF IMPLEMENTATION PLAN

**Version:** 1.0.0
**Phases Detailed:** 17 (Phases 34-50)
**Total Tasks:** ~165 tasks across all phases
**Total Budget:** ~155,000t
**Testing Strategy:** Unit + Integration + E2E + Live URL verification per phase
**Rollback:** Git revert per phase, idempotent operations where possible

*"Implementation is where strategy meets execution. Every phase has a plan. Every task has a budget. Every deliverable has acceptance criteria."*

— Implementation Plan v1.0, June 17, 2026
