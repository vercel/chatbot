---
name: vapi-connector
description: Voice AI — call logs, transcripts, and agent analytics
version: 1.0.0
domain: support-triage
mcp: false
custom_client: true
---
# Vapi Voice AI Integration Pack

## File Capabilities & Paths
- **Custom API Client:** `connectors/vapi/index.ts`
- **Manifest:** `connectors/vapi/manifest.ts`
- **Schema:** `connectors/vapi/schema.ts`

## Available Actions
| Tool | Description |
|------|-------------|
| queryCallLogs | Search Vapi call logs by filters |
| getTranscript | Retrieve a call transcript |
| getAnalytics | Get call outcome analytics |
