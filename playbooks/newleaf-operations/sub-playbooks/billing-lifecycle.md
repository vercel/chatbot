---
type: playbook
name: "Billing Lifecycle"
description: "Complete billing lifecycle — charge, decline, recovery, refund, vault management"
version: "1.0.0"
updated: "2026-06-17"
domain: billing-flow
priority: P0
scope: domain
scope_connectors: [nmi-connector, hyperswitch-connector, base44-connector, slack-connector]
triggers: [charge, decline, refund, payment, billing, invoice, retry, recovery, vault]
workflows: [recovery-campaign, lifecycle-automation, billing-sweep]
model_routing:
  default: "deepseek/deepseek-v4-pro"
  reasoning_heavy: "anthropic/claude-sonnet-4-6"
access: internal
---

# Billing Lifecycle

## Twenty CRM Objects
- **payment_logs:** Every payment attempt (success, decline, refund)
- **nmi_transactions:** Raw NMI gateway transactions
- **subscriptions:** Recurring payment schedules
- **billing_queue:** Failed payments queued for retry

## Charge Flow
1. **Initiation:** Customer submits payment or recurring charge triggers
2. **NMI Charge:** Via customer_vault_id (sacred ref: 6a1f118b)
3. **Success:** Log to payment_logs, update subscription status
4. **Soft Decline:** Queue for Smart Retry (insufficient_funds, velocity, config errors)
5. **Hard Decline:** Notify via Slack, send SMS to customer
6. **Recovery:** 15-min retry cycle for soft declines

## Refund Flow
1. **Request:** Customer or agent initiates
2. **Eligibility:** Check via calculate-refund-eligibility function
3. **Process:** NMI refund transaction via vault
4. **Log:** payment_logs updated with refund record
5. **Notify:** Slack #jarvis-admin for manual review if >$500

## NMI Vault Management
- **Sacred Reference:** `6a1f118b` — never modify
- **Card Storage:** customer_vault_id + DPAN (network token)
- **Day 0 CIT:** Consent anchor transaction
- **COF Compliance:** Audit via cof-health-audit skill
