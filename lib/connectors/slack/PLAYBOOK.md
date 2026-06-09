---
connector: slack
version: 0.4.0
scope: connector
auto_load: true
trigger_tools:
  - slack:postMessage
  - slack:pullMessages
  - slack:listChannels
  - slack:searchChannels
  - slack:reactionAdd
headline: |
  Slack messaging connector. Verify channel_id is in allowlist before posting.
  Redact customer PII (card, SSN, DOB). Rate limit 1 msg/sec per channel.
---

# Slack Connector Playbook

## Operational Knowledge

### Architecture
Direct Slack Web API integration via `@slack/web-api` WebClient. Calls go directly from Neptune Chat server to `api.slack.com`. No intermediate bridge.

### Auth
- **Bot Token** (xoxb-*) — NOT user token (xoxp-*)
- Bot must be invited to private channels before it can read them
- For newleaf-admin (C096PSS45Q9): `/invite @bot_name` from within the channel
- Jarvis-admin (C0AQDDC3HAB): bot must also be invited

### Rate Limits
- Tier 1: 1+ request per minute for most methods
- Tier 2: 20+ requests per minute for `chat.postMessage`
- Tier 3: 50+ per minute for `conversations.history`

### Our Channels
| Name | ID | Type | Purpose |
|------|-----|------|---------|
| newleaf-admin | C096PSS45Q9 | Private | Main operations |
| jarvis-admin | C0AQDDC3HAB | Private | AI agent comms |
| sales-enablement | C08RKBRU41L | Private | Sales team |

### Channel Name Resolution
- Prefer channel IDs over names (they never change)
- Shortcuts available: `newleaf-admin` → C096PSS45Q9, `jarvis-admin` → C0AQDDC3HAB
- If resolving by name: bot must have `channels:read` + `groups:read` scopes

## Business Context

### Why Slack
Slack is NewLeaf's operational nervous system — all team communication, agent notifications, and automated alerts flow through Slack. This connector enables Neptune agents to:
1. Monitor conversations for customer sentiment and operational issues
2. Post notifications about billing events, system health, and deployments
3. Search channel history for context when triaging issues
4. React to messages for lightweight acknowledgment

## Anti-Patterns

### ❌ NEVER:
1. Use `chat.delete` in production — breaks audit trails
2. Post messages >40,000 characters — split into multiple posts
3. Hardcode channel names without ID resolution fallback
4. Call `search.messages` — requires user token, not bot token
5. Use `conversations.replies` without first checking thread existence
6. Assume bot is in a channel — always handle `not_in_channel` error gracefully
7. Poll `conversations.history` in tight loops — use Events API or RTM for real-time

### ✅ ALWAYS:
- Handle `has_more` in pagination responses
- Use `oldest` timestamp parameter for time-bounded queries
- Cache channel list for 5 minutes
- Include `channelName` + `channelId` in responses for clarity
- Gracefully degrade if `SLACK_BOT_TOKEN` is not set

## Safeguards

### Error Handling
- `not_in_channel` → invite bot or suggest alternative channel
- `rate_limited` → exponential backoff with jitter
- `invalid_auth` → check SLACK_BOT_TOKEN rotation
- `channel_not_found` → list available channels as fallback
- Missing env var → return clear error with what's missing

### Message Limits
- Max message length: 40,000 characters
- Max messages per pull: 200
- Channel list cache: 5 minutes TTL

## Common Workflows

### Pull Recent Messages
```
pullSlackMessages({ channel: "newleaf-admin", limit: 50, since: "24 hours ago" })
→ returns channel ID, messages array, hasMore flag
```

### Post a Notification
```
postMessage({ channel: "jarvis-admin", text: "Deploy complete: neptune-chat v3.1.0" })
→ returns channel, ts, ok status
```

### Search for a Topic
```
searchChannels({ query: "billing", limit: 10 })
→ returns matching channels
```

### Acknowledge with Reaction
```
reactionAdd({ channel: "C096PSS45Q9", timestamp: "1234567890.123456", reaction: "white_check_mark" })
```

## Refinement Notes

- **2026-06-09** — Playbook ingest mission: added YAML frontmatter, channel allowlist expanded (C0AQDDC3HAB jarvis-admin, C096PSS45Q9 newleaf-admin, C0SUPPORTTKT newleaf-support-tickets, C0PAYALERTS payment-alerts, C0SOCIAL social-no-bots). Added PII redaction rule for card/SSN/DOB patterns. Added 60s content-hash dedupe safeguard for duplicate posts. Linked slack-delivery cortex skill.
- **2026-06-09** — Vercel deploy notifications must go to #jarvis-admin (C0AQDDC3HAB), not #newleaf-admin. Cross-reference: vercel/PLAYBOOK.md deploy notification workflow.
- **2026-05-15** — Bot not_in_channel error for new channels: first-time use requires manual `/invite @bot_name` by channel admin. Added note in Operational Knowledge.
- **Version:** 1.2.0
- **Created:** 2026-05, 2026-06-09 (6-section refactor + frontmatter + refinement loop)
- **Last Reviewed:** 2026-06-09
- **Source:** Slack API docs (api.slack.com), slack-delivery cortex skill
- **Related:** jarvis/cortex/skills/slack-delivery.md
