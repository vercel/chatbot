---
title: "05 — Playbooks Catalog"
version: "1.0.0"
last_updated: "2026-06-15"
owner: "playbook-skills meta-skill"
status: ACTIVE
kb_index: 5
playbooks_cataloged: 16
---

# 05 — Playbooks Catalog

Complete inventory of all 16 business playbooks.

## P0 Playbooks (Critical — Money, Compliance, Core Product)

### playbook-billing.md
- **Path:** `connectors/neptune/skills/custom-skills/playbook-skills/playbooks/playbook-billing.md`
- **Domain:** billing-flow
- **Intents:** 12 (charge, refund, payment status, decline recovery, billing link, subscriptions, vault health, billing chain, date change, CVV errors, NMI ops, Hyperswitch)
- **Key Connectors:** NMI, Hyperswitch, Base44, Slack
- **Safeguards:** Golden Vault architecture, NEVER source_transaction_id, CIT/MIT rules

### playbook-support.md
- **Path:** `.../playbook-skills/playbooks/playbook-support.md`
- **Domain:** customer-support
- **Intents:** 7 (customer 360, create ticket, triage, resolve, chargeback risk, complaint, inquiry)
- **Key Connectors:** Base44, Slack, Vapi
- **Safeguards:** SLA tracking (4h critical), 48h cooldown, sentiment escalation

### playbook-disputes.md
- **Path:** `.../playbook-skills/playbooks/playbook-disputes.md`
- **Domain:** credit-disputes
- **Intents:** 6 (start, track, letter, round 2, credit report, FCRA check)
- **Key Connectors:** Forth, Base44, Affy
- **Safeguards:** FCRA 30-day clock, statutory windows, supervisor review

### playbook-planning.md
- **Path:** `.../playbook-skills/playbooks/playbook-planning.md`
- **Domain:** planning-research
- **Intents:** 16 (write PRD, draft TRD, impl plan, deep research, gap analysis, plan mode, dispatch, diagram, cardinal rules, synthesize, workflow design, save to cortex, plan review, full pipeline, quick scan, research execution)
- **Key Connectors:** All planning-research-suite skills
- **Safeguards:** Plan mode approval gate, auto-detect ≥3 phases

## P1 Playbooks (Important — Operations, Engineering)

### playbook-engineering.md
- **Domain:** engineering | **Intents:** 7 | **Key:** Code review, PRD, refactor, debug, build feature, MCP edits

### playbook-reporting.md
- **Domain:** reporting | **Intents:** 7 | **Key:** Morning pulse, customer metrics, billing recon, agent perf, sync health, enrollment funnel, custom reports

### playbook-deploy.md
- **Domain:** deploy-vercel-github | **Intents:** 4 | **Key:** Ship, create PR, stale UI, rollback

### playbook-vercel-discipline.md
- **Domain:** vercel-discipline | **Intents:** 3 | **Key:** Deploy to Vercel, check status, security/config

### playbook-vps-ops.md
- **Domain:** vps-ops | **Intents:** 5 | **Key:** Health check, incident response, deploy, logs, SSL

### playbook-agent-orchestration.md
- **Domain:** agent-orchestration | **Intents:** 5 | **Key:** Dispatch, multi-agent, failure recovery, check status, spawn coding agent

## P2 Playbooks (Supporting — Growth, Team)

### playbook-marketing.md
- **Domain:** marketing | **Intents:** 6 | **Key:** Campaign, nurture, SMS/email blast, DNC, analytics, enrollment sequence

### playbook-hr.md
- **Domain:** hr | **Intents:** 3 | **Key:** Team status, onboarding, compliance training

### playbook-sales.md (NEW Phase 21 V3)
- **Domain:** sales | **Intents:** 3 | **Key:** Sales pipeline, lead qualification, enrollment funnel

### playbook-video-generation.md (NEW Phase 21 V3)
- **Domain:** video-generation | **Intents:** 3 | **Key:** Generate, edit, script-to-video

## META Playbooks

### playbook-newleaf.md
- **Domain:** newleaf | **Key:** Organization-wide playbook, global rules

### playbook-index.md
- **Domain:** index | **Key:** Domain catalog, capability discovery, fallback router

## Playbook Frontmatter Standard

```yaml
---
title: "Playbook: Domain Name"
domain: domain-name
priority: P0|P1|P2
version: "1.0.0"
date: YYYY-MM-DD
status: ACTIVE|STUB
model_routing:
  default: "deepseek/deepseek-v4-pro"
  reasoning_heavy: "anthropic/claude-sonnet-4-6"
  fast_iteration: "deepseek/deepseek-v4-flash"
---
```

---

*Phase 21 V3 — Fractal Library + Router-as-Map*
