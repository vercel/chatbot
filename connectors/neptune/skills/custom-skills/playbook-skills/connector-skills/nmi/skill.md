# NMI Connector Skill

> **Connector:** nmi | **Priority:** P0 | **Type:** Payment Gateway
> **Dependencies:** NMI Customer Vault API, MCP Bridge (nmi_mcp_bridge)

## Purpose
Process payments, manage customer vaults, and handle recurring billing via the NMI (Network Merchants Inc.) payment gateway. This connector is the PRIMARY payment pathway for NewLeaf Financial.

## When to Use
- Charging a customer (CIT or MIT)
- Creating/updating/deleting customer vault entries
- Querying transaction history
- Managing subscriptions
- Validating cards before charge
- Processing refunds and voids
- Decline recovery and retry

## Required Env Vars
- `NMI_API_KEY` — NMI gateway API key
- `NMI_SECURITY_KEY` — NMI security key for signing
- Uses `nmi_mcp_bridge` (Base44 MCP bridge) for execution

## Common Patterns
1. **Vault Doctrine**: Always use `customer_vault_id`, NEVER `source_transaction_id`
2. **CIT Consent Anchor**: Day 0 CIT transaction required before any MIT charges
3. **Card Validation**: `card_auth=1` + `dup_seconds=0` on all validate calls
4. **CVV Rules**: Required for CIT, NOT for MIT
5. **Rapid-Click Cooldown**: Client-side cooldown prevents duplicate submissions
6. **Smart Retry**: 15-minute scheduled retry for soft declines (insufficient_funds, velocity limits)

## Cross-References
- Playbook: `billing/playbook-billing.md`
- Patterns: `billing/patterns.md`
- Custom Knowledge: `billing/custom-knowledge.md`
- PRD: NMI Golden Vault Architecture (docs/PRD_NMI_GOLDEN_VAULT.md)
- Smart Retry Engine (lib/billing/smart-retry.ts)

## Anti-Patterns
See `anti-patterns.md` for complete BANNED operations list.
