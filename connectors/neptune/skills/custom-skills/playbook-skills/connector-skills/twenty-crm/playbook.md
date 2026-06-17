---
type: "playbook"
name: "Playbook"
description: "Auto-generated description for Playbook"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# Twenty CRM — Operational Playbook

**Version:** v1.0 | **Phase 27** | **Last Updated:** 2026-06-17

---

## 1. STANDARD OPERATING PROCEDURE

### 1.1 Querying Customer Data

When an agent asks about a customer (e.g., "Show me Mike's payments"):

1. **Resolve Person** — Query Twenty Person by email or phone:
   ```
   queryPersonByEmail(email: string) → Person | null
   queryPersonByPhone(phone: string) → Person | null
   ```
2. **Get Related Records** — Follow relations to child objects:
   ```
   querySubscriptions(personId) → Subscription[]
   queryPaymentRecords(personId) → PaymentRecord[]
   queryCreditDisputes(personId) → CreditDispute[]
   queryActivities(personId) → Activity[]
   ```
3. **Render in Neptune Chat** — Display as generative cards with inline data

### 1.2 Creating/Updating Records

1. **Verify identity** — Confirm the customer by email/phone before mutating
2. **Idempotency** — Always check `base44Id` before creating (if exists → UPDATE)
3. **Log activity** — After any mutation, create an Activity record
4. **Cross-reference** — If updating subscription state, verify against NMI first

### 1.3 Syncing from Base44

1. **Pull Base44 record** — Get full CustomerProfile + relations
2. **Map fields** — Use data-model.md field mapping
3. **Upsert to Twenty** — Check `base44Id`, create or update
4. **Log sync** — Record sync timestamp and any errors

---

## 2. ALWAYS-CHECK RULES

### Before any Person mutation:
- [ ] Person email matches Base44 email
- [ ] Person phone matches Base44 phone
- [ ] `base44Id` field is present and matches

### Before any Subscription mutation:
- [ ] `nmiSubscriptionId` is valid (exists in NMI)
- [ ] `nmiVaultId` matches NMI vault record
- [ ] Amount matches current NMI subscription amount
- [ ] NMI is definitive — do NOT update billing fields from Twenty if NMI disagrees

### Before any PaymentRecord creation:
- [ ] `nmiTransactionId` is unique (hasn't been synced already)
- [ ] Amount matches NMI transaction record
- [ ] `success` field matches NMI response
- [ ] Card data is NEVER included (last4 only)

### Before any CreditDispute mutation:
- [ ] Round number is sequential
- [ ] Bureau list is complete for the current round
- [ ] `creditReportUrl` is valid

### Before any SupportTicket creation:
- [ ] Category is correctly assigned
- [ ] Priority is appropriate for the issue
- [ ] If Slack-linked, `slackThreadTs` is recorded

---

## 3. ANTI-PATTERNS (FORBIDDEN)

### ❌ NEVER store card data in Twenty
**Violation:** Setting `cardNumber`, `cardCvv`, `cardExpiry`, `routingNumber`, `bankAccountNumber` on any Twenty record.  
**Consequence:** NMI vault sacred boundary violated (memory 6a1f118b). Immediate security incident.  
**Correct:** Only `last4` and `paymentMethod` go to Twenty. Full card data stays in NMI vault only.

### ❌ NEVER override NMI subscription state from Twenty
**Violation:** Changing `billingStatus` on a Subscription record to match what an agent thinks, rather than what NMI reports.  
**Consequence:** Double source-of-truth conflict. Billing errors.  
**Correct:** NMI is always the billing truth. Twenty mirrors NMI. If discrepancy, fix in NMI first, then sync.

### ❌ NEVER duplicate customer records
**Violation:** Creating a new Person without checking for existing Person by email or `base44Id`.  
**Consequence:** Fragmented customer view. Confusion for agents.  
**Correct:** Always query by email + `base44Id` first. Update existing record.

### ❌ NEVER bypass authentication
**Violation:** Calling Twenty API without Bearer token or with expired token.  
**Consequence:** Security breach. Unauthorized data access.  
**Correct:** All API calls authenticated. Rotate tokens before expiry. Use OAuth 2.0 for apps.

### ❌ NEVER sync without idempotency check
**Violation:** Creating records without checking `base44Id` or `nmiTransactionId` first.  
**Consequence:** Duplicate data. Confusion.  
**Correct:** Always use external_id pattern. UPSERT not INSERT.

### ❌ NEVER mix operational and CRM data
**Violation:** Treating Twenty as replacement for Base44 operational queries.  
**Consequence:** Stale data. Missing operational fields.  
**Correct:** Base44 is operational truth. Twenty is CRM/UI layer. Sync flows Base44 → Twenty.

---

## 4. ERROR HANDLING

### 4.1 API Errors

| Error | Response |
|---|---|
| 401 Unauthorized | Rotate API key via Twenty Settings. Do NOT retry. |
| 429 Rate Limited | Wait 60 seconds. Retry with backoff (max 3 attempts). |
| 404 Not Found | Record doesn't exist. If CREATE was intended, proceed. If UPDATE, report to agent. |
| 5xx Server Error | Exponential backoff (1s, 5s, 15s). Max 3 retries. Alert #jarvis-admin on 3rd failure. |

### 4.2 Sync Errors

| Error | Response |
|---|---|
| Base44 record missing | Skip, log to sync errors |
| Field transform fails | Log field + value, use null, continue |
| NMI verification fails | Flag subscription for review, continue sync |
| Duplicate `base44Id` | Merge in Twenty (keep newest), log |

### 4.3 Data Integrity Checks

Run weekly:
- Count Base44 active customers vs Twenty Person records
- Verify all Twenty `nmiSubscriptionId` values exist in NMI
- Check for orphaned PaymentRecords (no parent Subscription)
- Verify all CreditDisputes have valid `personId`

---

## 5. METRICS & MONITORING

### Health Indicators
- Sync latency: Base44 → Twenty (target < 5 min for active records)
- Record count parity: Base44 count vs Twenty count per object
- API error rate: < 1% of requests
- Auth token rotation: > 24h before expiry

### Alert Thresholds
- Sync > 30 min stale → #jarvis-admin warning
- Record count drift > 5% → #jarvis-admin warning
- API error rate > 5% → #jarvis-admin critical
- Any card data detected in Twenty → #jarvis-admin P0 immediate

---

**Playbook created:** 2026-06-17 | **Phase 27**
