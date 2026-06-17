---
name: slack-connector
version: 1.0.0
kind: connector
primary_domain: comms
also_in: [support-triage, reporting, agent-payments]
tools: [postMessage, pullMessages, listChannels, searchChannels, reactionAdd, sendThreadReply]
dependencies: []
headline: |
  Slack messaging connector. Verify channel_id is in allowlist before posting.
  Redact customer PII (card, SSN, DOB). Rate limit 1 msg/sec per channel.
type: "skill"
---

# Slack Connector Skill

## Operational Knowledge

Slack API access via Base44 Slack MCP Bridge. All messages route through VPS bridge for auth.

### Channels
- #jarvis-admin (C0AQDDC3HAB): Primary agent operations — use ONLY this channel per cardinal 6a276f8c
- #newleaf-admin: NEVER post here from agent sessions

## Tools

| Tool | Description |
|------|-------------|
| postMessage | Send message to channel |
| pullMessages | Fetch channel history |
| listChannels | List accessible channels |
| searchChannels | Search by name/topic |
| reactionAdd | Add emoji reaction |
| sendThreadReply | Reply in thread |

## Anti-Patterns
- NEVER post to #newleaf-admin
- NEVER expose customer PII in Slack messages
- NEVER exceed 1 msg/sec per channel

## Safeguards
- Verify channel_id is in allowlist before posting
- Redact card numbers, SSN, DOB from message text
- All agent messages must include trace ID
