---
type: "prd"
name: "MASTER TRD V1.0"
description: "Auto-generated description for MASTER TRD V1.0"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# MASTER TECHNICAL REQUIREMENTS DOCUMENT v1.0

## Neptune Platform v1.0 — Full Stack Technical Specification

**Version:** 1.0.0
**Date:** 2026-06-17
**Type:** trd
**Status:** ACTIVE
**Owner:** hermes
**Dependencies:** NEPTUNE-KNOWLEDGE-SPEC v1.0, MASTER-UNIFIED-SPRINT-PLAN v1.0
**Tags:** trd, technical-requirements, stack, data-model, api, auth, security, performance

---

## TABLE OF CONTENTS

1. [Stack Architecture](#1-stack-architecture)
2. [Data Model Contracts](#2-data-model-contracts)
3. [API Contracts](#3-api-contracts)
4. [Authentication & Authorization](#4-authentication--authorization)
5. [Streaming Protocols](#5-streaming-protocols)
6. [Security Architecture](#6-security-architecture)
7. [Performance Budgets](#7-performance-budgets)
8. [Scaling Thresholds](#8-scaling-thresholds)
9. [Infrastructure](#9-infrastructure)
10. [Monitoring & Observability](#10-monitoring--observability)

---

## 1. STACK ARCHITECTURE

### 1.1 Platform Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
├──────────────┬──────────────────┬───────────────────────────┤
│ NEPTUNE CHAT │   NEPTUNE V2    │   CUSTOMER PORTAL          │
│ Next.js 16   │   Next.js 16    │   Next.js 16               │
│ AI SDK 6     │   Sandbox SDK   │   Clerk Auth               │
│ shadcn/ui    │   CodeMirror    │   shadcn/ui                │
│ Tailwind     │   Terminal UI   │   Tailwind                 │
│ Chat: Vercel │   V2: Vercel    │   Portal: Vercel           │
└──────┬───────┴────────┬───────┴──────────┬────────────────┘
       │                │                   │
┌──────▼────────────────▼───────────────────▼────────────────┐
│                    API LAYER                                 │
├─────────────────────────────────────────────────────────────┤
│  AI SDK 6 SSE Streams  │  Workflow SDK (durable)            │
│  tRPC (type-safe)      │  REST endpoints                    │
│  GraphQL (Twenty)      │  Webhooks (inbound)               │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                   SERVICE LAYER                              │
├──────────────┬──────────────┬──────────────┬───────────────┤
│  AGENT       │  CRM         │  WORKFLOW    │  PAYMENTS     │
│  RUNTIME     │  ENGINE      │  ENGINE      │  ENGINE       │
│  ──────────  │  ──────────  │  ──────────  │  ──────────   │
│  AI SDK 6    │  Twenty      │  n8n         │  NMI          │
│  DeepSeek    │  Docker      │  Webhooks    │  Allied       │
│  BYOK GW     │  Postgres    │  Triggers    │  Vault        │
│  Memory      │  GraphQL     │  Code Nodes  │  SACRED       │
└──────┬───────┴──────┬───────┴──────┬───────┴──────┬────────┘
       │               │               │               │
┌──────▼───────────────▼───────────────▼───────────────▼───────┐
│                   DATA LAYER                                  │
├────────────────┬───────────────┬───────────────┬─────────────┤
│  Postgres      │  Redis        │  NKS Files    │  File Store │
│  (neon)        │  (pub/sub)    │  (cortex/)    │  (artifacts)│
│  Chat+V2+      │  Streams      │  Markdown     │  Vercel     │
│  Twenty Data   │  Cache        │  Knowledge    │  Blob       │
└────────────────┴───────────────┴───────────────┴─────────────┘
```

### 1.2 Component Versions (LOCKED)

| Component | Version | Purpose | Upgrade Policy |
|-----------|---------|---------|---------------|
| Next.js | 16.x | App Router, React Server Components | Minor upgrades only |
| React | 19.x | UI framework | Locked (Next.js 16 requires React 19) |
| TypeScript | 5.7+ | Type safety | Latest minor |
| AI SDK (Vercel) | 6.x | Chat streaming, tool calling, agents | Minor upgrades only |
| Workflow SDK (Vercel) | 1.x | Durable workflow execution | Minor upgrades only |
| Vercel AI Gateway | Latest | BYOK (DeepSeek default), routing | Automatic |
| Vercel Sandbox | Latest | Firecracker microVMs for code execution | Automatic |
| shadcn/ui | Latest | Component library | Minor upgrades |
| Tailwind CSS | 4.x | Utility CSS | Locked to v4 |
| Biome | Latest | Linting + formatting | Automatic |
| Drizzle ORM | Latest | Postgres ORM | Minor upgrades |
| Neon Postgres | Serverless | Database | Automatic |
| Redis | 7.x | Caching, pub/sub, streams | Locked major |
| Twenty CRM | Latest | CRM engine (Docker self-hosted) | Test before upgrade |
| n8n | Latest | Workflow automation (Docker) | Test before upgrade |
| NMI | N/A | Payment gateway (Allied white-label) | NEVER upgrade without human approval |
| Clerk | Latest | Authentication | Automatic |
| Better Auth | Latest | V2 auth | Minor upgrades |
| NextAuth v5 | 5.x | Chat auth | Locked major |

### 1.3 External Services

| Service | Provider | Type | Criticality |
|---------|----------|------|-------------|
| NMI Allied Payments | networkmerchants.com | Payment Gateway | P0 — SACRED |
| Slack | slack.com | Ops Messaging | P0 — All agent comms |
| Resend | resend.com | Email API | P1 |
| GHL | ghl.com | CRM Bridge + SMS | P1 (during migration) |
| VAPI | vapi.ai | Voice AI | P1 |
| Freshcaller | freshcaller.com | Telephony | P2 |
| Linear | linear.app | Sprint Tracking | P2 |
| Hyperswitch | hyperswitch.io | Payment Orchestration | P3 (optional Phase 39+) |
| DeepSeek | deepseek.com | LLM Provider (default) | P0 — BYOK via Vercel Gateway |
| GitHub | github.com | Code hosting, PRs | P0 |
| Vercel | vercel.com | Deployments | P0 |

---

## 2. DATA MODEL CONTRACTS

### 2.1 Twenty CRM — Person (Extended)

The Twenty `person` object is extended with Neptune-specific fields. **NMI vault fields are SACRED.**

```typescript
// NEPTUNE-TWENTY PERSON SCHEMA
interface NeptunePerson {
  // Twenty Core Fields (standard)
  id: string;
  name: { firstName: string; lastName: string };
  email: string;
  phone: string;
  city: string;
  avatarUrl: string;
  createdAt: DateTime;
  updatedAt: DateTime;

  // Neptune Extensions
  base44Id: string;                    // Link to Base44 (migration bridge)
  enrollmentStatus: 'lead' | 'in_progress' | 'active' | 'cancelled';
  enrollmentDate: DateTime | null;
  leadSource: 'haley_ai' | 'slack' | 'referral' | 'ads' | 'organic';
  slaLapseReason: string | null;

  // NMI SACRED FIELDS (memory 6a1f118b)
  // NEVER modify programmatically without explicit human approval
  nmiVaultId: string | null;           // SACRED
  nmiCustomerId: string | null;         // SACRED
  nmiDefaultPaymentMethod: string | null; // SACRED

  // Billing
  subscriptionId: string | null;
  subscriptionStatus: 'active' | 'past_due' | 'cancelled' | 'trial';
  monthlyCharge: number;
  nextBillingDate: DateTime | null;

  // Disputes
  activeDisputeRounds: number;
  totalNegativeItems: number;
  lastCreditReportDate: DateTime | null;

  // Communications
  preferredContactMethod: 'email' | 'sms' | 'call';
  lastContactDate: DateTime | null;
  totalTickets: number;

  // Relations
  leads: Lead[];
  agreements: Agreement[];
  paymentMethods: PaymentMethod[];
  paymentRecords: PaymentRecord[];
  recoveryTasks: BillingRecoveryTask[];
  disputeLetters: DisputeLetter[];
  negativeItems: NegativeItem[];
  creditReports: CreditReport[];
  supportTickets: SupportTicket[];
  emailMessages: EmailMessage[];
  smsMessages: SmsMessage[];
  callLogs: CallLog[];
  agentTasks: AgentTask[];
  documents: Document[];
  changeLogs: ChangeLog[];
}
```

### 2.2 Twenty Custom Objects (22 Total)

| # | Object Name | Table | Phase | Fields | Relations |
|---|------------|-------|-------|--------|-----------|
| 1 | lead | lead | 37 | 12 | Person |
| 2 | vapiCall | vapi_call | 37 | 15 | Person, Agent |
| 3 | agreement | agreement | 38 | 10 | Person |
| 4 | paymentMethod | payment_method | 38 | 8 | Person (SACRED link to NMI) |
| 5 | paymentRecord | payment_record | 39 | 14 | Person, paymentMethod |
| 6 | billingRecoveryTask | billing_recovery_task | 39 | 12 | Person, paymentRecord |
| 7 | disputeLetter | dispute_letter | 40 | 16 | Person, disputeRound |
| 8 | negativeItem | negative_item | 40 | 14 | Person, creditReport |
| 9 | creditReport | credit_report | 40 | 10 | Person |
| 10 | supportTicket | support_ticket | 41 | 18 | Person, Agent (refined) |
| 11 | emailMessage | email_message | 41 | 10 | Person |
| 12 | smsMessage | sms_message | 41 | 8 | Person |
| 13 | callLog | call_log | 41 | 12 | Person, vapiCall |
| 14 | agentTask | agent_task | 41 | 10 | Person, Agent |
| 15 | document | document | 42 | 8 | Person |
| 16 | changeLog | change_log | 41 | 8 | Person (for customer 360) |
| 17 | subscription | subscription | 39 | 10 | Person (refined existing) |
| 18 | creditDispute | credit_dispute | 40 | 12 | Person (refined existing) |
| 19 | enrollment | enrollment | 38 | 16 | Person (refined existing) |
| 20 | activity | activity | 38 | 8 | Person (refined existing) |
| 21 | disputeRound | dispute_round | 40 | 12 | Person, disputeLetter |
| 22 | recoveryCampaign | recovery_campaign | 39 | 10 | billingRecoveryTask |

### 2.3 Base44 → Twenty Field Mapping

| Base44 Entity | Twenty Object | Key Fields Mapping | Migration Strategy |
|---------------|---------------|--------------------|--------------------|
| CustomerProfile | Person | profile → name+email+phone, status → enrollmentStatus | Direct map + enrichment |
| PaymentLog | paymentRecord | amount, status, date → direct | Direct map |
| Subscription | subscription | plan, status, dates → direct | Direct map |
| SupportTicket | supportTicket | status, priority, messages → direct | Direct map + history |
| CallLog (VAPI) | vapiCall | transcript, duration, outcome → direct | Direct map |
| AgentCall (Freshcaller) | callLog | duration, disposition → direct | Direct map |
| Agreement | agreement | type, signed, date → direct | Direct map |
| CreditReport | creditReport | bureau, date, score → direct | Direct map |
| NegativeItem | negativeItem | bureau, account, reason → direct | Direct map |
| DisputeLetter | disputeLetter | bureau, round, status → direct | Direct map |
| Client360 | Person + relations | Linked objects | Split into relations |
| AdminNotification | changeLog (filtered) | type, severity, message → map | Selective sync |
| SlackMessage | emailMessage/smsMessage (log) | text, ts, channel → log | Audit trail only |
| SmsMessage | smsMessage | to, from, body → direct | Direct map |
| EmailMessage | emailMessage | to, from, subject, body → direct | Direct map |
| Lead (GHL) | lead | name, source, status, value → direct | Direct map |
| RecoveryItem | billingRecoveryTask | amount, status, attempts → direct | Direct map |
| DisputeRound | disputeRound | bureau, stages, status → direct | Direct map |
| Task (jarvisTask) | agentTask | title, status, assignee → direct | Direct map |
| Activity | activity | type, description → direct | Direct map |

### 2.4 Migration Conflict Resolution (4-Tier)

When Base44 and Twenty have conflicting data for the same record:

| Tier | Name | Rule | Example |
|------|------|------|---------|
| 1 | **Twenty Wins** | If Twenty was manually updated after Base44 last sync | Agent updated phone in Twenty → keep Twenty value |
| 2 | **Base44 Wins** | If Base44 has more recent update AND Twenty untouched | New payment came in via NMI → Base44 value wins |
| 3 | **Merge** | Both updated, non-overlapping fields | Base44 has new email, Twenty has new phone → merge both |
| 4 | **Flag for Review** | Both updated, same field, different values | Both changed customer name → human review required |

---

## 3. API CONTRACTS

### 3.1 Chat → V2 (Spawn Coding Agent)

```
POST /api/v2/spawn
Authorization: Bearer <chat-service-token>

{
  "prompt": "Build a billing dashboard component",
  "context": {
    "playbook": "billing",
    "knowledgeRefs": ["skills/billing-flow/SKILL.md", "playbooks/billing/playbook.md"],
    "sessionId": "chat-session-xyz"
  },
  "options": {
    "model": "deepseek-v3",
    "sandbox": "auto",
    "maxTools": 50
  }
}

Response 202:
{
  "sessionId": "v2-session-abc123",
  "status": "spawned",
  "streamUrl": "/api/v2/stream/v2-session-abc123",
  "estimatedCompletion": "2-5 minutes"
}
```

### 3.2 V2 → Chat (Session Status Webhook)

```
POST /api/chat/v2-webhook
X-HMAC-Signature: <hmac-sha256>

{
  "sessionId": "v2-session-abc123",
  "chatSessionId": "chat-session-xyz",
  "status": "completed" | "failed" | "in_progress",
  "result": {
    "commits": ["abc1234"],
    "prUrl": "https://github.com/abhiswami2121/newleaf-financial/pull/123",
    "deployUrl": "https://neptune-chat.vercel.app",
    "artifacts": ["components/BillingDashboard.tsx"],
    "toolCallsUsed": 42,
    "totalTokens": 150000,
    "cost": 0.15
  },
  "error": null,
  "completedAt": "2026-06-17T12:00:00Z"
}
```

### 3.3 Twenty ↔ Chat (GraphQL + Webhooks)

```
# Chat queries Twenty for customer data
query GetCustomer($id: ID!) {
  person(id: $id) {
    id name { firstName lastName } email phone
    enrollmentStatus nmiVaultId
    subscription { status monthlyCharge nextBillingDate }
    paymentRecords(limit: 10) { amount status date }
    supportTickets(limit: 5) { status priority title }
  }
}

# Twenty webhooks → Chat when data changes
POST /api/chat/twenty-webhook
X-Twenty-Signature: <signature>

{
  "event": "person.updated",
  "recordId": "person-123",
  "changes": {
    "enrollmentStatus": { "old": "lead", "new": "active" }
  }
}
```

### 3.4 Twenty ↔ Base44 (Bidirectional Sync)

```
# Sync direction: Base44 → Twenty
POST /api/twenty/sync/inbound
{
  "source": "base44",
  "entity": "CustomerProfile",
  "action": "updated",
  "record": { /* full record */ }
}

# Sync direction: Twenty → Base44
POST /api/base44/sync/inbound
{
  "source": "twenty",
  "entity": "person",
  "action": "updated",
  "record": { /* full record */ }
}
```

### 3.5 n8n Trigger Events

| Trigger | Webhook URL | Payload |
|---------|-------------|---------|
| Slack submission | `/webhook/slack-submission` | Slack message JSON |
| Payment declined (NMI) | `/webhook/payment-declined` | NMI transaction |
| Customer enrolled | `/webhook/customer-enrolled` | Person ID |
| Credit report ingested | `/webhook/credit-report` | Credit report data |
| Support ticket created | `/webhook/ticket-created` | Ticket data |
| Agent task completed | `/webhook/task-completed` | Task ID + resolution |

---

## 4. AUTHENTICATION & AUTHORIZATION

### 4.1 Auth Methods Per Application

| App | Auth Provider | Method | Session |
|-----|--------------|--------|---------|
| **Neptune Chat** | NextAuth v5 | Credentials + Google OAuth | JWT (HTTP-only cookie) |
| **Neptune V2** | Better Auth | Vercel OAuth + GitHub App | Token + refresh |
| **Twenty CRM** | Twenty Internal | Email/password + Clerk JWT bridge | Session cookie |
| **Customer Portal** | Clerk | Email/password + Social SSO | JWT (HTTP-only cookie) |
| **API Routes** | Service tokens | HMAC-signed bearer tokens | Stateless |

### 4.2 Auth Flow: Chat Login

```
1. User navigates to /sign-in
2. Enters credentials OR clicks "Sign in with Google"
3. NextAuth v5 validates credentials / OAuth callback
4. JWT session created (HTTP-only cookie)
5. Redirect to /command-center (or previous page)

JWT Payload:
{
  "sub": "user-123",
  "email": "agent@newleaf.financial",
  "role": "agent",
  "domains": ["billing", "support"],
  "iat": 1718611200,
  "exp": 1718697600
}
```

### 4.3 Auth Flow: V2 Coding Agent

```
1. V2 app loads at /v2
2. Better Auth checks Vercel OAuth token
3. If no token → redirect to Vercel OAuth (GitHub scope)
4. On callback → Better Auth creates session
5. GitHub App token stored for PR/deploy operations
6. All V2 API calls include Authorization: Bearer <v2-token>
```

### 4.4 Auth Flow: Customer Portal

```
1. Customer navigates to portal.newleaf.financial
2. Clerk checks for existing session
3. If no session → Clerk sign-in modal
4. On success → Clerk JWT issued
5. Portal passes Clerk JWT to Twenty via JWT bridge
6. Twenty validates JWT → returns customer-scoped data (GraphQL row-level security)
```

### 4.5 Auth Flow: Cross-App (Clerk ↔ Twenty Bridge)

```
# Clerk JWT → Twenty session bridge
POST /api/auth/twenty-bridge
Authorization: Bearer <clerk-jwt>

{
  "userId": "clerk-user-123",
  "email": "customer@example.com",
  "personId": "twenty-person-456"
}

Response:
{
  "twentyToken": "twenty-session-token",
  "scopes": ["read:own_person", "read:own_payments", "read:own_documents"]
}
```

### 4.6 Authorization Matrix

| Role | Chat Access | V2 Access | Twenty Access | Portal Access |
|------|-------------|-----------|---------------|---------------|
| **Admin** | Full | Full | Full (all records) | — |
| **Manager** | Full | Read | Full (domain records) | — |
| **Agent** | Domain-only | Read | Domain-only | — |
| **Viewer** | Read-only | Read-only | Read-only | — |
| **Customer** | — | — | Own records only | Own records only |
| **Partner Admin** | — | Read | Partner workspace | — |
| **Partner Agent** | — | — | Partner workspace | — |

---

## 5. STREAMING PROTOCOLS

### 5.1 AI SDK 6 SSE Streams

```
GET /api/chat/stream
Accept: text/event-stream

→ SSE Events:
event: text
data: {"delta": "Let", "timestamp": 1718611200000}

event: text  
data: {"delta": " me", "timestamp": 1718611200050}

event: tool_call
data: {"tool": "b44_query", "args": {"entity": "CustomerProfile"}, "id": "call_1"}

event: tool_result
data: {"id": "call_1", "result": {"count": 169}}

event: done
data: {"totalTokens": 1500, "cost": 0.0015}
```

### 5.2 Resumable Streams (Redis)

```
# When stream disconnects:
POST /api/chat/stream/resume
{ "streamId": "stream-abc123", "lastEventId": 42 }

→ Continues SSE stream from event 43

# Redis stores:
stream:abc123 = [
  { eventId: 1, type: "text", delta: "Hello" },
  { eventId: 2, type: "text", delta: " world" },
  ...
]
```

### 5.3 Workflow SDK (Durable)

```typescript
// Vercel Workflow SDK — survives deploys, restarts
const enrollmentWorkflow = createWorkflow({
  id: "enrollment-123",
  retries: 3,
  timeout: "30m",
})
  .step("validate-customer", async ({ customerId }) => {
    // Step 1: Check customer data
  })
  .step("run-credit-check", async ({ customerId }) => {
    // Step 2: Run credit check
  })
  .step("generate-agreement", async ({ customerId }) => {
    // Step 3: Generate agreement PDF
  })
  .step("send-welcome-email", async ({ customerId }) => {
    // Step 4: Send welcome email
  });
```

### 5.4 WebSocket (Real-time Dashboard)

```
// Twenty CRM real-time updates
wss://neptune-chat.vercel.app/ws/twenty

→ Messages:
{"type": "person.updated", "data": {...}}
{"type": "payment.processed", "data": {...}}
{"type": "ticket.created", "data": {...}}
{"type": "sync.completed", "data": { "records": 50 }}
```

---

## 6. SECURITY ARCHITECTURE

### 6.1 NMI Vault — SACRED (Memory 6a1f118b)

```
CARDINAL RULE:
━━━━━━━━━━━━━
NMI vault configuration is SACRED.

DO NOT:
- Modify vault IDs programmatically
- Override payment processing logic
- Expose security keys in any log, commit, or API response
- Change payment routing without explicit human approval

DO:
- Reference NMI vault IDs from secure env vars only
- Pass vault operations through nmiMcpBridge exclusively
- PCI scope lives at NMI (not our infrastructure)
- Audit all NMI access monthly
```

### 6.2 Secret Management

| Secret | Storage | Rotation | Access |
|--------|---------|----------|--------|
| NMI Security Key | Vercel Encrypted Env + VPS .env | Quarterly | hermes agent (read), human admin (write) |
| Slack Bot Token | Vercel Encrypted Env | 6 months | slackMcpBridge |
| GitHub Token | Vercel Encrypted Env | 90 days | githubProxy |
| Vercel Token | Vercel Encrypted Env | 90 days | vercelProxy |
| Neon DB URL | Vercel Encrypted Env | Annually | Drizzle ORM |
| DeepSeek API Key | Vercel AI Gateway | Managed by Vercel | AI SDK 6 |
| Clerk Secret Key | Vercel Encrypted Env | Managed by Clerk | Clerk SDK |
| Resend API Key | Vercel Encrypted Env | Managed by Resend | Resend SDK |
| GHL API Key | Vercel Encrypted Env | Managed by GHL | GHL SDK |
| n8n Webhook Secret | Vercel Encrypted Env | Quarterly | n8n |
| Freshcaller API Key | Vercel Encrypted Env | 6 months | Freshcaller API |

### 6.3 Webhook Security

```
All webhooks verified via HMAC-SHA256:

// Inbound webhook verification
const signature = req.headers['x-hmac-signature'];
const computed = crypto
  .createHmac('sha256', process.env.WEBHOOK_SECRET)
  .update(JSON.stringify(req.body))
  .digest('hex');

if (signature !== computed) {
  return Response.json({ error: 'Invalid signature' }, { status: 401 });
}
```

### 6.4 Data Encryption

| Data State | Method |
|------------|--------|
| **In Transit** | TLS 1.3 (HTTPS everywhere) |
| **At Rest — DB** | Neon Postgres encryption-at-rest |
| **At Rest — Files** | Encrypted env vars in Vercel |
| **At Rest — Backups** | Encrypted Postgres dumps |
| **In Memory** | Redis encrypted, short TTL on sensitive data |

### 6.5 SOC 2 Controls (Phase 47)

| Control | Implementation |
|---------|---------------|
| Access Control | RBAC matrix (Section 4.6) |
| Audit Logging | Comprehensive changeLog object in Twenty |
| Change Management | Git-tracked, PR-reviewed, CI-verified |
| Risk Assessment | Risk register updated per phase |
| Monitoring | System health dashboard + Slack alerts |
| Vendor Management | External service audit per connector |
| Data Classification | Customer PII, NMI sacred, internal ops |
| Incident Response | Incident response playbook in playbooks/vps-ops/ |

---

## 7. PERFORMANCE BUDGETS

### 7.1 Response Time Targets

| Operation | Target | P99 Max | Measurement |
|-----------|--------|---------|-------------|
| Chat first token | <3s | <5s | AI SDK stream start |
| Chat full response | <30s | <60s | Stream complete |
| V2 first token | <3s | <5s | Sandbox + stream start |
| V2 code generation | <5min | <10min | PR created |
| Twenty GraphQL query | <200ms | <500ms | Server response |
| Twenty mutation | <500ms | <1s | Server response |
| Base44 sync (50 records) | <10s | <30s | End-to-end sync |
| Knowledge graph query | <500ms | <1s | Graphify/Graphiti |
| /knowledge page load | <3s | <5s | LCP (Lighthouse) |
| /admin/roadmap page load | <2s | <4s | LCP |
| Portal page load | <3s | <5s | LCP |
| Portal interaction | <100ms | <200ms | FID |
| Sandbox provision | <30s | <60s | Vercel Sandbox start |

### 7.2 Resource Budgets

| Resource | Limit | Alert At |
|----------|-------|----------|
| Chat API route duration | 60s | 45s |
| V2 sandbox duration | 10min | 8min |
| Tokens per chat message | 8,000 | 6,000 |
| Tokens per V2 session | 200,000 | 150,000 |
| Postgres connections | 20 | 15 |
| Redis memory | 256MB | 200MB |
| Vercel function memory | 1GB | 800MB |
| VPS CPU | 80% | 70% |
| VPS RAM | 4GB total | 3.5GB |
| VPS Disk | 50GB | 40GB |

### 7.3 Bundle Size Budgets

| App | JS Bundle | CSS Bundle | Total (gzipped) |
|-----|-----------|------------|-----------------|
| Chat | <200KB | <50KB | <250KB |
| V2 | <300KB | <30KB | <330KB |
| Portal | <150KB | <40KB | <190KB |
| Knowledge Visualizer | <100KB | <20KB | <120KB |
| Roadmap Dashboard | <80KB | <15KB | <95KB |

---

## 8. SCALING THRESHOLDS

### 8.1 User Scaling

| Phase | Concurrent Users | Daily Active Users | Customers |
|-------|-----------------|--------------------|-----------|
| Current | 5-10 | 20-50 | 2,000+ (169 enrolled) |
| Post-Phase 42 (Portal) | 50 | 200 | 2,000+ (all enrolled) |
| Post-Phase 48 (Multi-tenant) | 200 | 1,000 | 10,000+ (multi-tenant) |
| Post-Phase 50 (v1.0) | 500 | 5,000 | 50,000+ (target) |

### 8.2 Data Scaling

| Entity | Current Records | Growth Rate | 12-Month Estimate |
|--------|----------------|-------------|-------------------|
| Persons | 2,000+ | +50/week | 4,600 |
| Payment Records | 5,000+ | +100/week | 10,200 |
| Support Tickets | 1,000+ | +30/week | 2,560 |
| Leads | 1,779 | +20/week | 2,819 |
| Knowledge Files | 200+ | +10/week | 720 |
| Slack Messages | 50,000+ | +500/week | 76,000 |
| Call Logs | 500+ | +50/week | 3,100 |

### 8.3 Scaling Actions

| Trigger | Action |
|---------|--------|
| Postgres > 15 connections | Connection pool increase OR read replicas |
| Redis > 200MB | Eviction policy review OR instance upgrade |
| Vercel function timeouts > 5% | Function splitting OR timeout increase |
| VPS CPU > 80% sustained | VPS upgrade OR service offloading |
| VPS RAM > 3.5GB sustained | VPS upgrade (8GB plan) |
| Twenty response > 500ms P99 | Index review, query optimization, cache |
| Knowledge graph > 1,000 nodes | Graph partitioning, lazy loading |
| Concurrent users > 100 | Vercel Pro → Enterprise |

---

## 9. INFRASTRUCTURE

### 9.1 VPS Configuration (187.127.250.171)

```
OS: Ubuntu 24.04 LTS
CPU: 4 vCPUs
RAM: 8GB
Disk: 80GB SSD
Swap: 4GB

Running Services:
- Twenty CRM (Docker, port 3001)
- n8n (Docker, port 5678)
- Claude Agent API (port 8102)
- Postgres (local, firewalled) — migrating to Neon

Network:
- Cloudflare DNS
- UFW firewall (ports: 22, 80, 443, 3001, 5678, 8102)
- All outbound HTTPS
```

### 9.2 Vercel Deployments

```
Projects:
1. neptune-chat              → chat.newleaf.financial
2. neptune-v2                → v2.newleaf.financial
3. neptune-portal            → portal.newleaf.financial
4. neptune-knowledge-spec    → docs.neptune-knowledge-spec.vercel.app

Environment Variables (per project):
- VERCEL_TOKEN (deploy)
- DATABASE_URL (Neon)
- REDIS_URL
- NMI_SECURITY_KEY (SACRED)
- SLACK_BOT_TOKEN
- GITHUB_TOKEN
- DEEPSEEK_API_KEY (via Vercel AI Gateway)
- CLERK_SECRET_KEY
- RESEND_API_KEY
- GHL_API_KEY
- N8N_WEBHOOK_URL
```

### 9.3 Database Architecture

```
┌────────────────────────────────────┐
│         Neon Postgres              │
│  ┌──────────┐  ┌────────────────┐  │
│  │ Chat DB  │  │    V2 DB       │  │
│  │ - users  │  │ - sessions     │  │
│  │ - chats  │  │ - repos        │  │
│  │ - memory │  │ - sandboxes    │  │
│  └──────────┘  │ - workflows    │  │
│                 └────────────────┘  │
├────────────────────────────────────┤
│         Twenty Postgres            │
│  ┌──────────────────────────────┐  │
│  │       Twenty CRM DB          │  │
│  │  - core (person, company)    │  │
│  │  - custom (22 objects)       │  │
│  │  - metadata (views, fields)  │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

### 9.4 Backup Strategy

| Data | Frequency | Retention | Location |
|------|-----------|-----------|----------|
| Neon Postgres | Daily | 30 days | Neon automated |
| Twenty Postgres | Daily | 7 days | VPS disk + S3 |
| Knowledge Files (cortex/) | Every commit | Infinite (git) | GitHub |
| Vercel Env Vars | On change | Manual | Vercel dashboard |
| n8n Workflows | Weekly | 30 days | VPS disk |

---

## 10. MONITORING & OBSERVABILITY

### 10.1 Health Checks

| Service | Check | Frequency | Alert |
|---------|-------|-----------|-------|
| Chat | GET /api/health | 1min | Slack #jarvis-admin |
| V2 | GET /api/health | 1min | Slack #jarvis-admin |
| Twenty | GET /api/rest/health | 1min | Slack #jarvis-admin |
| n8n | GET /healthz | 1min | Slack #jarvis-admin |
| NMI | GET /api/status (NMI endpoint) | 5min | Slack #jarvis-admin |
| Neon DB | Connection check | 1min | Slack #jarvis-admin |
| Redis | PING | 1min | Slack #jarvis-admin |
| VPS | System resources | 5min | Slack #jarvis-admin |

### 10.2 Key Metrics Dashboard

```
System Health (Phase 44):
┌─────────────────────────────────────────┐
│ Uptime: 99.9%  │  Latency: 245ms avg   │
│ Errors: 0.1%   │  Throughput: 42 req/s │
│ CPU: 45%       │  RAM: 2.8GB / 8GB     │
│ DB Conns: 8    │  Redis: 120MB / 256MB  │
└─────────────────────────────────────────┘
```

### 10.3 Alerting Rules

| Alert | Trigger | Channel | Severity |
|-------|---------|---------|----------|
| Service Down | Health check fails 3x | #jarvis-admin | CRITICAL |
| High Error Rate | >5% 5xx in 5min | #jarvis-admin | HIGH |
| Payment Failure | NMI error > 0 in 1hr | #jarvis-admin | CRITICAL |
| Sync Lag | Twenty↔Base44 > 5min | #jarvis-admin | HIGH |
| DB Connection Full | >80% connections | #jarvis-admin | HIGH |
| VPS Resource | CPU > 90% 5min | #jarvis-admin | MEDIUM |
| Knowledge Inconsistency | okf-verify fails | #jarvis-admin | MEDIUM |
| Build Failure | Vercel build fails | #jarvis-admin | MEDIUM |
| Secret Expiry | Token < 7 days to expiry | #jarvis-admin | LOW |
| Budget Overage | Phase spends > 120% budget | #jarvis-admin | LOW |

### 10.4 Logging Standards

```typescript
// Structured logging format
{
  "level": "info" | "warn" | "error",
  "service": "chat" | "v2" | "twenty" | "n8n" | "portal",
  "phase": 34,
  "action": "okf_export",
  "result": "success" | "failure",
  "duration_ms": 1234,
  "toolCalls": 5,
  "tokens": 8000,
  "userId": "user-123",
  "sessionId": "session-xyz",
  "timestamp": "2026-06-17T12:00:00Z",
  "message": "OKF export completed: 200 files processed"
}
```

---

## END OF TRD

**Version:** 1.0.0
**Stack:** Next.js 16 + AI SDK 6 + Workflow SDK + Vercel AI Gateway + Neon Postgres + Twenty Docker + n8n + NMI Sacred
**Data Models:** 22 Twenty custom objects + 20 Base44 entity mappings + 4-tier conflict resolution
**API Contracts:** 6 internal APIs + webhook protocols
**Auth:** NextAuth v5 + Better Auth + Clerk + Twenty bridge
**Performance:** Chat <3s TTFT, Twenty <500ms, Portal <3s LCP
**Security:** NMI SACRED, HMAC, encrypted env, SOC 2 prep

*"The stack is chosen. The contracts are defined. The sacred is protected. Build forward."*

— Master TRD v1.0, June 17, 2026
