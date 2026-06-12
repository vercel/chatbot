# NMI Payments API Reference — U2.3.C Comprehensive

## Overview

The NMI connector provides 41 actions across 10 categories. All actions proxy through the VPS tools bridge (`VPS_TOOLS_BRIDGE_URL`) — NMI security keys never leave the VPS.

## Categories

| Category | Count | Description |
|----------|-------|-------------|
| READ | 6 | Health check, transaction/vault/subscription queries |
| VAULT | 4 | Customer vault management (CRUD, primary card) |
| SUBSCRIPTIONS | 5 | Subscription lifecycle management |
| CHARGES | 4 | Payment processing (one-time, CIT, MIT, recovery) |
| REFUNDS | 1 | Refund settled transactions |
| CoF | 8 | Card-on-File health and recovery operations |
| GOLDEN VAULT | 6 | Golden Vault premium card storage and testing |
| INVOICING | 3 | Invoice creation and lifecycle |
| PRODUCTS | 3 | Product catalog management |
| TXT2PAY | 1 | SMS payment link delivery |

## READ Actions

| Action | Description | Args |
|--------|-------------|------|
| `health_check` | Verify NMI gateway connectivity | (none) |
| `query_transactions` | Query transactions by date range | `startDate`, `endDate`, `condition?`, `limit?` |
| `get_transaction` | Get single transaction by ID | `transactionId` |
| `query_vault` | Get customer vault by ID | `vaultId` or `customerId` |
| `query_subscription` | Get subscription details | `subscriptionId` |
| `query_subscriptions_bulk` | List subscriptions with filters | `result_limit?`, `status?` |

## VAULT Actions

| Action | Description | Args |
|--------|-------------|------|
| `create_vault_from_token` | Create vault from DPAN token | `customerId`, `paymentToken` |
| `update_vault` | Update vault record (billing, expiry) | `vaultId`, `updates` |
| `delete_card_from_vault` | Remove card from customer vault | `vaultId`, `cardIndex?` |
| `set_primary_card` | Set default card for customer | `vaultId`, `cardId` |

## SUBSCRIPTION Actions

| Action | Description | Args |
|--------|-------------|------|
| `create_subscription` | Create recurring billing subscription | `vaultId`, `planId`, `amount` |
| `update_subscription` | Modify subscription details | `subscriptionId`, `updates` |
| `delete_subscription` | Cancel and remove subscription | `subscriptionId` |
| `pause_subscription` | Temporarily pause billing | `subscriptionId`, `reason?` |
| `reactivate_subscription` | Resume paused subscription | `subscriptionId` |

## CHARGE Actions

| Action | Description | Args |
|--------|-------------|------|
| `one_time_charge` | Single payment (no vault) | `amount`, `card_number`, `exp_date`, `cvv` |
| `cit_vault_sale` | CIT sale against stored vault | `vaultId`, `amount`, `card_auth=1` |
| `day_zero_auth` | Day 0 consent anchor auth | `vaultId`, `amount` |
| `recover_charge` | Retry a failed payment | `transactionId`, `vaultId` |

## CoF (Card-on-File) Actions

| Action | Description | Args |
|--------|-------------|------|
| `cof_health_scan` | Scan all stored cards for health | `customerId?` |
| `cof_get_results` | Get last CoF scan results | `scanId` |
| `cof_deep_inspect` | Deep inspect a specific card | `vaultId` |
| `cof_recover` | Execute recovery on flagged card | `vaultId`, `strategy` |
| `cof_relink_sub` | Relink subscription to recovered card | `subscriptionId`, `newVaultId` |
| `cof_fix_mit_flags` | Fix merchant-initiated transaction flags | `vaultId` |
| `cof_link_day_zero` | Link Day 0 auth to vault for CoF | `vaultId`, `transactionId` |
| `cof_provision_token` | Provision DPAN network token | `vaultId` |

## GOLDEN VAULT Actions

| Action | Description | Args |
|--------|-------------|------|
| `gv_validate_card` | Validate card eligibility for Golden Vault | `card_number`, `exp_date` |
| `gv_create_vault` | Create premium vault with enhanced storage | `customerId`, `cardDetails` |
| `gv_mit_charge` | MIT charge through Golden Vault | `vaultId`, `amount` |
| `gv_cit_charge` | CIT charge through Golden Vault | `vaultId`, `amount`, `card_auth=1` |
| `gv_inspect` | Inspect Golden Vault status | `vaultId` |
| `gv_full_test` | Run full Golden Vault test suite | `vaultId` |

## INVOICING Actions

| Action | Description | Args |
|--------|-------------|------|
| `create_invoice` | Create a new invoice | `customerId`, `items`, `dueDate` |
| `send_invoice` | Send invoice to customer | `invoiceId`, `method` (email/sms) |
| `close_invoice` | Mark invoice as paid/closed | `invoiceId`, `paymentRef?` |

## PRODUCT Actions

| Action | Description | Args |
|--------|-------------|------|
| `create_product` | Create product/plan in catalog | `name`, `price`, `interval?` |
| `update_product` | Update product details | `productId`, `updates` |
| `delete_product` | Remove product from catalog | `productId` |

## TXT2PAY Action

| Action | Description | Args |
|--------|-------------|------|
| `send_txt2pay` | Send SMS payment link | `customerId`, `amount`, `phone?` |

## Architecture Notes

- **No public MCP** exists for NMI — all actions are custom
- All keys stay on VPS (`NMI_SECURITY_KEY` in VPS env)
- Bridge auth uses `Authorization: Bearer {BASE44_API_KEY}`
- Response format: `{ success: boolean, data?: any, error?: string, action?: string }`

## Safety Rules (from cardinal 6a1f118b)

1. NEVER use `source_transaction_id` for billing
2. Always include `card_auth=1` in validate calls
3. Always set `dup_seconds=0` for CIT transactions
4. Day 0 CIT is the consent anchor — never skip
5. MIT charges require prior CIT consent
6. CVV is BANNED on MIT transactions
