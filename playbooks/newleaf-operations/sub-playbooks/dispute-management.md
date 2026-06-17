---
type: playbook
name: "Dispute Management"
description: "Credit dispute processing — rounds, negative items, credit reports, compliance"
version: "1.0.0"
updated: "2026-06-17"
domain: credit-disputes
priority: P0
scope: domain
scope_connectors: [forth-connector, base44-connector, slack-connector]
workflows: [dispute-pipeline]
triggers: [dispute, credit, negative, item, report, bureau, FCRA, round]
model_routing:
  default: "anthropic/claude-sonnet-4-6"
  reasoning_heavy: "anthropic/claude-opus-4-6"
access: internal
---

# Dispute Management

## Twenty CRM Objects
- **dispute_rounds:** Each round of dispute with bureau
- **negative_items:** Items being disputed
- **credit_reports:** Uploaded credit reports
- **dispute_tasks:** Agent action items

## Dispute Pipeline
1. **Intake:** Customer submits dispute via portal/call
2. **Credit Report:** Upload and parse via parse-fcra-credit-report
3. **Identification:** Identify negative items eligible for dispute
4. **Round 1:** Generate dispute letters, submit to bureaus
5. **Response:** Bureau responds (30-45 days)
6. **Result:** Item removed → celebrate | Item verified → Round 2
7. **Tracking:** Each round tracked in dispute_rounds

## Compliance
- **FCRA:** All disputes must follow Fair Credit Reporting Act
- **Documentation:** Every communication logged
- **Timeline:** 30-day response requirement tracked
- **Audit:** Monthly compliance audit via audit trail
