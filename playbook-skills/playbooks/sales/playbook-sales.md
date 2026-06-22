---
name: Sales Operations Playbook
description: Lead management, enrollment pipeline, CRM actions, and sales communication workflows.
domain: sales
connectors: [ghl, base44, forth, slack]
version: "1.0"
updated: 2026-06-22
---

# Sales Operations Playbook

## Purpose
Manage lead flow, enrollment pipeline, CRM actions, and sales communications across GHL and Base44.

## Safeguards
- All enrollment actions must be audit-trailed
- Credit report pulls require explicit consent
- Sales communications must follow TCPA compliance
- Lead data accuracy verified before enrollment

## Routines

### Routine: Lead Intake
1. Capture lead from GHL or web form
2. Validate contact information
3. Create Base44 CustomerProfile
4. Assign lead score based on criteria
5. Route to appropriate sales agent
6. Log intake to activity_log

### Routine: Enrollment Pipeline Check
1. Query all leads in pipeline (status != enrolled)
2. Calculate time-in-stage for each lead
3. Flag leads stuck >48 hours
4. Generate pipeline velocity report
5. Post stale lead alert to #jarvis-admin

### Routine: CRM Action Execution
1. Load customer profile from Base44
2. Determine required CRM action (call, email, SMS, billing_link)
3. Execute action via appropriate connector
4. Log result with audit trail
5. Update pipeline stage

### Routine: Credit Consultation
1. Pull credit report from Forth (with consent)
2. Analyze negative items
3. Calculate dispute eligibility score
4. Prepare consultation summary
5. Present enrollment options to customer

### Routine: Sales Communication Sequence
1. Define sequence: timing, channel, message template
2. Schedule via GHL
3. Monitor delivery and response rates
4. Escalate non-responsive leads
5. Report sequence performance

## Workflows
- **lead-to-enrollment**: Full lead → consultation → enrollment pipeline
- **pipeline-audit**: Stale lead detection and re-engagement
- **crm-batch**: Bulk CRM action execution

## Anti-Patterns
- Do NOT pull credit without documented consent
- Do NOT auto-enroll without consultation
- Do NOT skip audit trail for CRM actions
