---
name: ghl-connector
description: CRM — contacts, SMS, email, conversations, and pipeline
version: 1.0.0
domain: customer-comms
mcp: false
custom_client: true
---
# GHL CRM Integration Pack

## File Capabilities & Paths
- **Custom API Client:** `connectors/ghl/index.ts`
- **Manifest:** `connectors/ghl/manifest.ts`
- **Schema:** `connectors/ghl/schema.ts`

## Available Actions
| Tool | Description |
|------|-------------|
| searchContacts | Search GHL contacts by query |
| sendSMS | Send an SMS message to a contact |
| sendEmail | Send an email to a contact |
| getConversations | List conversations for a contact |
| getPipeline | Get pipeline stage and opportunities |
| createOpportunity | Create a new pipeline opportunity |
