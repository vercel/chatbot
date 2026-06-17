---
name: slack-connector
description: Channel messaging, history search, and notifications
version: 1.0.0
domain: comms
mcp: false
custom_client: true
type: "skill"
access: internal
---
# Slack Integration Pack

## File Capabilities & Paths
- **Custom API Client:** `connectors/slack/index.ts`
- **Manifest:** `connectors/slack/manifest.ts`
- **Schema:** `connectors/slack/schema.ts`

## Available Actions
| Tool | Description |
|------|-------------|
| pullMessages | Pull recent messages from a Slack channel |
| postMessage | Post a message to a Slack channel |
| postThread | Reply in a thread |
| getChannelHistory | Fetch channel message history |
| getUserInfo | Get Slack user profile info |
| react | Add emoji reaction to a message |
