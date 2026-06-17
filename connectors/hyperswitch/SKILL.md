---
name: hyperswitch-connector
description: Self-hosted payment orchestration — NMI connector, payment links, webhooks
version: 1.0.0
domain: billing-flow
mcp: false
custom_client: true
type: "skill"
access: internal
---
# Hyperswitch Integration Pack

## File Capabilities & Paths
- **Custom API Client:** `connectors/hyperswitch/index.ts`
- **Manifest:** `connectors/hyperswitch/manifest.ts`
- **Schema:** `connectors/hyperswitch/schema.ts`

## Available Actions
| Tool | Description |
|------|-------------|
| createPaymentLink | Generate a payment link for a customer |
| queryPayments | Search payment records by filters |
| processRefund | Issue a refund through Hyperswitch |
| webhookHandler | Ingest Hyperswitch webhook events |
