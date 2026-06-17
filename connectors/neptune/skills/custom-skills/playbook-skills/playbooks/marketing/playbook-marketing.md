---
playbook: marketing
version: 1.0.0
domain: marketing
scope: domain
model_routing:
  default: "deepseek/deepseek-v3.2"
  reasoning_heavy: "anthropic/claude-sonnet-4-20250514"
  fast_iteration: "deepseek/deepseek-v4-flash"
  cheap: "deepseek/deepseek-v3.2"
auto_load: false
headline: Campaigns, lead nurture, content strategy and marketing operations
priority: P2
scope_connectors:
  - ghl-connector
  - affy-connector
  - slack-connector
triggers:
  - campaign
  - lead
  - email blast
  - nurture
  - content
  - social media
  - marketing
  - promotion
workflows:
  - campaign-orchestrator
description: "Marketing ops SOP — campaign orchestration, lead nurture sequences, email/SMS blasts via GHL, and content strategy. Routes to GHL, Affy, and Slack connectors."
intent_tags:
  - marketing
  - campaign
  - lead
  - email
  - SMS
  - nurture
  - content
associated_connectors:
  - ghl
  - slack
  - vapi
associated_skills:
  - capabilities/response-formatting
  - functions/generate-ai-email
associated_functions:
  - generate-ai-email
  - reporting_enrollments
  - reporting_lead_flow
routines_count: 2
type: "playbook"
access: internal
---

# Marketing Domain Playbook


## 🧠 PRE-CHECK KNOWLEDGE (U7.4)

Before executing any routine in this domain, the agent MUST query the Knowledge Graph:

- `knowledge://marketing/cardinal-rules`
- `knowledge://marketing/recent-patterns`

If the user query mentions a specific entity (customer, transaction, deploy, connector), also query that entity for context.

**Cardinal rules from the KG get TOP PRIORITY (confidence=1.0).**
If the KG returns conflicting information with this playbook, NOTE the conflict but FOLLOW the playbook — the U4.1 self-healing loop will resolve.
## Operational Knowledge
- **CRM:** GoHighLevel (GHL) for campaigns, pipelines, automation sequences
- **Email:** Resend for transactional, GHL for marketing campaigns
- **SMS:** GHL native SMS with opt-in tracking
- **Voice:** VAPI AI (Haley) for inbound lead qualification
- **Lead Sources:** Web forms, referrals, paid channels, organic
- **Pipeline Stages:** New Lead → Contacted → Qualified → Enrolled → Active
- **Key Metric:** 1,783 Haley leads processed, conversion to enrolled

## Business Context
- Marketing funnel feeds into customer-enrollment domain
- GHL automations trigger at pipeline stage changes
- Lead scoring based on engagement signals
- Campaign performance tracked via Base44 reportingHub
- Content: educational emails, SMS reminders, newsletter

## Anti-Patterns (DO NOT DO)
- DON'T send marketing messages without verified opt-in (TCPA compliance)
- DON'T blast all leads at once — use GHL sequences with spacing
- DON'T mix transactional and marketing emails in same thread
- DON'T send to customers who requested do-not-contact
- DON'T use scare tactics or misleading claims
- DON'T ignore unsubscribe requests (must process within 10 business days)

## Safeguards
1. Before any campaign: verify opt-in status for all recipients
2. Before SMS blast: check timezone (no messages before 8am or after 9pm local)
3. After campaign: track delivery rate, open rate, response rate
4. Bounce handling: remove hard bounces, investigate soft bounces >3
5. Unsubscribe: process immediately, confirm via email
6. Never send to customers marked do_not_contact in CustomerProfile
7. A/B test subject lines for major campaigns

## Routines

### Routine: 'Create Email Campaign'
Trigger words: 'send campaign', 'email blast', 'newsletter',
              'marketing email', 'draft campaign'

Mandatory steps:
1. Define campaign goal + target audience from CustomerProfile
2. Draft email content using generate-ai-email function (brand voice)
3. Verify opt-in status for all recipients
4. Set up GHL campaign with proper tracking
5. Schedule send time (respect timezone rules)
6. Test send to internal address first
7. After send: monitor delivery + open rates
8. Report campaign results to #jarvis-admin

### Routine: 'Lead Flow Analysis'
Trigger words: 'lead report', 'conversion rate', 'lead funnel',
              'pipeline status', 'how are leads doing'

Mandatory steps:
1. Run reportingHub lead_flow for pipeline overview
2. Run reportingHub enrollment_intelligence for conversion metrics
3. Break down by lead source
4. Identify bottlenecks: stages with high drop-off
5. Calculate time-to-conversion for each stage
6. Report with recommendations for pipeline optimization

## Custom Skills (under connectors/neptune)

### Connectors
| Skill Pack | Actions | Path | Used For |
|-----------|---------|------|----------|
| `ghl` | 35 | `connectors/neptune/skills/ghl/` | Campaigns, pipelines, SMS/email marketing, automations |

### Functions
| Function | Path | Used For |
|----------|------|----------|
| `annotation-collector` | `connectors/neptune/functions/annotation-collector.ts` | Capture campaign execution outcomes for learning |

## Refinement Notes
- 2026-06-11: Skeleton created during NEPTUNE-CLEAR-STRUCTURE CS1 migration.
- 2026-06-12: U2.4 enriched with campaign and lead flow routines.
- 2026-06-12: Phase 8 — GHL (35 actions) provides complete campaign management via neptune skills.
