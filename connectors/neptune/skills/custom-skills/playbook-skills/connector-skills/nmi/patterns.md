---
type: "playbook"
name: "Patterns"
description: "Auto-generated description for Patterns"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# NMI Patterns — Always-Check Rules

## Pre-Flight Checklist (ALWAYS)
- [ ] Customer has valid `customer_vault_id` (present and active)
- [ ] Day 0 CIT consent anchor exists (required before any MIT charges)
- [ ] CVV provided for CIT transactions (`card_auth=1`)
- [ ] `dup_seconds=0` in validate calls
- [ ] Amount matches agreement/contract in Base44
- [ ] Subscription schedule aligned with billing cycle (no double-charge)
- [ ] Card expiry > 30 days in future
- [ ] High-risk BINs routed to Allied Payments (not NMI)
- [ ] Dunning retry count under limit (max 3)
- [ ] Void only if same calendar day (before settlement cutoff)

## Pattern: Safe Charge Flow
1. Verify `customer_vault_id` exists
2. Check CIT consent anchor (Day 0)
3. Validate card (`dup_seconds=0`, `card_auth=1`)
4. Execute sale/recurring
5. Log result to payment_logs
6. On success: update subscription status
7. On soft decline: queue smart retry
8. On hard decline: send billing link, notify support

## Pattern: Vault Health Check
1. Query vault via `customer_vault_query`
2. Verify DPAN (network token) present
3. Check card expiry (> 30 days buffer)
4. Verify `cofIndicator` set correctly
5. If expired: notify customer to update
6. If missing: create new vault entry

## Pattern: Decline Recovery
1. Capture decline reason from NMI response
2. Classify: soft (retry-able) vs hard (non-retry-able)
3. Soft: queue in smart-retry engine (15-min interval)
4. Hard: send billing_link to customer
5. Log to payment_logs with decline code
6. Track retry count (max 3)
7. After max retries: escalate to support

## Pattern: Subscription Lifecycle
1. Create vault (CIT with `card_auth=1`)
2. Establish Day 0 consent anchor
3. Create subscription (MIT, no CVV)
4. Monitor each billing cycle
5. On failure: follow decline recovery pattern
6. On cancel: deactivate, log reason
