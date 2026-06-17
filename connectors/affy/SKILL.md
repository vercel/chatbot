---
name: affy-connector
description: Chargeback disputes — affidavits, evidence, and defense automation
version: 1.0.0
domain: billing-flow
mcp: false
custom_client: true
type: "skill"
access: internal
---
# Affy Chargebacks Integration Pack

## File Capabilities & Paths
- **Custom API Client:** `connectors/affy/index.ts`
- **Manifest:** `connectors/affy/manifest.ts`
- **Schema:** `connectors/affy/schema.ts`

## Available Actions
| Tool | Description |
|------|-------------|
| getChargebacks | Query chargeback cases by filters |
| submitEvidence | Submit defense evidence for a chargeback |
| createAffidavit | Generate an affidavit for the case |
| getDisputeStatus | Check dispute resolution status |
| trackTimeline | Get chargeback timeline and deadlines |
