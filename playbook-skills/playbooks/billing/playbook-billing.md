---
name: Billing Operations Playbook
description: Complete billing operations — charge processing, NMI vault management, recovery workflows, and COF health audits.
domain: billing
connectors: [nmi, hyperswitch, base44]
version: "1.0"
updated: 2026-06-22
---

# Billing Operations Playbook

## Purpose
Manage payment processing, subscription billing, recovery workflows, and card-on-file health across NMI and Hyperswitch.

## Safeguards
- NEVER use source_transaction_id (banned per NMI Golden Vault Architecture)
- Always validate CVV with card_auth=1 + dup_seconds=0 for CIT transactions
- MIT transactions must NOT include CVV or IP address
- Day 0 CIT transaction is the consent anchor for recurring billing
- Smart Retry Engine: 15-minute scheduled retry for soft declines only
- Hard declines (do_not_honor, fraudulent, lost_card) MUST NOT retry

## Routines

### Routine: Process Recovery Payment
1. Load customer profile from Base44 (customerId or email)
2. Query NMI customer vault for DPAN token
3. Validate card expiry and COF indicator
4. Execute CIT transaction with card_auth=1
5. Update payment_log in Base44
6. Post result to #jarvis-admin via Slack

### Routine: COF Health Audit
1. Query all active subscriptions from NMI
2. Cross-reference with Base44 payment_logs
3. Flag cards with expired COF or missing DPAN
4. Generate audit report
5. Queue recovery actions for flagged accounts

### Routine: Billing Drift Detection
1. Pull all Base44 enrollments (active status)
2. Pull all NMI subscriptions (active status)
3. Compare: Base44 enrolled but NMI missing → DRIFT
4. Compare: NMI active but Base44 cancelled → DRIFT
5. Call `billingAlignment` tool for structured comparison
6. Report drift with customer IDs and amounts

### Routine: Smart Retry Health Check
1. Query recovery_items with status=pending_retry
2. Check last retry timestamp — skip if < 15 minutes ago
3. Execute retry with exponential backoff
4. Log result: success → mark recovered, hard_decline → mark failed
5. Notify #jarvis-admin of batch results

## Workflows
- **recovery-batch**: Bulk recovery processing for soft declines
- **cof-audit**: Card-on-file health audit across all vaults
- **billing-recon**: Full billing reconciliation Base44 ↔ NMI

## Anti-Patterns
- Do NOT retry hard declines
- Do NOT store raw CVV after CIT transaction
- Do NOT use source_transaction_id for MIT transactions
- Do NOT process payments without proper COF indicator check
