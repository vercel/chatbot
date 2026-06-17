---
name: base44-connector
description: Entity queries, customer 360, reporting hub, and function invocation
version: 1.0.0
domain: customer-enrollment
mcp: false
custom_client: true
type: "skill"
---
# Base44 CRM Integration Pack

## File Capabilities & Paths
- **Custom API Client:** `connectors/base44/client.ts`
- **Manifest:** `connectors/base44/manifest.ts`
- **Schema:** `connectors/base44/schema.ts`

## Available Actions
| Tool | Description |
|------|-------------|
| queryEntity | Query any Base44 entity with MongoDB-style filter |
| createEntity | Create a new Base44 entity record |
| customer360 | Full customer dossier across all systems |
| updateEntity | Patch an existing entity record |
| reportingHub | Operational reporting aggregator |
| invokeFunction | Call Base44 backend functions directly |
