# N8N Tri-Integration Workflows — Phase 30.5

**Date:** 2026-06-17  
**Host:** n8n.newleaf.financial (port 5678, self-hosted on VPS)  
**Status:** 4 workflows defined — ready for import

---

## Architecture

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Slack   │────▶│   n8n    │────▶│  Linear  │
│  #cust.. │     │  :5678   │     │  Issues  │
└──────────┘     └────┬─────┘     └──────────┘
                      │
                      ▼
                 ┌──────────┐
                 │  Twenty  │
                 │  CRM     │
                 └──────────┘
```

All 4 workflows operate through n8n's self-hosted engine on the VPS. Each receives webhooks, processes events, and bridges between Slack, Linear, and Twenty CRM.

---

## WF1: Slack DM → Linear Ticket + Twenty SupportTicket

**File:** `WF1-slack-dm-to-linear-twenty.json`  
**Webhook:** `POST /webhook/slack-inbound`  
**Trigger:** Slack message in #customer-support with keywords: "support", "help", "issue"

### Flow
1. **Slack Webhook Trigger** — receives inbound Slack event  
2. **Filter Support Keywords** — checks message text contains support/help/issue  
3. **Create Linear Issue** — creates issue in "Customer Operations" team with Slack context  
4. **Create Twenty SupportTicket** — creates ticket via Twenty GraphQL with Slack thread mapping  
5. **Slack Reply with Ticket ID** — posts Block Kit message with Linear link + Twenty ID

### Environment Variables
| Variable | Purpose |
|----------|---------|
| `TWENTY_API_KEY` | Twenty GraphQL API auth |
| `LINEAR_API_KEY` | Linear API key (built into Linear node) |
| `SLACK_BOT_TOKEN` | Slack bot token for posting replies |

---

## WF2: Twenty SupportTicket → Linear Issue

**File:** `WF2-twenty-support-to-linear.json`  
**Webhook:** `POST /webhook/twenty-support-created`  
**Trigger:** Twenty webhook on `supportTicket.created`  
**Security:** HMAC-SHA256 via `X-Twenty-Webhook-Signature`

### Flow
1. **Twenty Webhook Trigger** — receives `supportTicket.created` event  
2. **Verify Signature** — HMAC-SHA256 check against `TWENTY_APP_SECRET`  
3. **Check Event Type** — validates `supportTicket.created` event  
4. **Create Linear Issue** — mirrors ticket in Linear with priority mapping (critical→Urgent)  
5. **Update Twenty with Linear ID** — writes `linearId` + `linearUrl` back to Twenty ticket

### Environment Variables
| Variable | Purpose |
|----------|---------|
| `TWENTY_APP_SECRET` | Twenty webhook HMAC signing secret |
| `TWENTY_API_KEY` | Twenty GraphQL API auth |
| `LINEAR_API_KEY` | Linear API key |

---

## WF3: Linear Issue Update → Twenty Status + Activity

**File:** `WF3-linear-status-to-twenty.json`  
**Webhook:** `POST /webhook/linear-issue-updated`  
**Trigger:** Linear webhook on `Issue.update`  
**Security:** HMAC-SHA256 via `Linear-Signature` header

### Flow
1. **Linear Webhook Trigger** — receives `Issue.update` event  
2. **Verify Linear HMAC** — HMAC-SHA256 against `LINEAR_WEBHOOK_SECRET`  
3. **Check Issue Update Event** — validates `type=Issue` + `action=update`  
4. **Has Linear Identifier** — ensures issue has identifier (e.g., NEW-123)  
5. **Find Twenty Ticket by Linear ID** — GraphQL query matching `linearId`  
6. **Map Status** — translates Linear states to Twenty statuses:
   - Triage/Todo/Backlog/unstarted → `OPEN`
   - In Progress/In Review/started → `IN_PROGRESS`
   - Done/Canceled/completed → `CLOSED`
7. **Update Twenty Ticket Status** — mutation sets status on matched ticket  
8. **Append Twenty Activity** — creates Activity entry with status change details + Linear link

### Environment Variables
| Variable | Purpose |
|----------|---------|
| `LINEAR_WEBHOOK_SECRET` | Linear webhook HMAC signing secret |
| `TWENTY_API_KEY` | Twenty GraphQL API auth |

---

## WF4: Slack Thread Reply → Twenty Activity + Linear Comment

**File:** `WF4-slack-reply-to-twenty-activity.json`  
**Webhook:** `POST /webhook/slack-thread-reply`  
**Trigger:** Slack message reply in a known ticket thread  
**Filters:** Must have `thread_ts` + not be a bot message

### Flow
1. **Slack Thread Reply Trigger** — receives Slack message event  
2. **Is Thread Reply** — checks `event.thread_ts` exists (only thread replies)  
3. **Not Bot Message** — filters out bot messages to avoid loops  
4. **Find Twenty by Slack Thread** — GraphQL query matching `slackThreadTs` + `slackChannel`  
5. **Get Slack User Info** — resolves user ID to display name  
6. **Append Twenty Activity** — creates Activity with Slack message content + permalink  
7. **Append Linear Comment** — mirrors the Slack reply as a Linear comment on linked issue

### Environment Variables
| Variable | Purpose |
|----------|---------|
| `TWENTY_API_KEY` | Twenty GraphQL API auth |
| `SLACK_BOT_TOKEN` | Slack bot token for user info lookup |

---

## Webhook Endpoints Summary

| Workflow | Endpoint | Security |
|----------|----------|----------|
| WF1 | `POST /webhook/slack-inbound` | Slack signing secret (n8n built-in) |
| WF2 | `POST /webhook/twenty-support-created` | HMAC-SHA256 (X-Twenty-Webhook-Signature) |
| WF3 | `POST /webhook/linear-issue-updated` | HMAC-SHA256 (Linear-Signature) |
| WF4 | `POST /webhook/slack-thread-reply` | Slack signing secret (n8n built-in) |

**Base URL:** `https://n8n.newleaf.financial`

---

## n8n Credentials Required

| Credential | Type | Values |
|------------|------|--------|
| Slack API | OAuth2 | Bot token (xoxb-...) |
| Linear API | API Key | Personal API key |
| Twenty CRM | Header Auth | `Authorization: Bearer <TWENTY_API_KEY>` |
| Linear Webhook | Header Auth | `linear-signature` HMAC verification |

---

## Import Instructions

```bash
# 1. Access n8n at https://n8n.newleaf.financial
# 2. Settings → Import Workflow → Upload JSON file
# 3. Configure credentials for each node
# 4. Activate workflows (toggle to "Active")
# 5. Configure webhook URLs in respective services:
#    - Slack: https://n8n.newleaf.financial/webhook/slack-inbound
#    - Twenty: https://n8n.newleaf.financial/webhook/twenty-support-created
#    - Linear: https://n8n.newleaf.financial/webhook/linear-issue-updated
#    - Slack: https://n8n.newleaf.financial/webhook/slack-thread-reply
```

---

## Error Handling

- **HMAC mismatch**: Workflow throws and returns 400 — n8n retries with exponential backoff
- **Twenty not found**: WF3/WF4 silently skip if no matching ticket exists (no activity created)
- **Rate limiting**: Twenty GraphQL client enforces 60 RPM; n8n built-in retry handles 429s
- **Circular prevention**: WF4 filters bot messages; WF3 only fires on state changes (not comments)
