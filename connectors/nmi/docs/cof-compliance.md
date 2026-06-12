# CoF (Card-on-File) Compliance Discipline — U2.3.C

## LOCKED: Cardinal 6a1f118b

The CoF compliance rules are locked by cardinal 6a1f118b and must NOT be modified without explicit approval from the compliance audit domain.

## What is CoF?

Card-on-File (CoF) refers to storing customer card details for future transactions. In the NMI ecosystem, CoF uses the **customer vault** system with DPAN (network token) storage.

## The Consent Model

```
Day 0: Customer provides card → CIT (Cardholder-Initiated Transaction)
  ├── Validate card with card_auth=1 + dup_seconds=0
  ├── Store card in vault (returns vault_id)
  └── This is the CONSENT ANCHOR

Day 1+: Recurring billing → MIT (Merchant-Initiated Transaction)
  ├── MUST have prior CIT consent (Day 0)
  ├── Uses stored vault_id
  ├── NO CVV allowed on MIT
  └── Requires valid DPAN/token
```

## CoF Health Dimensions

The CoF health scan checks these dimensions for every stored card:

| Dimension | Check | Severity if Failed |
|-----------|-------|-------------------|
| Token Validity | DPAN is active and not expired | CRITICAL |
| Consent Anchor | Day 0 CIT exists and is valid | CRITICAL |
| MIT Flags | MIT transaction flags are correctly set | HIGH |
| Subscription Link | Active subscription references valid vault | HIGH |
| CVV Leakage | No CVV stored or passed on MIT calls | CRITICAL |
| Dup Seconds | dup_seconds=0 on all validate calls | HIGH |
| Card Auth | card_auth=1 present on validate | HIGH |

## CoF Recovery Flow

When a card fails CoF health:

```
1. cof_deep_inspect → identify root cause
2. cof_provision_token → re-provision DPAN if expired
3. cof_link_day_zero → re-establish consent anchor if missing
4. cof_fix_mit_flags → correct MIT transaction flags
5. cof_relink_sub → reconnect subscription to fixed vault
6. cof_recover → final recovery attempt
```

## The "Day Zero" Requirement

Every card stored in the vault MUST have a Day 0 CIT transaction as its consent anchor. Without this:

1. MIT charges will fail with code 225 (Invalid CVV) or 300 (Consent Missing)
2. The card is ineligible for recurring billing
3. Recovery requires re-collecting card details from the customer

## BANNED Operations

| Operation | Why Banned |
|-----------|-----------|
| `source_transaction_id` on charges | Bypasses consent model, causes audit failures |
| CVV on MIT transactions | Card networks prohibit CVV storage for MIT |
| Missing `card_auth=1` on validate | Causes NMI code 225 (Invalid CVV) |
| Missing `dup_seconds=0` on validate | Allows duplicate charges without explicit consent |

## Production Incident: NMI CVV 225 (2026-05-05)

**Root cause:** Every recovery wizard billing link was failing with NMI code 225 'Invalid CVV'. Missing `card_auth=1` + `dup_seconds=0` in NMI validate calls, plus no client-side rapid-click cooldown.

**Fix applied to:** `nmiRecoveryCheckout`, `payNowGoldenVault`, `WizardBillingStep`

**Lesson:** CoF compliance is NOT optional — missing flags cause cascading production failures.

## Monitoring

Run `cof_health_scan` daily via cron to detect:
- Expiring DPAN tokens (re-provision before expiry)
- Missing consent anchors
- Incorrect MIT flags
- Subscription-vault mismatch

## References

- NMI Golden Vault Architecture PRD: `jarvis/prd/nmi-golden-vault-architecture.md`
- Smart Retry Engine: `docs/PRD_BASE44_TWO_LANE_WORKFLOW.md`
- NMI CVV 225 Recovery Fix (2026-05-05): Shared Agent Context
