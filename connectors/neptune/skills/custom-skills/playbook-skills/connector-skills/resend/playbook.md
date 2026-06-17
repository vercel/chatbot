---
type: "playbook"
name: "Playbook"
description: "Auto-generated description for Playbook"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# resend Connector — Operational Playbook

## Overview
Resend email delivery — send emails, track delivery status, list sent emails

## When to Use
- Use this connector when the task involves resend-specific operations
- Check patterns.md for common anti-patterns before execution
- Cross-reference with business playbooks that depend on this connector

## Available Functions
See functions.yaml for the complete function catalog with parameter schemas.

## Safeguards
- Always validate input parameters before calling connector functions
- Check connector health status before executing critical operations
- Use idempotency keys for financial operations where applicable

## Anti-Patterns
- Do not bypass the connector skill — always use the defined functions
- Do not call connector functions directly without checking context
- See anti-patterns.md for the full list

## Self-Healing
- Failed calls are logged to library_raw_events
- Nightly synthesis identifies failure patterns
- Wiki entries are auto-generated for repeated issues
