# Slack Connector Skill

> **Connector:** slack | **Priority:** P0 | **Type:** Communication
> **Dependencies:** Slack MCP Bridge (slack_mcp_bridge), Slack Web API

## Purpose
Post messages, read channel history, and manage Slack communications. PRIMARY channel is #jarvis-admin (C0AQDDC3HAB). NEVER post to #newleaf-admin.

## When to Use
- Sending landing reports and status updates
- Posting alerts and notifications
- Reading channel history for context
- Retrieving user info
- Adding reactions to messages
- Thread replies for organized discussions

## Required Env Vars
- `SLACK_BOT_TOKEN` — Slack Bot User OAuth Token
- Uses `slack_mcp_bridge` (Base44 MCP bridge)

## Cross-References
- Playbooks: Most playbooks use slack for output/notifications
- Channel: #jarvis-admin (C0AQDDC3HAB) ONLY
