# Twenty CRM — NewLeaf Integration Guide

## How Twenty Fits the NewLeaf Stack
Twenty is the **central CRM and data store** for NewLeaf Financial. It replaces Base44's internal data management while integrating with existing services (NMI, Hyperswitch, GHL, Slack, n8n).

## Integration Architecture Diagram
```
┌─────────────────────────────────────────────────────┐
│                  TWENTY CRM (VPS)                    │
│              crm.newleaf.financial :3002              │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Payment  │  │Subscript │  │ CreditDispute    │  │
│  │ Record   │  │  ion     │  │ Enrollment       │  │
│  └────┬─────┘  └────┬─────┘  │ RecoveryTask     │  │
│       │             │         └────────┬─────────┘  │
│       │    ┌────────┴────┐            │             │
│       └────┤   Person    ├────────────┘             │
│            └─────────────┘                          │
└──────┬──────────┬──────────┬──────────┬─────────────┘
       │          │          │          │
  ┌────▼───┐ ┌───▼────┐ ┌──▼───┐ ┌───▼──────┐
  │  NMI   │ │Hyper   │ │ GHL  │ │  Slack   │
  │ Vault  │ │switch  │ │      │ │#jarvis-  │
  │(cards) │ │(route) │ │(CRM) │ │ admin    │
  └────────┘ └────────┘ └──────┘ └──────────┘
       │          │          │          │
       └──────────┴──────────┴──────────┘
                      │
                ┌─────▼──────┐
                │    n8n     │
                │ (workflow) │
                └────────────┘
```

## Integration Cardinal Rules
1. **NMI vault is source of truth for cards** — Twenty stores vault IDs, not card numbers
2. **Hyperswitch routes payments, NMI vaults cards** — Twenty owns the lifecycle
3. **Slack #jarvis-admin ONLY** for system alerts — never #newleaf-admin
4. **All webhooks must verify HMAC signatures** — no blind trust
5. **API keys scoped to roles** — billing_system has write to PaymentRecord only

## Service Integrations

### NMI (Payment Gateway)
**Direction:** NMI → Twenty
**Method:** Webhook → Logic Function HTTP Route
**Data flow:**
1. Hyperswitch routes charge through NMI
2. NMI sends webhook to Twenty (`/s/nmi-webhook`)
3. Logic function creates `paymentRecord` with transaction data
4. Logic function updates `subscription.billingHealth`
5. Workflow fires on `paymentRecord.created` → advances enrollment pipeline

### Hyperswitch (Payment Orchestrator)
**Direction:** Hyperswitch → Twenty
**Method:** Webhook → Logic Function HTTP Route (`/s/hyperswitch/payment-webhook`)
**Data flow:**
1. Hyperswitch processes payment via NMI connector
2. Sends webhook with transaction result
3. Twenty creates paymentRecord (HMAC SHA512 verified)
4. Twenty updates subscription billing health

### GHL (GoHighLevel)
**Direction:** GHL ↔ Twenty (bidirectional)
**Method:** Logic Function HTTP Route + Workflow HTTP Request
**Data flow:**
- **GHL → Twenty:** Contact created/updated → Logic Function upserts Person
- **Twenty → GHL:** person.created → Workflow HTTP Request → GHL API
- SMS logs: GHL webhook → Twenty creates activity/note

### Slack (Notifications)
**Direction:** Twenty → Slack (#jarvis-admin)
**Method:** Workflow HTTP Request or Logic Function
**Events:**
- `paymentRecord.created` (failed) → "Payment failed for {person.firstName}"
- `subscription.updated` (billingHealth=declining) → "Billing alert"
- `enrollment.stageEntered` → "Pipeline update: {person.firstName} → {stage}"
- `creditDispute.status = resolved` → "Dispute resolved: {bureau} {round}"
- Daily SLA summary (9am cron) → "SLA report: {count} overdue"

### n8n (Workflow Automation)
**Direction:** Twenty ↔ n8n (bidirectional)
**Method:** Webhooks + REST API
**Use cases:**
- Affy letter print: `creditDispute.status = pending` → n8n → generate + print letter
- Welcome email: `enrollment.stage = ACTIVE_SERVICE` → n8n → email sequence
- Document check: `enrollment.stage = DOCUMENTS_COLLECTED` → n8n → verify docs

## Data Mapping: Base44 → Twenty
| Base44 Entity | Twenty Object | Key Field Mapping |
|---------------|---------------|-------------------|
| CustomerProfile | person | email, phone, firstName, lastName |
| Subscription | subscription | nmiVaultId, amount, frequency, status |
| PaymentLog | paymentRecord | nmiTransactionId, amount, success |
| SupportTicket | task | title, status, assignedTo |
| CreditDispute | creditDispute | bureau, roundNumber, status |
| Enrollment | enrollment | stage, signedAt, stageSlaHours |

## Migration Strategy (4 Phases)
1. **Schema Setup:** Deploy `newleaf-foundation` app → 5 custom objects created
2. **Person Import:** Bulk upsert via `onConflictKey: email` → connect to NMI vault IDs
3. **Transaction Import:** NMI export → transform → batch insert paymentRecords
4. **Active Subscriptions:** Current subscriptions with payment schedules

## Daily Operational Tasks

### Sales Agents
- Review new leads: `persons (filter: createdAt > yesterday)`
- Check pipeline: `enrollments (filter: stage != ACTIVE_SERVICE)`
- Follow up: `tasks (filter: dueDate <= today)`
- Payment issues: `paymentRecords (filter: success = false, chargeDate > -7d)`

### Admins
- Stack health: `docker ps --filter name=twenty`
- Recent errors: `docker logs twenty-newleaf-server --since 24h | grep ERROR`
- API key audit: `apiKeys (filter: revokedAt = NULL, expiresAt < +30d)`
- Backup verify: `ls -la /backups/twenty_*.sql | tail -1`
- Role audit: Review workspace members + assigned roles

## Troubleshooting Integration Issues
| Symptom | Check | Fix |
|---------|-------|-----|
| Payments not showing | Is HS webhook reaching Twenty? | Check Logic Function logs, verify signature |
| Person not syncing from GHL | Is GHL webhook configured? | Test webhook URL with curl |
| Slack alerts missing | Workflow HTTP Request failing? | Check run history, verify bot token |
| n8n not receiving events | Webhook URL changed? | Verify webhook config in Twenty Settings |
| Data mismatch Base44/Twenty | Migration incomplete? | Run count comparison queries |
