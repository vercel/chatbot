---
type: "connector"
name: "Api Reference"
description: "Auto-generated description for Api Reference"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# Slack API Reference — U2.3.B Comprehensive

## Overview

The Slack connector provides 27 actions across 3 categories: READ (12), WRITE (13), and BULK (2). Uses `@slack/web-api` WebClient with `secrets.slack.botToken`.

## Action Reference

### READ Actions

| Action | Description | Required Args |
|--------|-------------|---------------|
| `list_channels` | List all accessible channels | (optional) `limit`, `types`, `exclude_archived` |
| `get_channel` | Get channel details by ID | `channel` |
| `channel_history` | Get message history of a channel | `channel`, (optional) `limit` |
| `thread_replies` | Get replies in a thread | `channel`, `ts` |
| `search_messages` | Search messages by query | `query`, (optional) `count` |
| `list_users` | List workspace users | (optional) `limit` |
| `get_user` | Get user by ID | `user` |
| `get_user_by_email` | Lookup user by email | `email` |
| `get_reactions` | Get reactions on a message | `channel`, `ts` |
| `get_channel_members` | List members of a channel | `channel`, (optional) `limit` |
| `get_team_info` | Get workspace info | (none) |
| `get_user_presence` | Get user online/presence status | `user` |

### WRITE Actions

| Action | Description | Required Args |
|--------|-------------|---------------|
| `send_message` | Post a message to a channel | `channel`, `text` |
| `send_thread_reply` | Reply in a thread | `channel`, `text`, `thread_ts` |
| `send_dm` | Send direct message to user | `user`, `text` |
| `add_reaction` | Add emoji reaction | `channel`, `name`, `timestamp` |
| `remove_reaction` | Remove emoji reaction | `channel`, `name`, `timestamp` |
| `update_message` | Edit a message | `channel`, `ts`, `text` |
| `delete_message` | Delete a message | `channel`, `ts` |
| `set_topic` | Set channel topic | `channel`, `topic` |
| `set_purpose` | Set channel purpose | `channel`, `purpose` |
| `upload_file` | Upload a file | `channels`, `content`, (optional) `filename`, `title` |
| `schedule_message` | Schedule future message | `channel`, `text`, `post_at` (Unix ts) |
| `invite_to_channel` | Invite users to channel | `channel`, `users` (comma-separated) |
| `kick_from_channel` | Remove user from channel | `channel`, `user` |

### BULK Actions

| Action | Description | Required Args |
|--------|-------------|---------------|
| `bulk_send` | Send to multiple channels in parallel | `channels` (string[]), `text` |
| `bulk_react` | React to multiple messages in parallel | `reacts` ({channel, name, timestamp}[]) |

## Usage Pattern

```typescript
import { execute } from "@/connectors/slack/client";

// List channels
const { data } = await execute({ action: "list_channels", args: { limit: 50 } });

// Send message
await execute({ action: "send_message", args: { channel: "#jarvis-admin", text: "Hello from U2.3" } });

// Bulk send to multiple channels
await execute({
  action: "bulk_send",
  args: { channels: ["#general", "#random"], text: "Broadcast message" }
});
```

## Error Handling

All actions return `ActionResponse` with `{ success, data, error, action }`. Failed calls never throw — they return `success: false` with an error message.

## Required OAuth Scopes

The SLACK_BOT_TOKEN must have these scopes:
- `channels:read`, `channels:history`, `channels:write`
- `chat:write`, `chat:write.customize`, `chat:write.public`
- `files:write`
- `reactions:read`, `reactions:write`
- `users:read`, `users:read.email`
- `team:read`
- `search:read`
- `groups:read`, `groups:write` (for private channels)
