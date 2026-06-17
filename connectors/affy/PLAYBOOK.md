---
connector: affy
version: 0.2.0
scope: connector
auto_load: true
trigger_tools:
  - affy:getChargebacks
  - affy:submitEvidence
  - affy:generateAffidavit
  - affy:trackDispute
headline: |
  Affy chargeback dispute management via Base44 bridge. Never auto-approve chargeback
  responses — always human review. Missing a deadline means losing the dispute.
type: "playbook"
access: internal
---

# Affy (Chargeback/Affidavit) Connector Playbook

## Operational Knowledge

### Architecture
Affy tools proxy through the Base44 bridge (`BASE44_API/api/affyBridge`) using a `callAffyBridge(action, payload)` pattern. All chargeback data lives in Base44's dispute management system.

### Auth
- Bridge auth via internal service token (Base44)
- No separate API keys needed in Neptune Chat

### Tools
- `getChargebacks` — List by customer, status, date range
- `submitEvidence` — Submit defense evidence for a dispute
- `generateAffidavit` — Auto-generate affidavit from transaction data
- `trackDispute` — Track dispute through resolution lifecycle

### Dispute Lifecycle
```
open → under_review → won (defense successful) / lost (chargeback granted)
```

## Business Context

### Why Affy
Chargeback management is critical for NewLeaf — every dispute represents revenue at risk. This connector enables agents to:
1. Proactively monitor open chargebacks
2. Auto-generate defense affidavits from transaction evidence
3. Submit evidence packages to fight disputes
4. Track dispute outcomes for trend analysis

### Business Rules
- Affidavits must include: transaction ID, customer consent proof (Day 0 CIT), service description, delivery evidence
- Evidence submission deadlines vary by card network (typically 7-21 days)
- Won disputes return funds; lost disputes incur chargeback fees ($15-25 per dispute)

## Anti-Patterns

### ❌ NEVER:
1. Submit evidence without verifying all required fields are present
2. Generate affidavits for transactions < 60 days old (wait for dispute window)
3. Auto-approve chargeback responses — always human review
4. Include raw card numbers in evidence packages
5. Miss submission deadlines — set reminders at 48h and 24h before deadline

## Safeguards

### Evidence Requirements
- Transaction ID (NMI txn)
- Customer consent (Day 0 CIT with IP address)
- Service/Product description
- Delivery confirmation (if applicable)
- Communication history showing customer engagement

### Error Handling
- Dispute not found → verify chargebackId format
- Evidence too large → split into multiple submissions
- Bridge unreachable → retry with exponential backoff
- Affidavit generation failed → manually assemble evidence

## Common Workflows

### List Open Chargebacks
```
getChargebacks({ status: "open", limit: 20 })
→ returns chargebacks needing attention
```

### Generate Defense Affidavit
```
generateAffidavit({
  transactionId: "txn_abc",
  customerId: "cust_xyz",
  reason: "4870 - Fraudulent"
})
→ returns generated affidavit text with transaction evidence
```

### Submit Evidence
```
submitEvidence({
  chargebackId: "cb_123",
  evidence: "Customer authorized $129.99 on 2026-05-01. IP: 192.168.x.x. Service delivered 2026-05-02..."
})
```

### Track Resolution
```
trackDispute({ disputeId: "cb_123", includeHistory: true })
→ returns status + full resolution timeline
```

## Refinement Notes

- **Version:** 1.0.0
- **Created:** 2026-06-09
- **Last Reviewed:** 2026-06-09
- **Source:** Base44 Affy Bridge, NMI transaction documentation
- **Related:** NMI Connector Playbook (transaction evidence source)
