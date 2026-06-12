---
name: nmi-connector
description: Card vault, recurring billing, and transaction queries via Hyperswitch
version: 1.0.0
domain: billing-flow
mcp: false
custom_client: true
---
# NMI Payments Integration Pack

## File Capabilities & Paths
- **Custom API Client:** `connectors/nmi/index.ts`
- **Manifest:** `connectors/nmi/manifest.ts`
- **Schema:** `connectors/nmi/schema.ts`

## Available Actions
| Tool | Description |
|------|-------------|
| queryTransactions | Query NMI transactions by date range and status |
| getVault | Retrieve customer vault details by vault ID |
| getSubscription | Get subscription status and details |
| chargeCustomer | Process a CIT charge against a vault |
| refundTransaction | Issue a refund for a prior transaction |
