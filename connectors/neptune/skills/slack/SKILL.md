---
name: slack-skills
version: 1.0.0
connector: slack
scope: neptune-custom
total_actions: 6
priority: P1
intent_tags:
  - slack
  - messaging
  - notifications
  - channels
  - comms
associated_connectors:
  - base44
  - github
  - vapi
headline: |
  6 Slack actions: messages, channels, threads, reactions, and user profiles.
  Communication hub for Jarvis and NewLeaf ops.
type: "skill"
access: internal
---

# Slack Integration Skills — 6 Actions

## Core Intent
Complete Slack workspace management: pull messages from channels, post messages and thread replies, fetch channel history, get user profiles, and add emoji reactions. The Slack connector is the primary communication channel for Jarvis.

## Action Catalog

### Messaging (3 actions)
| # | Action | Description |
|---|--------|-------------|
| 1 | `message.pull` | Pull recent messages from a Slack channel |
| 2 | `message.post` | Post a message to a Slack channel |
| 3 | `message.reply` | Reply in a thread |

### Channel & User (3 actions)
| 4 | `channel.history` | Fetch channel message history |
| 5 | `user.info` | Get Slack user profile info |
| 6 | `message.react` | Add emoji reaction to a message |

## Anti-Patterns
- NEVER post to newleaf-admin — use #jarvis-admin ONLY
- NEVER @channel or @here without explicit approval
- ALWAYS use thread replies for follow-ups
- NEVER post secrets or tokens in Slack messages
