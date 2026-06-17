---
type: "concept"
name: "MIGRATION RESEARCH 2026 06 17"
description: "Auto-generated description for MIGRATION RESEARCH 2026 06 17"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# Twenty ↔ Base44 Bidirectional Sync — Migration Research

**Date:** 2026-06-17  
**Phase:** 30 Research  
**Status:** Complete — ready for build

---

## 1. Twenty CRM Capabilities

### 1.1 Webhook System
- **Event Types:** `{object}.created`, `{object}.updated`, `{object}.deleted` — applies to ALL object types (Person, Company, Subscription, SupportTicket, custom objects)
- **No Event Filtering:** Every mutation fires a webhook. Filtering must happen on the receiver side.
- **Payload:** JSON POST with `{event, data (full record), timestamp (ISO 8601)}`
- **Signing:** HMAC-SHA256 via `X-Twenty-Webhook-Signature` header + `X-Twenty-Webhook-Timestamp`. Signature payload = `"{timestamp}:{JSON.stringify(body)}"`
- **Verification:** `crypto.timingSafeEqual` comparison (not `===`)
- **Acknowledgment:** Must return 2xx within timeout. No retry/rate limit docs available.
- **Subscription:** Via Settings → APIs & Webhooks UI. No programmatic GraphQL mutation documented in public docs.

### 1.2 GraphQL API
- **Core API:** `/graphql` — CRUD on People, Companies, Opportunities, custom objects
- **Metadata API:** `/metadata` — Schema management (objects, fields, relations)
- **Auth:** Bearer token (`Authorization: Bearer YOUR_API_KEY`) created in Settings → API & Webhooks
- **Rate Limit:** 100 requests/min, 60 records per batch call
- **Batch Upserts:** GraphQL supports plural mutations like `CreateCompanies` for create-or-update in one call
- **Schema per Tenant:** Each workspace generates its own schema. Endpoint URL and field names match your workspace.

### 1.3 Relevant Twenty Objects (for migration)
- **Person:** Maps to Base44 CustomerProfile (firstName, lastName, email, phone, city, state, notes)
- **Company:** Maps to employer/company context
- **Subscription:** Custom object for billing subscription data (amount, frequency, status, nextPaymentDate)
- **PaymentRecord:** Custom object for payment history
- **CreditDispute:** Custom object for dispute tracking
- **SupportTicket:** Maps to Base44 SupportTicket for tri-integration
- **Activity:** Timeline entries for notes, calls, emails

---

## 2. Base44 CustomerProfile Schema (Key Fields)

### 2.1 NMI Sacred Fields (Base44 Wins Always)
| Field | Type | Description |
|-------|------|-------------|
| nmiSubscriptionId | string | NMI subscription reference |
| nmiVaultId | string | NMI customer vault ID |
| nmiBillingId | string | Primary billing reference |
| nmiBillingIds | array | All billing IDs |
| nmiDayZeroTransactionId | string | Day 0 CIT consent anchor |
| nmiDayZeroDate | string | Day 0 date |
| nmiDayZeroIpAddress | string | Day 0 IP for CIT |
| nmiLastVerifiedAt | datetime | Last card verification |
| nmiLastVerifiedBillingId | string | Last verified billing |
| nmiCardVerified | boolean | Card verification status |
| nmiCardSavedWithoutVerification | boolean | Card saved flag |
| networkTokenStatus | string | DPAN/token status |
| networkTokenProvisionedAt | datetime | Token provision date |

### 2.2 Billing Fields (Base44 Wins — but sync to Twenty for visibility)
| Field | Type | Description |
|-------|------|-------------|
| billingStatus | string | e.g., active, paused, cancelled, no_payment_method |
| paymentAmount | number | Monthly payment amount |
| paymentFrequency | string | monthly, biweekly, etc. |
| nextPaymentDate | datetime | Next scheduled payment |
| subscriptionRetryCount | number | Soft decline retry counter |
| consecutiveDeclineCount | number | Consecutive failures |
| lastDeclineCode | string | Last decline reason code |

### 2.3 Core Identity Fields (LWW with Timestamp)
| Field | Type | Description |
|-------|------|-------------|
| email | string | Primary email (unique) |
| firstName | string | First name |
| lastName | string | Last name |
| phone | string | Primary phone |
| canonicalPhone | string | Cleaned phone |
| addressLine1 | string | Street address |
| city | string | City |
| state | string | State |
| zipCode | string | ZIP code |
| dob | string | Date of birth |

### 2.4 Sales/CRM Fields (Twenty Wins)
| Field | Type | Description |
|-------|------|-------------|
| notes | text | Agent notes |
| agentEmail | string | Assigned agent |
| lastNote | text | Latest note |
| conversationSummary | text | AI conversation summary |
| conversationSentiment | string | Sentiment analysis |
| engagementTier | string | Engagement level |
| status | string | Lead status (New, Active, etc.) |
| onboardingStatus | string | Onboarding progress |
| journeyStatus | string | Customer journey stage |

### 2.5 Dispute Fields
| Field | Type | Description |
|-------|------|-------------|
| disputeStatus | string | not_started, active, resolved |
| currentDisputeRound | number | Current round number |
| disputeUrgency | string | normal, high, critical |
| disputeResponseDeadline | datetime | Bureau response deadline |
| lastDisputeActionAt | datetime | Last action timestamp |

---

## 3. Migration Strategy

### 3.1 Idempotency
- **Primary Key:** `external_id` field on Twenty objects = Base44 CustomerProfile `id` (6a2c65e58d7c7ec2b929603f format)
- **Upsert Pattern:** Use Twenty's GraphQL batch upsert mutations (e.g., `CreatePeople` with external_id matching)
- **Re-run Safe:** Checking `external_id` before insert prevents duplicates

### 3.2 Checkpoint Resume
- **Tracking Table:** `library_migration_runs` with status, wave_size, progress counters
- **Per-record Tracking:** `library_migration_records` with run_id, base44_id, twenty_id, status
- **Resume Logic:** Query `library_migration_records` for incomplete records in last incomplete run
- **Wave Processing:** Each wave processes N records, commits progress, allows resume

### 3.3 Rate Limiting
- **Twenty Limit:** 100 req/min → cap at 60 req/min (40% safety margin)
- **Batch Size:** 60 records per GraphQL call
- **Implementation:** 1 second delay between batches, exponential backoff on 429
- **Throughput:** ~3,000 records/hour at safe rate

### 3.4 Bulk vs Incremental
- **Phase 1 (Bulk):** Full migration of all Active customers (~2,000+ profiles)
- **Phase 2 (Incremental):** Webhook-driven sync for ongoing changes
- **Dual-Write Period:** 48 hours where both systems accept writes, webhooks reconcile

---

## 4. Conflict Resolution Rules

### 4.1 Field Ownership Matrix

| Category | Owner | Direction | Locked? |
|----------|-------|-----------|---------|
| NMI fields (vault, subscription, billing IDs) | Base44 | B→T only | YES — NMI is source of truth |
| billingStatus, paymentAmount, paymentFrequency, nextPaymentDate | Base44 | B→T only | YES — NMI billing engine |
| email, firstName, lastName, phone, address | Either | Bidirectional LWW | Timestamp-based resolution |
| notes, agentEmail, conversationSummary | Twenty | T→B preferred | Twenty is CRM of record |
| status, onboardingStatus, journeyStatus | Base44 | B→T only | Workflow engine |
| disputeStatus, currentDisputeRound | Base44 | B→T only | Dispute automation |

### 4.2 LWW Implementation
- Each record stores `_sync_updated_at` (ISO 8601 timestamp)
- On conflict: if incoming.timestamp > existing._sync_updated_at → apply change
- If timestamps equal (within 1s tolerance) → Base44 wins for billing, Twenty wins for CRM

### 4.3 Sacred Field Protection
- Fields marked "Base44 Wins" are **write-protected** in the Twenty→Base44 webhook handler
- Twenty-side updates to these fields are silently dropped with a sync event log entry
- Base44-side updates to these fields always propagate to Twenty

---

## 5. Webhook Sync Architecture

### 5.1 Base44 → Twenty (Outbound)
```
CustomerProfile.update (Base44 trigger)
  → filter: has external_id mapped to Twenty?
  → queue to library_sync_events (direction: b2t)
  → POST /api/twenty-sync (internal endpoint)
  → Twenty GraphQL mutation (upsert Person/Subscription)
  → update library_sync_events (status: completed)
```

### 5.2 Twenty → Base44 (Inbound)
```
Twenty Person.updated (webhook)
  → POST /api/twenty-webhooks (public endpoint)
  → verify X-Twenty-Webhook-Signature
  → extract external_id → Base44 CustomerProfile.id
  → check field-level conflict rules
  → apply non-sacred fields to CustomerProfile
  → log to library_sync_events (direction: t2b)
```

### 5.3 Dead Letter Queue
- **library_failed_syncs:** stores failed sync events with retry_count
- **Slack Alert:** 5+ consecutive failures → notify #jarvis-admin
- **Manual Retry:** Admin UI at /admin/migration with "Retry Failed" button

---

## 6. Data Mapping: Base44 → Twenty

| Base44 Entity | Twenty Object | Key Field Mapping |
|---------------|---------------|-------------------|
| CustomerProfile | Person | email→email, firstName, lastName, phone, address, external_id |
| CustomerProfile.enrollmentStatus | Person.status | "active"→Active, "paused"→Paused, "cancelled"→Cancelled |
| CustomerProfile (billing) | Subscription | paymentAmount, paymentFrequency, nextPaymentDate, billingStatus |
| PaymentLog | PaymentRecord | amount, status, date, transactionId |
| DisputeRound | CreditDispute | disputeStatus, round, bureau, investigationResults |

---

## 7. Open Questions & Risks

1. **Webhook retry behavior:** Twenty docs don't specify retry policy. Assume at-least-once delivery; implement idempotency on receiver.
2. **GraphQL mutation for webhook subscription:** No documented API. Must use Twenty UI to register webhooks. Consider scripting via browser automation if needed.
3. **Twenty custom objects:** Subscription and CreditDispute may need custom object creation first.
4. **Field type mismatches:** Base44 `dob` is string ("1984-08-23"), Twenty may expect Date type.
5. **Phone format:** Base44 is raw digits ("9047609478"), Twenty may expect E.164 format.

---

**Next:** STREAM 2 — Build migration engine (`scripts/migrate-base44-batch.ts`) + bidirectional webhook sync.
