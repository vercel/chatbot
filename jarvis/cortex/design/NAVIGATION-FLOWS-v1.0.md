---
type: "design"
name: "NAVIGATION FLOWS V1.0"
description: "Auto-generated description for NAVIGATION FLOWS V1.0"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# NAVIGATION FLOWS v1.0

## Neptune Platform v1.0 — Complete Navigation Specification

**Version:** 1.0.0
**Date:** 2026-06-17
**Type:** navigation
**Status:** ACTIVE
**Owner:** hermes
**Dependencies:** MASTER-DESIGN-DOC v1.0, MASTER-TRD v1.0
**Tags:** navigation, routes, flows, wireframes, ux, click-paths

---

## TABLE OF CONTENTS

1. [Route Map — Neptune Chat](#1-route-map--neptune-chat)
2. [Route Map — Neptune V2](#2-route-map--neptune-v2)
3. [Route Map — Customer Portal](#3-route-map--customer-portal)
4. [Twenty CRM Navigation Per Role](#4-twenty-crm-navigation-per-role)
5. [ASCII Wireframes — Major Screens](#5-ascii-wireframes--major-screens)
6. [Click Paths — Common Workflows](#6-click-paths--common-workflows)
7. [API Route Catalog](#7-api-route-catalog)
8. [Cross-App Navigation](#8-cross-app-navigation)

---

## 1. ROUTE MAP — NEPTUNE CHAT

### 1.1 Page Routes

```
/                                    → Chat home (active session or new)
/chat/[id]                           → Specific conversation
/knowledge                           → OKF knowledge visualizer (NEW — Phase 35)
/library                             → Library (skills, playbooks, PRDs)
/library/playbooks/[domain]          → Domain playbook view
/library/connectors/[name]           → Connector detail
/library/workflows                   → Workflow library
/command-center                      → Command Center (Twenty CRM iframe + controls)
/admin/migration                     → Twenty migration dashboard
/admin/audit                         → Audit log viewer
/admin/roadmap                       → Master roadmap dashboard (NEW — Phase 35)
/settings                            → User settings
/settings/profile                    → Profile settings
/settings/api-keys                   → API key management
/settings/notifications              → Notification preferences
/sign-in                             → Authentication
/sign-up                             → Registration
```

### 1.2 Navigation Structure

```
TOP NAV BAR (persistent across all routes):
┌──────────────────────────────────────────────────────────┐
│ [⚡ Neptune]  Chat  Knowledge  Library  Command Center   │
│                                          [🔔] [👤 ⚙️]   │
└──────────────────────────────────────────────────────────┘

SIDE NAV (Library section, collapsible):
┌─────────────────────┐
│ LIBRARY             │
├─────────────────────┤
│ 📁 Skills           │
│ 📁 Playbooks        │
│   → billing         │
│   → support-triage  │
│   → credit-disputes │
│   → ...             │
│ 📁 PRDs             │
│ 📁 Missions         │
│ 📁 Research         │
│ 📁 Connectors       │
│ 📁 Workflows        │
├─────────────────────┤
│ ⚡ Quick Links       │
│ /knowledge          │
│ /command-center     │
│ /admin/roadmap      │
└─────────────────────┘
```

### 1.3 Route Transition Map

```
/sign-in ──(auth success)──→ /command-center (default landing for agents)
                            → / (if no default set)

/ ──(Cmd+K "knowledge")──→ /knowledge
/ ──(library icon)───────→ /library
/ ──(Cmd+K "roadmap")────→ /admin/roadmap
/ ──(Cmd+K "settings")───→ /settings

/knowledge ──(click node)──→ file viewer modal (overlay)
/knowledge ──(click type)──→ /library?type=skill&filter=billing
/knowledge ──(OKF export)──→ download .zip

/library ──(click skill)───→ /library/skills/<skill-name>
/library ──(click playbook)→ /library/playbooks/<domain>
/library ──(click PRD)─────→ /library/prd/<prd-name>

/command-center ──(Twenty nav)→ routes handled within Twenty iframe
/command-center ──(Chat interaction)→ /chat/[new-id]

/admin/roadmap ──(click phase)→ expand phase detail (accordion)
/admin/roadmap ──(dispatch)───→ triggers mission creation
```

---

## 2. ROUTE MAP — NEPTUNE V2

### 2.1 Page Routes

```
/v2                                 → V2 home (session list)
/v2/sessions/[id]                   → Specific coding session
/v2/repos                           → Connected GitHub repositories
/v2/repos/[owner]/[repo]            → Repository detail (branches, PRs)
/v2/sandboxes                       → Active sandbox environments
/v2/sandboxes/[id]                  → Sandbox terminal + files
/v2/workflows                       → Active workflows
/v2/workflows/[id]                  → Workflow execution detail
/v2/knowledge                       → Knowledge graph (mirror of Chat's /knowledge)
/v2/knowledge/file/[path]           → View specific NKS file
/v2/settings                        → V2 settings
/v2/settings/github                 → GitHub connection
/v2/settings/vercel                 → Vercel deployment settings
```

### 2.2 Navigation Structure

```
V2 TOP NAV:
┌──────────────────────────────────────────────────────┐
│ [⚡ V2]  Sessions  Repos  Sandboxes  Workflows       │
│  Knowledge  [🔔] [👤]                                │
└──────────────────────────────────────────────────────┘

V2 SESSION VIEW:
┌──────────────────────────────────────────────────────┐
│ ← Sessions    Session: feat/billing-dashboard        │
├──────────────────────────────────────────────────────┤
│ ┌─────────────────────────┐ ┌──────────────────────┐ │
│ │ CODE VIEW               │ │ SESSION INFO         │ │
│ │ (CodeMirror)            │ │ Status: coding       │ │
│ │                         │ │ Repo: newleaf-fin     │ │
│ │ import { BillingCard }  │ │ Branch: feat/bill...  │ │
│ │ from '@/components';    │ │ Tools used: 42        │ │
│ │                         │ │ Tokens: 150K          │ │
│ │ export function         │ │ Cost: $0.15           │ │
│ │ BillingDashboard() {    │ │                       │ │
│ │   return (              │ │ PR: #123 (open)       │ │
│ │     <div>               │ │ Deploy: ✓ live        │ │
│ │       <BillingCard />   │ │                       │ │
│ │     </div>              │ │ [Open PR] [Deploy]   │ │
│ │   );                    │ └──────────────────────┘ │
│ │ }                       │                          │
│ └─────────────────────────┘                          │
├──────────────────────────────────────────────────────┤
│ [Terminal]  main ~/newleaf-financial                 │
│ $ pnpm build                                         │
│ ✓ Compiled in 2.3s                                   │
└──────────────────────────────────────────────────────┘
```

---

## 3. ROUTE MAP — CUSTOMER PORTAL

### 3.1 Page Routes

```
portal.newleaf.financial/                             → Account Home
portal.newleaf.financial/payments                     → Payment History + Methods
portal.newleaf.financial/documents                    → Documents (agreements, letters, reports)
portal.newleaf.financial/disputes                     → Dispute Status Tracker
portal.newleaf.financial/disputes/[id]                → Specific dispute round detail
portal.newleaf.financial/messages                     → Message Center (email/SMS history)
portal.newleaf.financial/profile                      → Profile + Contact Preferences
portal.newleaf.financial/settings                     → Account Settings
portal.newleaf.financial/sign-in                      → Clerk Auth
portal.newleaf.financial/sign-up                      → Registration
```

### 3.2 Portal Navigation

```
PORTAL TOP NAV:
┌──────────────────────────────────────────────────────┐
│ [🏦 NewLeaf]  Home  Payments  Documents  Disputes    │
│  Messages  Profile                        [👤 ▼]    │
└──────────────────────────────────────────────────────┘

MOBILE PORTAL (375px):
┌─────────────────────┐
│ ☰ NewLeaf           │
├─────────────────────┤
│                     │
│  ACCOUNT HOME       │
│                     │
│  ┌───────────────┐  │
│  │ Next Payment  │  │
│  │ June 15, 2026 │  │
│  │ $149.00       │  │
│  │ [Pay Now]     │  │
│  └───────────────┘  │
│                     │
│  ┌───────────────┐  │
│  │ Active        │  │
│  │ Disputes: 2   │  │
│  │ [View →]     │  │
│  └───────────────┘  │
│                     │
│  ┌───────────────┐  │
│  │ Recent        │  │
│  │ Activity      │  │
│  │ • Payment     │  │
│  │ • Letter sent │  │
│  └───────────────┘  │
│                     │
├─────────────────────┤
│ 🏠 💳 📄 ⚖️ 💬 👤  │
└─────────────────────┘
```

---

## 4. TWENTY CRM NAVIGATION PER ROLE

### 4.1 Sales Agent Navigation

```
HOME (Dashboard)
├── 📊 PIPELINE (Kanban)
│   ├── New Lead
│   ├── Contacted
│   ├── Consultation Scheduled
│   ├── Proposal Sent
│   ├── Negotiation
│   └── Enrolled
│       └── → Enrollment Wizard
├── 👤 PERSON VIEW
│   ├── Profile
│   ├── Activity Timeline
│   ├── Credit Report Summary
│   ├── Documents
│   └── → Quick Actions Modal
├── 📋 ENROLLMENT WIZARD (multi-step)
│   ├── Step 1: Personal Info
│   ├── Step 2: Credit Authorization
│   ├── Step 3: Credit Report Review
│   ├── Step 4: Plan Selection
│   ├── Step 5: Payment Method
│   ├── Step 6: Agreement + E-Sign
│   └── Step 7: Welcome + Next Steps
└── 📈 LEADERBOARD
    ├── My Stats
    ├── Team Stats
    └── Monthly Targets
```

### 4.2 Billing Agent Navigation

```
HOME (Dashboard)
├── 💳 RECOVERY BOARD (Kanban)
│   ├── Payment Due Today
│   ├── 1 Day Past Due
│   ├── 3 Days Past Due
│   ├── 7 Days Past Due
│   └── Collections
├── 📅 BILLING CALENDAR
│   ├── Month View
│   ├── Week View
│   └── Day View (with charge amounts)
├── 🔄 SUBSCRIPTIONS
│   ├── Active
│   ├── Past Due
│   ├── Cancelled
│   └── Trial
├── 💰 PAYMENT RECORDS
│   ├── All Transactions
│   ├── Successful
│   ├── Declined
│   └── Refunded
├── 🔗 PAYMENT METHODS
│   ├── Active Cards
│   ├── Expired Cards
│   └── NMI Vault Sync (SACRED)
└── 📊 BILLING ANALYTICS
    ├── MRR Dashboard
    ├── Churn Rate
    └── Recovery Rate
```

### 4.3 Support Agent Navigation

```
HOME (Inbox)
├── 📥 UNIFIED INBOX
│   ├── Filter: All Channels
│   ├── Email (Resend)
│   ├── SMS (GHL)
│   ├── Calls (VAPI + Freshcaller)
│   └── Slack Messages
├── ⏱️ SLA DASHBOARD
│   ├── Breach Alerts
│   ├── Response Time
│   └── Resolution Time
├── 👤 CUSTOMER 360
│   ├── Profile Summary
│   ├── Payment History
│   ├── Dispute Status
│   ├── Communication Timeline
│   ├── All Tickets
│   └── Documents
├── 🎫 TICKET DETAIL
│   ├── Messages
│   ├── Internal Notes
│   ├── Attachments
│   └── Resolution
└── ✍️ COMPOSE
    ├── Email
    ├── SMS
    └── Trigger Call
```

### 4.4 Recovery Agent Navigation

```
HOME (Task Queue)
├── 📝 RECOVERY TASKS
│   ├── Today
│   ├── Overdue
│   └── Upcoming
├── ❌ FAILED PAYMENTS
│   ├── Recent Declines
│   ├── Retry Queue
│   └── Update Payment Method
├── ✏️ DISPUTE LETTERS
│   ├── Draft
│   ├── Ready to Send
│   └── Sent (Awaiting Response)
├── 📬 OUTREACH
│   ├── Payment Reminder
│   ├── Update Request
│   └── Follow-up
└── 📊 RECOVERY ANALYTICS
    ├── Recovery Rate
    ├── Average Recovery Time
    └── By Agent
```

### 4.5 Admin Navigation

```
HOME (Overview)
├── 📊 REPORTS
│   ├── MRR Dashboard
│   ├── Enrollment Funnel
│   ├── Agent Leaderboard
│   └── Custom Report Builder
├── 🏆 LEADERBOARD
│   ├── Sales: Enrollments
│   ├── Billing: Recoveries
│   └── Support: Resolutions
├── 💚 SYSTEM HEALTH
│   ├── Uptime (All Services)
│   ├── Sync Health (Twenty ↔ Base44)
│   ├── Error Rates
│   └── Resource Usage (VPS)
├── 🔍 AUDIT LOG
│   ├── All Changes
│   ├── By User/Agent
│   ├── By Entity
│   └── Export
├── ⚙️ SETTINGS
│   ├── User Management
│   ├── Role Management
│   ├── Workflow Configuration
│   └── Integration Settings
└── 🗺️ ROADMAP
    ├── Phase Progress
    ├── Sprint Board
    └── Risk Register
```

---

## 5. ASCII WIREFRAMES — MAJOR SCREENS

### 5.1 Chat Home (/)

```
┌──────────────────────────────────────────────────────────────┐
│ [⚡ Neptune] Chat  Knowledge  Library  Cmd Center  [👤 ⚙️] │
├──────────────────────────────────────────────────────────────┤
│ ┌────────┐ ┌─────────────────────────────┐ ┌──────────────┐ │
│ │ LIBRARY│ │                             │ │ COMMAND CTR  │ │
│ │        │ │  ┌─────────────────────┐    │ │              │ │
│ │ Skills │ │  │ AI: Welcome back,  │    │ │ ┌──────────┐ │ │
│ │  bill..│ │  │ Agent. How can I   │    │ │ │PIPELINE  │ │ │
│ │  supp..│ │  │ help today?        │    │ │ │ ┌──┬──┐  │ │ │
│ │        │ │  └─────────────────────┘    │ │ │ │Ld│In│  │ │ │
│ │ Playb..│ │                             │ │ │ └──┴──┘  │ │ │
│ │  bill..│ │  ┌─────────────────────┐    │ │ └──────────┘ │ │
│ │  supp..│ │  │ User: Show John     │    │ │              │ │
│ │        │ │  │ Doe's payments      │    │ │ ┌──────────┐ │ │
│ │ PRDs   │ │  └─────────────────────┘    │ │ │TASKS     │ │ │
│ │  pha.. │ │                             │ │ │ ⚡ 3 due  │ │ │
│ │  pha.. │ │  ┌─────────────────────┐    │ │ │ 📝 2 pen  │ │ │
│ │        │ │  │ AI: [Payment Table] │    │ │ └──────────┘ │ │
│ │ Miss.. │ │  │                     │    │ │              │ │
│ │        │ │  │ June 1  $149 ✓      │    │ │ ┌──────────┐ │ │
│ │        │ │  │ May 1   $149 ✓      │    │ │ │METRICS   │ │ │
│ │        │ │  │ Apr 1   $149 ✗      │    │ │ │ MRR: $33K │ │ │
│ │        │ │  └─────────────────────┘    │ │ │ Enr: 169  │ │ │
│ └────────┘ │                             │ │ └──────────┘ │ │
│            ├─────────────────────────────┤ └──────────────┘ │
│            │ [📎 Attach] Type here...    │ [Send →] [⚡]    │
└────────────┴─────────────────────────────┴──────────────────┘
```

### 5.2 Knowledge Visualizer (/knowledge)

```
┌──────────────────────────────────────────────────────────────┐
│ [⚡ Neptune] ← Chat  KNOWLEDGE          [Library ▼] [Export]│
├──────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ 🔍 Search knowledge...  [Type ▼] [Domain ▼] [Sort ▼]    │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                               │
│ ┌─────────────────────────┐ ┌──────────────────────────────┐ │
│ │                         │ │ 📄 billing-flow/SKILL.md     │ │
│ │    ●───────●            │ │ ───────────────────────       │ │
│ │    │        \           │ │ type: skill                  │ │
│ │    ●    ●────●──●──●    │ │ domain: billing              │ │
│ │    │    │     \/   │    │ │ version: 2.3.0               │ │
│ │    ●────●      ●    │   │ │ mcp: nmi, slack              │ │
│ │         \      │    │   │ │                              │ │
│ │          ●─────●────●   │ │ # Billing Flow Agent         │ │
│ │                         │ │                              │ │
│ │          ⚡ D3 FORCE     │ │ Handles payment collection, │ │
│ │          DIRECTED       │ │ decline recovery, and       │ │
│ │          GRAPH          │ │ billing inquiries.          │ │
│ │                         │ │                              │ │
│ │  ● = skill              │ │ ## Procedures               │ │
│ │  ■ = playbook           │ │ 1. Validate NMI vault...   │ │
│ │  ◆ = prd                │ │ 2. Check subscription...   │ │
│ │  ▲ = mission            │ │ 3. Process payment...      │ │
│ │                         │ │                              │ │
│ │ [Reset] [Zoom +] [-]   │ │ [Open Full File] [Links: 8] │ │
│ └─────────────────────────┘ └──────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 5.3 Command Center (/command-center)

```
┌──────────────────────────────────────────────────────────────┐
│ [⚡ Neptune] Chat  Knowledge  Library  CMD CTR  [👤 ⚙️]    │
├──────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ COMMAND CENTER                          [Fullscreen ⛶]  │ │
│ ├──────────────────────────────────────────────────────────┤ │
│ │                                                          │ │
│ │  ┌────────────────────────────────────────────────────┐ │ │
│ │  │                TWENTY CRM IFRAME                   │ │ │
│ │  │                                                    │ │ │
│ │  │  ┌──────────┬──────────┬──────────┬──────────┐    │ │ │
│ │  │  │ PIPELINE │ PERSON   │ CALENDAR │ REPORTS  │    │ │ │
│ │  │  └──────────┴──────────┴──────────┴──────────┘    │ │ │
│ │  │                                                    │ │ │
│ │  │  [Twenty CRM content rendered here]               │ │ │
│ │  │                                                    │ │ │
│ │  └────────────────────────────────────────────────────┘ │ │
│ │                                                          │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 5.4 Roadmap Dashboard (/admin/roadmap)

```
┌──────────────────────────────────────────────────────────────┐
│ [⚡ Neptune] ← Admin  ROADMAP                               │
├──────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ MASTER ROADMAP — Neptune Platform v1.0    [Export ▼]    │ │
│ │ Progress: ████████░░░░░░░░░░ 38% (5 of 17 phases)      │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                               │
│ PHASE 34: OKF Compatibility     [████████░░] 80%  ⚡ACTIVE   │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Budget: 8,000t │ Elapsed: 2h │ Remaining: ~1h           │ │
│ │ AC-1: [✓] index.md everywhere  AC-4: [ ] OKF export     │ │
│ │ AC-2: [✓] log.md everywhere    AC-5: [ ] Verification   │ │
│ │ AC-3: [✓] type field added     AC-6: [ ] Visualizer     │ │
│ │ [View Mission] [View PRD] [Dispatch Next Task]          │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                               │
│ PHASE 35: Knowledge Visualizer  [██░░░░░░░░] 25%  PLANNED   │
│ PHASE 36: NKS GitHub Release    [░░░░░░░░░░] 0%   PLANNED   │
│ PHASE 37: Twenty Wave 1         [░░░░░░░░░░] 0%   PLANNED   │
│ PHASE 38: Twenty Wave 2         [░░░░░░░░░░] 0%   PLANNED   │
│ ── DEPENDS ON Phase 37 ──                                   │
│ ...                                                          │
│                                                               │
│ CRITICAL PATH: 37→38→39→42→49 (12 weeks)                    │
│ RISK REGISTER: 10 risks (0 critical active)                  │
│ LAST COMMIT: abc1234 — "feat: okf compat pass" (10 min ago) │
└──────────────────────────────────────────────────────────────┘
```

### 5.5 Customer Portal — Account Home

```
┌──────────────────────────────────────────────────────────────┐
│ [🏦 NewLeaf] Home  Payments  Documents  Disputes  Messages   │
│  Profile                                        [John D ▼]  │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────┐  ┌─────────────────────┐           │
│  │                     │  │                     │           │
│  │  NEXT PAYMENT       │  │  ACTIVE DISPUTES    │           │
│  │  June 15, 2026      │  │                     │           │
│  │  ─────────────      │  │  2 active           │           │
│  │  $149.00            │  │  3 resolved         │           │
│  │                     │  │                     │           │
│  │  [Pay Now →]       │  │  [View All →]       │           │
│  └─────────────────────┘  └─────────────────────┘           │
│                                                               │
│  ┌─────────────────────┐  ┌─────────────────────┐           │
│  │                     │  │                     │           │
│  │  DOCUMENTS          │  │  RECENT ACTIVITY    │           │
│  │                     │  │                     │           │
│  │  12 documents       │  │  Jun 1 — Payment   │           │
│  │  Latest: Agreement  │  │       $149 ✓        │           │
│  │                     │  │  May 28 — Letter   │           │
│  │  [View All →]       │  │       sent          │           │
│  └─────────────────────┘  └─────────────────────┘           │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐   │
│  │ PLAN DETAILS                                          │   │
│  │ Plan: Premium Credit Repair                           │   │
│  │ Monthly: $149.00  │  Start: Jan 15, 2026             │   │
│  │ Status: Active    │  Next Bill: June 15, 2026        │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### 5.6 V2 Coding Session (/v2/sessions/[id])

```
┌──────────────────────────────────────────────────────────────┐
│ [V2] ← Sessions  feat/billing-dashboard     [PR #123 ↗]    │
├──────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────┐ ┌──────────────────────────┐ │
│ │ FILE TREE                   │ │ CODE EDITOR              │ │
│ │ ─────────                   │ │ ────────────             │ │
│ │ components/                 │ │ import { Card } from     │ │
│ │  ├── BillingDashboard.tsx ● │ │   '@/components/ui';    │ │
│ │  ├── PaymentTable.tsx       │ │ import { useQuery } from │ │
│ │  └── RecoveryBoard.tsx      │ │   '@tanstack/react-query';│ │
│ │ lib/                        │ │                          │ │
│ │  ├── api/nmi.ts             │ │ export function          │ │
│ │  └── utils/format.ts        │ │ BillingDashboard() {    │ │
│ │ pages/                      │ │   const { data } =       │ │
│ │  └── billing.tsx            │ │     useQuery({...});     │ │
│ │                             │ │                          │ │
│ │ [+ New File]                │ │   return (              │ │
│ └─────────────────────────────┘ │     <div className=...> │ │
│                                  │       <Card>            │ │
│ ┌─────────────────────────────┐ │         <PaymentTable />│ │
│ │ TERMINAL                    │ │       </Card>           │ │
│ │ ─────────                   │ │     </div>              │ │
│ │ $ pnpm build                │ │   );                    │ │
│ │ ✓ Compiled in 2.3s          │ │ }                       │ │
│ │ $ pnpm typecheck            │ └──────────────────────────┘ │
│ │ ✓ No errors                 │                              │
│ │ $ _                         │ ┌──────────────────────────┐ │
│ └─────────────────────────────┘ │ SESSION INFO             │ │
│                                  │ Status: ████░░ 80%      │ │
│                                  │ Tools: 42 calls         │ │
│                                  │ Tokens: 150K            │ │
│                                  │ Duration: 4m 32s        │ │
│                                  │ Cost: $0.15             │ │
│                                  │                          │ │
│                                  │ [Create PR] [Deploy]    │ │
│                                  │ [View Knowledge]        │ │
│                                  └──────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

---

## 6. CLICK PATHS — COMMON WORKFLOWS

### 6.1 New Enrollment (Sales Agent)

```
1. /command-center
2. Twenty: Sales Pipeline view loads
3. Click "New Lead" button
4. Person creation form opens
5. Fill personal info → Submit
6. Lead appears in "New Lead" column
7. Drag lead to "Contacted" → triggers Slack notification
8. After consultation → Drag to "Proposal Sent"
9. Customer agrees → Click "Start Enrollment"
10. Enrollment Wizard Step 1/6: Personal Info (pre-filled)
11. Step 2: Credit Authorization — customer signs via DocuSign
12. Step 3: Credit Report auto-ingested → negative items extracted
13. Step 4: Plan Selection — agent selects plan
14. Step 5: Payment Method — NMI vault token created (SACRED)
15. Step 6: Agreement generated → Agent sends for e-sign → Customer signs
16. Step 7: Welcome email sent via Resend + SMS via GHL
17. Lead moves to "Enrolled" column
18. Person status → active
19. Mission completed
```

### 6.2 Decline Recovery (Billing Agent)

```
1. /command-center
2. Twenty: Billing Recovery Board loads
3. "Payment Due Today" column shows 12 customers
4. Agent selects John Doe (3 days past due)
5. AI Customer Summary shows: Last payment May 1, Plan $149/mo
6. Next Best Action: "Send payment reminder via SMS"
7. Agent clicks "Send Payment Link"
8. Quick Action modal: generates NMI payment link
9. Agent selects SMS → sends link via GHL
10. Agent adds internal note: "Sent SMS reminder, will follow up in 24h"
11. Task created: "Follow up John Doe — payment" (due in 24h)
12. If no payment in 24h → task escalates to "Call customer"
13. If payment received → recovery task auto-closes, payment record created
```

### 6.3 Support Ticket Resolution

```
1. Slack: Customer message arrives in #support channel
2. n8n webhook triggers → creates supportTicket in Twenty
3. Support agent sees new ticket in Unified Inbox
4. Agent opens ticket → Customer 360 view loads
5. Agent sees: active subscription, 2 previous tickets, 1 active dispute
6. Agent composes email reply via Resend
7. Agent sets SLA timer → 4 hour response SLA
8. If SLA approaches → Slack alert to #jarvis-admin
9. Customer replies → thread updated in Twenty
10. Agent resolves ticket → status → "resolved"
11. Customer receives CSAT survey via email
12. Ticket closed → analytics updated
```

### 6.4 Dispute Round Generation

```
1. /command-center → Twenty Disputes view
2. Agent selects customer with active credit report
3. AI Customer Summary shows: 12 negative items, 3 bureaus
4. Agent clicks "Generate Dispute Round"
5. System selects negative items eligible for dispute
6. Agent reviews selection, removes 2 items (already disputed)
7. Agent clicks "Generate Letters"
8. System produces 10 dispute letters (1 per item per bureau)
9. Agent reviews letters → FCRA compliance auto-flag: 1 letter needs edit
10. Agent edits flagged letter → re-runs compliance check → PASS
11. Agent clicks "Send All" → letters queued for mail/Certified Mail
12. Dispute Round status → "submitted"
13. Response tracker set: 30-day bureau response window
14. Task created: "Check bureau responses — 30 days"
```

### 6.5 Customer Self-Service Payment

```
1. Customer receives SMS: "Payment due June 15: $149. Pay now: [link]"
2. Customer taps link → portal.newleaf.financial/payments
3. Clerk auth: existing session → auto-login
4. Payments page shows:
   - Next payment: June 15, $149.00
   - Saved card: Visa ****1234
5. Customer taps "Pay Now"
6. Payment form: confirm amount $149.00, card ****1234
7. Customer taps "Confirm Payment"
8. NMI processes payment (PCI scope at NMI)
9. Success screen: "Payment of $149.00 processed ✓"
10. Receipt sent to email
11. Payment record created in Twenty
12. Subscription status updated → active
13. Recovery task auto-closed (if applicable)
```

### 6.6 Coding Agent Handoff (Chat → V2)

```
1. Chat: User types "Build a billing recovery dashboard component"
2. AI analyzes request → identifies as coding task
3. AI: "I'll hand this off to V2 Coding Agent. This will take ~3-5 minutes."
4. HandoffCard appears in chat: "🔀 HANDOFF: Billing Dashboard Build"
5. V2 spawns:
   a. Creates Vercel Sandbox (Firecracker microVM)
   b. Loads NKS context: billing playbook, NMI skill, design system
   c. Generates BillingDashboard.tsx, RecoveryBoard.tsx, PaymentTable.tsx
   d. Runs pnpm build → PASS
   e. Runs pnpm typecheck → PASS
   f. Creates GitHub PR #124
   g. Deploys preview to Vercel
6. HandoffCard updates: status → "completed", PR #124, deploy URL
7. Chat: "V2 completed the billing dashboard. PR #124 is ready for review."
8. User clicks "View Deploy" → preview URL opens
9. User clicks "View PR" → GitHub PR opens
10. User: "Looks good, merge it"
11. AI merges PR → deploy to production
```

---

## 7. API ROUTE CATALOG

### 7.1 Chat API Routes

```
GET    /api/chat/stream                    → SSE chat stream
POST   /api/chat/stream/resume             → Resume interrupted stream
POST   /api/chat/send                      → Send message (non-streaming)
GET    /api/chat/sessions                  → List sessions
GET    /api/chat/sessions/[id]             → Get session messages
DELETE /api/chat/sessions/[id]             → Delete session

POST   /api/v2/spawn                       → Spawn V2 coding agent
POST   /api/chat/v2-webhook                → Receive V2 status updates

POST   /api/chat/twenty-webhook            → Receive Twenty CRM events
GET    /api/chat/twenty/query              → Proxy Twenty GraphQL queries

GET    /api/knowledge/search               → Search NKS files
GET    /api/knowledge/graph                → Get graph data (nodes + edges)
GET    /api/knowledge/file/[path]          → Get NKS file content
POST   /api/knowledge/okf-export           → Export OKF bundle

GET    /api/memory/[conversationId]        → Recall memories
POST   /api/memory/[conversationId]        → Store memory

GET    /api/health                         → Health check
```

### 7.2 V2 API Routes

```
POST   /api/v2/code/generate               → Generate code
POST   /api/v2/code/review                 → Review code
POST   /api/v2/sandbox/create              → Create sandbox
GET    /api/v2/sandbox/[id]/status         → Sandbox status
POST   /api/v2/sandbox/[id]/execute        → Execute command
POST   /api/v2/github/pr                   → Create pull request
POST   /api/v2/vercel/deploy               → Deploy to Vercel

POST   /api/knowledge/sync                 → Sync knowledge from Chat
GET    /api/knowledge/load                 → Load NKS context for coding

GET    /api/v2/sessions                    → List sessions
GET    /api/v2/sessions/[id]               → Session detail + artifacts
```

### 7.3 Portal API Routes

```
GET    /api/portal/profile                 → Get customer profile
PATCH  /api/portal/profile                 → Update profile
GET    /api/portal/payments                → Get payment history
POST   /api/portal/payments/pay            → Process payment
GET    /api/portal/documents               → List documents
GET    /api/portal/documents/[id]/download → Download document
GET    /api/portal/disputes                → List disputes
GET    /api/portal/disputes/[id]           → Dispute detail
GET    /api/portal/messages                → Message history
POST   /api/portal/messages/send           → Send message
```

---

## 8. CROSS-APP NAVIGATION

### 8.1 App Switching

```
CHAT ──(Cmd+K "v2")──→ /v2 (new tab)
CHAT ──(mission card)→ /admin/roadmap
CHAT ──(handoff card)→ /v2/sessions/[id] (new tab)

V2 ──(knowledge link)──→ /knowledge (Chat app)
V2 ──(deploy link)─────→ Vercel deploy URL (new tab)

PORTAL ──(dispute detail)──→ /disputes/[id]
PORTAL ──(payment success)──→ /payments (with receipt)
```

### 8.2 Deep Linking

```
chat.newleaf.financial/chat/abc123#message-456
→ Opens chat session abc123, scrolls to message 456

v2.newleaf.financial/sessions/def789#file-components/Billing.tsx
→ Opens V2 session def789, selects Billing.tsx in editor

portal.newleaf.financial/disputes/round-001#letter-003
→ Opens dispute round, scrolls to letter 003

chat.newleaf.financial/knowledge?node=skills/billing-flow/SKILL.md
→ Opens knowledge graph, centers on billing-flow node
```

---

## END OF NAVIGATION FLOWS

**Version:** 1.0.0
**Routes:** 30+ Chat, 10+ V2, 10+ Portal, 50+ API
**Wireframes:** 6 major screens (Chat, Knowledge, Command Center, Roadmap, Portal Home, V2 Session)
**Click Paths:** 6 common workflows documented
**Cross-App:** Deep linking + app switching supported

*"Every route has a purpose. Every click has a destination. Navigation is the skeleton of UX."*

— Navigation Flows v1.0, June 17, 2026
