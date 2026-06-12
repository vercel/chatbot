# NMI Golden Vault Flow — U2.3.C

## Overview

Golden Vault is NewLeaf's premium card storage and charging system. It uses NMI's customer vault with DPAN (network token) storage and a Day 0 CIT transaction as the consent anchor.

## Architecture

```
                    ┌─────────────────────┐
                    │   Client (Browser)   │
                    │  Collect.js / Form   │
                    └────────┬────────────┘
                             │ payment_token
                             ▼
┌──────────────────────────────────────────────────────┐
│                  Neptune Chat (Vercel)                │
│  connectors/nmi/client.ts → VPS Bridge → NMI Gateway │
└──────────────────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────┐
│                    VPS (Hostinger)                    │
│       NMI_SECURITY_KEY (never leaves VPS)            │
│       /tool/nmi/* endpoints                          │
└──────────────────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────┐
│               NMI Payment Gateway                    │
│       customer_vault → DPAN storage                  │
│       transactions → auth/capture/sale               │
└──────────────────────────────────────────────────────┘
```

## Full Golden Vault Lifecycle

### Step 1: Validate Card (`gv_validate_card`)

Before creating a vault, validate the card is eligible:

```typescript
execute({ action: "gv_validate_card", args: {
  card_number: "4111111111111111",
  exp_date: "1226"
}})
```

**NMI API:** `validate` with `card_auth=1` + `dup_seconds=0`

### Step 2: Create Vault (`gv_create_vault`)

Create the customer vault with DPAN token:

```typescript
execute({ action: "gv_create_vault", args: {
  customerId: "cust_123",
  cardDetails: {
    payment_token: "token_from_collect_js",
    billing_address: { ... }
  }
}})
```

**NMI API:** `add_customer` → returns `customer_vault_id`

### Step 3: Day Zero CIT Auth (`day_zero_auth`)

The consent anchor — MUST happen before any MIT charges:

```typescript
execute({ action: "day_zero_auth", args: {
  vaultId: "vault_456",
  amount: 1.00  // $1 auth to establish consent
}})
```

**NMI API:** `sale` with `customer_vault_id` + `card_auth=1` + `dup_seconds=0`

**Critical:** This step establishes the consent anchor. Without it, all future MIT charges will fail.

### Step 4: MIT Recurring Charge (`gv_mit_charge`)

Merchant-initiated recurring billing:

```typescript
execute({ action: "gv_mit_charge", args: {
  vaultId: "vault_456",
  amount: 99.00,
  subscriptionId: "sub_789"
}})
```

**NMI API:** `sale` with `customer_vault_id`, NO CVV, MIT flags set

### Step 5: CIT Charge (when customer present) (`gv_cit_charge`)

Customer-initiated transaction (customer actively paying):

```typescript
execute({ action: "gv_cit_charge", args: {
  vaultId: "vault_456",
  amount: 50.00,
  card_auth: 1
}})
```

**NMI API:** `sale` with `customer_vault_id` + `card_auth=1` (CIT, not MIT)

### Step 6: Inspect Vault Health (`gv_inspect`)

Regular health checks on the vault:

```typescript
execute({ action: "gv_inspect", args: { vaultId: "vault_456" } })
```

Returns: token expiry, consent anchor status, subscription links, CoF health.

### Step 7: Full Test (`gv_full_test`)

End-to-end vault test:

```typescript
execute({ action: "gv_full_test", args: { vaultId: "vault_456" } })
```

Runs: validation + auth simulation + MIT simulation + subscription verification

## Golden Vault vs Standard Vault

| Feature | Standard Vault | Golden Vault |
|---------|---------------|--------------|
| DPAN Token | Basic | Enhanced with auto-reprovision |
| Consent Anchor | Required | Enforced + validated |
| CoF Health | Manual check | Automated daily scan |
| MIT Flag Management | Manual | Auto-corrected |
| Subscription Linking | Basic | Atomic relink on recovery |
| Audit Trail | Basic | Full chain of custody |

## Key NMI API Parameters

| Parameter | MIT | CIT | Validate | Notes |
|-----------|-----|-----|----------|-------|
| `customer_vault_id` | Required | Required | N/A | Vault reference |
| `card_auth` | Must be 0 | Must be 1 | Must be 1 | CIT vs MIT flag |
| `dup_seconds` | 0 | 0 | 0 | Prevent duplicates |
| `cvv` | **BANNED** | Optional | Required for validate | Never on MIT |
| `source_transaction_id` | **BANNED** | **BANNED** | **BANNED** | Never use |
| `stored_credential_indicator` | `stored` | `stored` | N/A | CoF indicator |

## Production Guardrails

1. **Never skip Day 0 consent** — MIT charges will fail systemically
2. **DPAN expiry monitoring** — Tokens expire; re-provision before they do
3. **CoF daily scan** — Catch missing anchors before billing cycles
4. **No CVV on MIT** — Card networks prohibit this; causes audit failures
5. **dup_seconds=0 always** — Prevents accidental double-charges
6. **Smart Retry compatibility** — Recovered cards must re-establish consent

## Recovery Wizard Flow

When a card fails (e.g., insufficient funds, expired token):

1. `cof_deep_inspect` → identify failure reason
2. Send customer to `nmiRecoveryCheckout` with `card_auth=1` + `dup_seconds=0`
3. `cof_provision_token` → get fresh DPAN
4. `cof_link_day_zero` → re-anchor consent
5. `cof_recover` → attempt recovery charge
6. `cof_relink_sub` → reconnect subscription to recovered card
