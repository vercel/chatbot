---
type: "connector"
name: "Mcp Guide"
description: "Auto-generated description for Mcp Guide"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# Slack MCP Integration Guide — U2.3.B

## Architecture: MCP + Custom Client Hybrid

The Slack connector uses a **dual-layer approach**:

1. **MCP Layer** (`@modelcontextprotocol/server-slack`): Handles 16 standard Slack API operations natively through the MCP protocol. These are token-efficient and auto-discoverable by AI agents.

2. **Custom Client Layer** (`connectors/slack/client.ts`): Adds 9 specialized operations that the standard MCP server doesn't cover, plus 2 bulk operations.

## MCP Coverage (16 operations)

The official Slack MCP server covers:

| Operation | Slack API | MCP? |
|-----------|-----------|------|
| List channels | `conversations.list` | Yes |
| Get channel info | `conversations.info` | Yes |
| Channel history | `conversations.history` | Yes |
| Post message | `chat.postMessage` | Yes |
| Update message | `chat.update` | Yes |
| Delete message | `chat.delete` | Yes |
| List users | `users.list` | Yes |
| Get user | `users.info` | Yes |
| Lookup by email | `users.lookupByEmail` | Yes |
| Add reaction | `reactions.add` | Yes |
| Remove reaction | `reactions.remove` | Yes |
| Get reactions | `reactions.get` | Yes |
| Search messages | `search.messages` | Yes |
| Channel members | `conversations.members` | Yes |
| Invite to channel | `conversations.invite` | Yes |
| Kick from channel | `conversations.kick` | Yes |

## Custom Client Extensions (11 operations)

Operations that go beyond MCP coverage:

| Operation | Why Custom |
|-----------|------------|
| `send_dm` | Opens DM channel + sends in one call |
| `schedule_message` | Uses `chat.scheduleMessage` — not in base MCP |
| `upload_file` | Uses `files.uploadV2` — not in base MCP |
| `set_topic` | Uses `conversations.setTopic` — not in base MCP |
| `set_purpose` | Uses `conversations.setPurpose` — not in base MCP |
| `get_team_info` | Uses `team.info` — workspace-level |
| `get_user_presence` | Uses `users.getPresence` — status info |
| `thread_replies` | Uses `conversations.replies` — threaded view |
| `send_thread_reply` | Reply in thread (same as postMessage with thread_ts but explicit) |
| `bulk_send` | Multi-channel broadcast with parallel execution |
| `bulk_react` | Multi-message reaction with parallel execution |

## MCP Configuration

```json
{
  "slack": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-slack"],
    "env": {
      "SLACK_BOT_TOKEN": "${SLACK_BOT_TOKEN}",
      "SLACK_TEAM_ID": "${SLACK_TEAM_ID}"
    }
  }
}
```

## When to Use MCP vs Custom Client

**Use MCP for:**
- Standard read operations (list channels, get history, search)
- Standard write operations (post/update/delete messages)
- User management (list, lookup)
- Simple reactions (add, remove, get)

**Use Custom Client for:**
- Bulk operations across multiple channels/messages
- Scheduled messages (future delivery)
- File uploads
- Channel management (topic, purpose)
- Direct message orchestration
- Team-wide and presence queries

## Authentication

Both layers use the same `SLACK_BOT_TOKEN` from `secrets.slack.botToken`. Ensure the bot has these OAuth scopes:
- `channels:read`, `channels:history`, `channels:write`
- `chat:write`, `chat:write.customize`, `chat:write.public`
- `files:write`
- `reactions:read`, `reactions:write`
- `users:read`, `users:read.email`
- `team:read`
- `search:read`
