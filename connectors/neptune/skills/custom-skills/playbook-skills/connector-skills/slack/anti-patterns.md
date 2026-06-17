---
type: "playbook"
name: "Anti Patterns"
description: "Auto-generated description for Anti Patterns"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# Slack Anti-Patterns — BANNED

## CRITICAL
- **Posting to #newleaf-admin**: WRONG channel. Always use #jarvis-admin.
- **@channel or @here in production**: Only with explicit authorization.
- **Exceeding 4000 char limit**: Message truncated. Split or use files.
- **Sharing customer PII in channels**: Privacy violation. Use direct messages.

## HIGH
- **Posting without thread context**: Creates noise. Thread replies for continuity.
- **Missing error handling on post**: Silent failures = missed alerts.
- **Rate limit abuse**: Slack has burst limits. Batch judiciously.

## MEDIUM
- **Over-formatting with Block Kit**: Simple messages don't need blocks.
- **Cross-posting same message**: Duplicate noise. One channel, one message.
