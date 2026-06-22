---
name: Credit Disputes Playbook
description: Credit report dispute processing, Metro2 compliance, Forth integration, and dispute round management.
domain: disputes
connectors: [forth, base44, nmi]
version: "1.0"
updated: 2026-06-22
---

# Credit Disputes Playbook

## Purpose
Process credit report disputes through Forth Credit API, manage dispute rounds, and ensure Metro2 compliance.

## Safeguards
- All dispute actions must be audit-trailed
- Metro2 format required for credit bureau submissions
- Dispute evidence must be preserved for 7 years
- Never modify dispute status without Forth API confirmation

## Routines

### Routine: Initiate Dispute
1. Pull credit report from Forth for customer
2. Identify disputed negative items
3. Verify item eligibility for dispute
4. Submit dispute via Forth API
5. Create dispute round in Base44
6. Notify customer of dispute initiation

### Routine: Check Dispute Status
1. Query active dispute rounds from Base44
2. Pull status from Forth for each round
3. Update dispute status in Base44
4. Flag completed/removed items
5. Generate status report for customer

### Routine: Dispute Evidence Collection
1. Compile evidence from Base44 (payment logs, communications)
2. Format per Metro2 requirements
3. Attach to Forth dispute round
4. Validate evidence completeness
5. Submit supplemental evidence

### Routine: Dispute Resolution Audit
1. Pull all resolved disputes (last 30 days)
2. Verify Forth status matches Base44
3. Check for Metro2 compliance
4. Generate audit report
5. Flag discrepancies for manual review

## Workflows
- **dispute-initiate**: Full dispute initiation with evidence gathering
- **dispute-audit**: Monthly dispute audit and compliance check
- **metro2-validation**: Validate Metro2 format compliance

## Anti-Patterns
- Do NOT submit disputes without customer consent
- Do NOT modify Metro2 formats manually
- Do NOT bypass Forth API for status updates
