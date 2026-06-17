---
type: "concept"
name: "MIGRATION SMOKE RESULTS 2026 06 17"
description: "Auto-generated description for MIGRATION SMOKE RESULTS 2026 06 17"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# Migration Smoke Test Results — 2026-06-17

**Phase:** 32, Stream 1 | **Status:** PARTIAL — Infrastructure findings documented  
**Verified by:** Jarvis (Phase 32 execution)

## 1. Five Selected Customers

| # | Name | Base44 ID | Type | Key Profile Data |
|---|------|-----------|------|------------------|
| 1 | Lisa Heiss | 6a0f6e14783a6755b1d10f4c | enrolled_active + NMI sub | nmiSubscriptionId: 12091609086, $100/mo, vaultHealth: golden, card ****7641 |
| 2 | Alicia Williams | 6993494f4f138f8cded54034 | 11 PaymentLogs + enrolled_active | 11 payment logs, $198/mo, legacy import, MoneyPanda, lastDeclineCode: 202 |
| 3 | Marvin Coomer | 69e649b640aa40df5c104115 | cancelled/archived | enrollmentStatus: cancelled, archivedBy: jerry, had real subscription |
| 4 | Shane Smith | 6a2c65e58d7c7ec2b929603f | status: New (recent) | Created 2026-06-12, not enrolled, phone: 9047609478 |
| 5 | Christopher Shaw | 6a2c516731480850a63c3319 | status: New (recent) | Created 2026-06-12, not enrolled, phone: 2088099485 |

## 2. Migration Script Analysis

### Fixed: `scripts/migrate-base44-batch.ts`
**Problem:** Used nonexistent endpoint `queryCustomerProfiles`  
**Fix applied:** Rewrote `fetchCustomerProfiles` to query via `jarvisDataEngine` with individual `entity_get` for customer-id mode  
**Status:** Auth mismatch — Node `tsx` context doesn't share MCP bridge authentication

### Root Cause
The MCP bridge (`b44_query`, `b44_get`) works because it routes through the claude-agent-api backend with server-side auth. The Node context (tsx scripts) uses env vars that point to the Base44 functions API but requires different auth tokens.

### Recommended Fix
1. Generate a service-level API key for the VPS that can access `jarvisDataEngine`
2. OR: Use the `vpsAgentToolRouter` internally (port 8400) — only works from VPS itself
3. OR: Add a `NEPTUNE_MIGRATION_TOKEN` env var with proper data engine access

## 3. Twenty CRM GraphQL Verification

### Endpoint: `https://crm.newleaf.financial/graphql`
**Status:** Requires authentication — returns `UNAUTHENTICATED` with API key
**Twenty Auth:** Uses session-based auth (cookie/workspace token), not API key header

### Required for migration
- A valid Twenty workspace API token with `person:create` and `person:update` scopes
- The `TWENTY_API_KEY` / `TWENTYFIRST_API_KEY` env vars are for the Twenty REST API, not GraphQL

## 4. Field Mapping (Verified)

The `mapCustomerToTwentyPerson` function correctly maps:
```
externalId ← Base44 ID
firstName ← firstName  
lastName ← lastName
email ← email
phone ← phone
city ← city
state ← state
notes ← notes + Base44 metadata footer
jobTitle ← company || employerName
```

## 5. Database Stats (for context)
- Total Base44 customers: 2,000
- Enrolled active: 167
- Enrolled paused: 18
- Cancelled: 3
- MRR: $33,750
- Customers with PaymentLogs: 72
- Dispute rounds: 0 (no disputes in system)

## 6. Next Steps for Full Migration
1. Provision Twenty GraphQL auth token with workspace access
2. Generate internal API key for VPS→Base44 data engine access
3. Run dry-run batch of 50
4. Run real batch wave by wave
5. Run bidirectional sync verification
6. Run conflict resolution tests

## 7. Acceptance Criteria

| AC | Description | Status |
|----|-------------|--------|
| AC-3 | 5 customers migrated to Twenty | ⚠️ Blocked on auth |
| AC-4 | Bidirectional sync verified | ⚠️ Pending |
| AC-5 | Conflict resolution rules enforced | ⚠️ Pending |
