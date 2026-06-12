---
name: forth-connector
description: Debt Protection Program — dispute management and credit repair
version: 1.0.0
domain: credit-disputes
mcp: false
custom_client: true
---
# Forth Credit Integration Pack

## File Capabilities & Paths
- **Custom API Client:** `connectors/forth/index.ts`
- **Manifest:** `connectors/forth/manifest.ts`
- **Schema:** `connectors/forth/schema.ts`

## Available Actions
| Tool | Description |
|------|-------------|
| getDisputes | Query dispute records by filters |
| createDispute | Initiate a new credit dispute |
| updateDispute | Update dispute status and evidence |
| getCreditReport | Pull consumer credit report data |
| getEnrollments | List active DPP enrollments |
| submitEvidence | Submit evidence for a dispute round |
