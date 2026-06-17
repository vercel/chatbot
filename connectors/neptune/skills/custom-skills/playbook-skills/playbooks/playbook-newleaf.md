---
playbook: root
version: 0.3.0
scope: workspace
auto_load: true
skills:
  - slack-connector
  - base44-connector
  - nmi-connector
  - hyperswitch-connector
  - forth-connector
  - ghl-connector
  - linear-connector
  - vapi-connector
  - github-connector
  - vercel-connector
headline: |
  NewLeaf Financial operations root playbook. All agents load this first.
  Routes intents to domain playbooks. 168 active enrolled customers, $33,749 MRR.
type: "playbook"
---

# NewLeaf Financial — Root Playbook

## Operational Knowledge

### System Architecture
- **Primary backend:** Base44 (entity persistence, 12 entities, 16 report actions)
- **Payments:** NMI via Hyperswitch orchestration (155 confirmed billing, 158 active subscriptions)
- **CRM:** GoHighLevel (GHL) for contacts, SMS, email, pipeline
- **Voice:** VAPI AI (Haley) for inbound support — 1,783 Haley leads processed
- **Credit repair:** Forth DPP for disputes and credit reports
- **Messaging:** Slack (#jarvis-admin for agent ops)
- **Email:** Resend for transactional emails
- **Issue tracking:** Linear (teams: ENG, OPS, PAY, COMP, AGT)
- **Deployment:** Vercel (neptune-chat + neptune-v2)

### Service Health (2026-06-11)
- NMI: operational (48 txns/24h, 0% error rate)
- GHL: operational (59 ops/24h, 0% error rate)
- Slack: operational (30 ops/24h)
- VAPI: delayed (last success 20h ago, expected every 12h)
- Freshcaller: DOWN (19h no sync)
- Resend: operational

### Data Freshness
- Slack sync running but writing 0 records ⚠️
- GHL last sync: 2026-06-11T01:07 UTC

## Routing Table (Intent → Domain Playbook)

| Intent Keywords | Domain Playbook | Primary Skills |
|----------------|-----------------|----------------|
| refund, charge, payment, billing, subscription, decline, invoice | billing/PLAYBOOK.md | nmi-connector, hyperswitch-connector |
| dispute, credit report, FCRA, bureau, negative item | disputes/PLAYBOOK.md | forth-connector, parse-fcra-credit-report |
| ticket, help, support, callback, question, problem | customer-support/PLAYBOOK.md | ghl-connector, vapi-connector, linear-connector |
| email, sms, text, message, notify, campaign | comms/PLAYBOOK.md | slack-connector, ghl-connector, resend-connector |
| code, PR, deploy, repo, commit, sandbox, build | coding/PLAYBOOK.md | github-connector, vercel-connector |
| agent, orchestrate, dispatch, playbook, refiner | agent-orchestration/PLAYBOOK.md | playbook-refiner, artifact-response-pattern |
| VPS, pm2, deploy, daemon, server, hostinger | vps-ops/PLAYBOOK.md | vps-bridge-connector |
| newleaf, Haley, enrollment, recovery, credit restoration | newleaf-ops/PLAYBOOK.md | base44-connector, forth-connector |
| vercel, env, deploy, project | vercel-discipline/PLAYBOOK.md | vercel-connector |

## Business Context

### Organization
- **Company:** NewLeaf Financial
- **Owner/Operator:** Abhi (abhiswami2121@gmail.com)
- **Key Agent:** Jerry (jerry.b.yirenkyi@gmail.com)
- **Customers:** 2,000 total, 168 enrolled active, 97 enrolled pending
- **MRR:** $33,749.32 (155 confirmed billing)
- **Avg Health Score:** 89

### Customer Tiers
- Standard: Up to $200/mo auto-approval threshold
- Premium: Custom thresholds (check CustomerProfile)

### SLAs
- Billing inquiries: 4h response
- Support tickets: 24h response (high priority: 4h)
- Dispute processing: 72h
- Payment failures: auto-retry within 24h

## Anti-Patterns

1. **NEVER post to #newleaf-admin** — use #jarvis-admin ONLY (cardinal 6a276f8c)
2. **NEVER call hostingerBridge from off-VPS** — 5-30s latency + Cloudflare 403 risk
3. **NEVER pm2 reload from inside Claude session** — kills the session (cardinal 6a153d63)
4. **NEVER use vercel CLI** — silent empty bug, use REST API only (cardinal 6a273f70)
5. **NEVER push directly to main** — all changes via PR with `ai-agent` label
6. **NEVER skip CI** — pnpm run ci (V2) and pnpm build (Chat) must pass
7. **NEVER commit as anyone but abhiswami2121** (cardinals 6a29cf6f + 6a20a987)
8. **NEVER cancel sessions you don't own** (cardinal 6a29d171)
9. **NEVER ask user questions mid-mission** — use Decision Defaults
10. **NEVER stop mid-phase unless anti-loop trigger fires**

## Safeguards

### Pre-Flight (every action)
1. VPS health gate: if CPU > 90%, wait 60s before proceeding
2. Verify Slack channel is #jarvis-admin before posting
3. Check git config: user.name=abhiswami2121, user.email=abhiswami2121@gmail.com
4. Verify VERCEL_TOKEN is not exposed to client
5. Check for concurrent Vercel deploys before triggering new one

### Cross-Cutting
- All agent messages must include trace ID
- Redact PII (SSN, card numbers, DOB) in all outputs
- Log all billing mutations for audit trail
- Never merge customer profiles without explicit approval
- CAPTCHA/Fraud check on all customer-facing forms

## Refinement Notes

### Evidence-Based Safeguards
- **cardinal 6a153d63**: 2026-06-11 01:30 UTC session c0e7413d17dd died at 82% during pm2 reload, work lost
- **Freshcaller DOWN**: 19h no sync as of 2026-05-22 — monitor alerts needed
- **Slack sync writing 0 records**: investigate sync pipeline
- **Payment fail rate**: 24 fails vs 13 successes this week (65% fail rate) — needs root cause
- **Recovery reconciliation**: Cynthia Adkins (cofCompliant=false, no_day_zero) — flagged for manual review
- **VAPI delayed**: last success 20h ago, expected every 12h — cron health check needed
- **Repeat callers**: Mark Esquivel, Reginald Riggins, Bruce Blackham all called multiple times — callback SLA issue
