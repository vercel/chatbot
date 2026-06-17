---
type: "playbook"
name: "Patterns"
description: "Auto-generated description for Patterns"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# Slack Patterns — Always-Check Rules

## Pre-Flight Checklist (ALWAYS)
- [ ] Target channel is #jarvis-admin (NEVER #newleaf-admin)
- [ ] Message under 4000 characters (Slack limit)
- [ ] Blocks formatted correctly if using Block Kit
- [ ] Thread reply uses correct parent `thread_ts`
- [ ] No @channel or @here without explicit authorization

## Pattern: Landing Report
1. Compose report with status, metrics, URLs
2. Format with emoji for visual scanning
3. Post to #jarvis-admin
4. Add ✅ reaction on success

## Pattern: Alert Notification
1. Detect alert condition
2. Format concise alert message (< 500 chars)
3. Include: what, when, severity, action needed
4. Post to #jarvis-admin with @mention if urgent

## Pattern: Context Retrieval
1. Get channel history (limit to recent)
2. Parse for relevant messages
3. Extract user info if needed
4. Build context for response
