---
name: Marketing Operations Playbook
description: Campaign management, affiliate tracking, customer communications, and GHL integration for marketing workflows.
domain: marketing
connectors: [ghl, affy, resend]
version: "1.0"
updated: 2026-06-22
---

# Marketing Operations Playbook

## Purpose
Manage marketing campaigns, affiliate programs, email communications, and customer outreach via GHL and Affy.

## Safeguards
- All marketing emails must include unsubscribe link
- SMS campaigns require opt-in verification
- Affiliate payouts require approval gate
- Campaign budgets enforced at launch

## Routines

### Routine: Campaign Launch
1. Define campaign: audience, channel, content, budget
2. Create campaign in GHL
3. Configure targeting and scheduling
4. Review compliance (unsubscribe, opt-in)
5. Launch with budget cap
6. Monitor performance metrics

### Routine: Affiliate Performance Report
1. Pull affiliate stats from Affy API
2. Calculate: clicks, conversions, revenue, commissions
3. Rank affiliates by performance
4. Flag suspicious activity
5. Generate payout recommendations

### Routine: Email Campaign Audit
1. Pull sent campaigns (last 30 days)
2. Calculate: open rate, click rate, bounce rate, unsubscribe rate
3. Compare against industry benchmarks
4. Identify underperforming campaigns
5. Recommend optimization actions

### Routine: Customer Re-engagement
1. Identify inactive customers (>30 days)
2. Segment by reason (no payment, no login, no communication)
3. Draft re-engagement sequence
4. Deploy via GHL
5. Track response rate

## Workflows
- **campaign-launch**: Full campaign creation and deployment
- **affiliate-audit**: Affiliate performance and fraud check
- **re-engagement**: Customer re-engagement automation

## Anti-Patterns
- Do NOT send SMS without verified opt-in
- Do NOT auto-approve affiliate payouts without review
- Do NOT send marketing to disputed accounts
