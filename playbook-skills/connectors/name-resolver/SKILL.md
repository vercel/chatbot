# Name Resolver — Customer Name → Base44 ID → NMI Vault/Sub

**Domain:** billing-flow (P0) | customer-enrollment (P0) | support-triage (P1)
**Tier:** 1 — Critical connector skill
**Version:** 1.0.0

## What It Does

Resolves a customer name (e.g., "Mary Nazworth") into a full customer dossier:
- Base44 CustomerProfile ID
- Phone, Email
- NMI Customer Vault ID
- NMI Subscription ID
- Billing Status + Payment Amount
- Agent Email, Enrollment Status, Pipeline Stage
- Next Payment Date, Scheduled Cancellation Date

## When to Use

- When a customer is mentioned BY NAME in Slack, SMS, or chat
- Before ANY NMI lookup (NMI requires vault_id or subscription_id)
- During discovery workflows that cross-reference Slack → Base44 → NMI
- When building billing alignment reports
- Anytime you need to turn a human name into system IDs

## Trigger Words (in Neptune Chat)

- "resolve [customer name]"
- "lookup [customer name]"
- "who is [customer name]"
- "find customer [name]"

## Architecture

```
Customer Name → parseName() → Base44 CustomerProfile query → NameResolverResult
                                                                    ↓
                                                          NMI vault/sub IDs
```

## Usage

```typescript
import { nameResolver } from "@/playbook-skills/connectors/name-resolver/client";

// Single resolve
const mary = await nameResolver.resolve("Mary Nazworth");
// → { base44Id: "69d8126a...", firstName: "Mary", lastName: "Nazworth",
//     phone: "229-886-5816", nmiVaultId: "1905637253",
//     nmiSubscriptionId: "12197049407", billingStatus: "confirmed_subscription",
//     paymentAmount: 248, ... }

// Bulk resolve
const results = await nameResolver.resolveMany([
  "Mary Nazworth", "Zachary Taylor", "Larry Shaw"
]);
// → Map<string, NameResolverResult | null>
```

## Self-Healing

- If name parse fails: try reversing order (last, first)
- If Base44 query returns 0 results: try fuzzy match via customer-matcher
- If NMI IDs missing: flag in result, caller should handle gracefully
- If multiple matches: return all candidates, caller picks

## Dependencies

- `@/connectors/base44/client` — Base44 entity queries
- `process.env.BASE44_API_KEY` — Auth token
- `mcp__base44_tools__b44_query` or equivalent — CustomerProfile filter
