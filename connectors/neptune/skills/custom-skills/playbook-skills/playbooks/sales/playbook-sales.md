---
title: "Playbook: Sales & Lead Flow"
domain: sales
priority: P2
version: "1.0.0"
date: 2026-06-15
status: STUB
model_routing:
  default: "deepseek/deepseek-v4-pro"
  reasoning_heavy: "anthropic/claude-sonnet-4-6"
  fast_iteration: "deepseek/deepseek-v4-flash"
  long_context: "zai/glm-5.1"
type: "playbook"
access: internal
---

# Playbook: Sales & Lead Flow

> **Domain:** sales | **Priority:** P2 | **Version:** 1.0.0 (STUB)
> **Canonical path:** `connectors/neptune/skills/custom-skills/playbook-skills/playbooks/playbook-sales.md`

## Domain Scope

Sales, lead flow, GHL pipeline management, enrollment sequences, and conversion optimization.

## Intent Routing

| Intent | Trigger Keywords | Action |
|--------|-----------------|--------|
| Lead lookup | lead, prospect, contact, find lead | Query GHL contacts via connector |
| Pipeline status | pipeline, stage, deal, opportunity | GHL pipeline query |
| Lead nurture | nurture, follow up, sequence, drip | Automation sequence management |
| Campaign | campaign, dialer, outbound, auto dialer | GHL campaigns |
| DNC compliance | dnc, do not call, opt out, unsubscribe | DncList entity check |

## Connectors

- `connectors/ghl/` — GoHighLevel CRM (primary)
- `connectors/slack/` — #jarvis-admin notifications
- `connectors/base44/` — Entity queries (DncList, CustomerProfile)

## Safeguards

1. **10DLC compliance** — all SMS must be 10DLC registered
2. **DNC check mandatory** — before any outbound contact
3. **NEVER spam** — respect opt-out/unsubscribe immediately
4. **Lead data privacy** — no PII in Slack or non-secure channels

## Anti-Patterns

- ❌ Sending SMS/calls to DNC-listed numbers
- ❌ Bypassing GHL campaign rate limits
- ❌ Using real customer data in test scenarios

---

*STUB — expand with detailed SOPs for each intent route.*
