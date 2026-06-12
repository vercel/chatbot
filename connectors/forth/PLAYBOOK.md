---
connector: forth
version: 0.2.0
scope: connector
auto_load: true
trigger_tools:
  - forth:getDisputes
  - forth:updateDispute
  - forth:queryContact
  - forth:pullCreditReport
  - forth:listEnrollments
headline: |
  Forth DPP credit repair. SSN only last 4 digits. Credit reports encrypted at rest.
  FCRA compliance required — never pull without signed authorization.
---

# Forth (DPP/Credit) Connector Playbook

## Operational Knowledge

### Architecture
Forth tools proxy through the Base44 bridge (`BASE44_API/api/forthBridge`) using a `callForthBridge(action, payload)` pattern. Forth DPP (Dispute Process Platform) handles credit report disputes and credit monitoring enrollments.

### Auth
- Bridge auth via internal service token (Base44)
- No separate API keys in Neptune Chat
- PII-sensitive operations require elevated access logging

### Tools
- `getDisputes` — Active disputes by customer and status
- `updateDispute` — Update dispute status or add evidence
- `queryContact` — Look up contact/credit report info by SSN, name, DOB
- `pullCreditReport` — Pull credit report (triple bureau or single)
- `listEnrollments` — List DPP enrollments by status

### PII Handling
- SSN: only last 4 digits stored/queried
- DOB: stored as YYYY-MM-DD, never displayed in full in logs
- Credit reports: encrypted at rest, accessed only with audit trail

## Business Context

### Why Forth
Credit repair and monitoring is NewLeaf's core service. Forth DPP manages the entire credit dispute lifecycle:
1. Customer enrollment in credit repair program
2. Credit report pulls from Equifax, Experian, TransUnion
3. Dispute filing and tracking
4. Resolution monitoring and customer notification

### Business Rules
- Credit report pulls require signed authorization (stored in Base44)
- Disputes must be filed within 30 days of report pull
- Triple bureau pulls count as 3 separate pulls (Fair Credit Reporting Act compliance)
- Dispute resolution windows: 30-45 days by law

## Anti-Patterns

### ❌ NEVER:
1. Pull credit reports without verified customer authorization
2. Query by full SSN — only last 4 digits
3. File disputes without reviewing report first
4. Share credit report data outside of authorized personnel
5. Auto-resolve disputes without human review of evidence
6. Log full DOB or SSN in application logs

### ⚠️ DANGEROUS:
- Bulk credit report pulls (can trigger fraud alerts)
- Filing disputes on inaccurate data without verification
- Modifying dispute statuses without proper documentation

## Safeguards

### PII Protection
- SSN: mask all but last 4 digits in logs and responses
- Credit reports: never included in chat output (use summary only)
- Access logging: all credit report pulls logged with user, timestamp, and purpose

### Error Handling
- Authorization missing → verify customer has signed agreement on file
- Report unavailable → retry after 24h (bureau processing delays)
- Dispute stale → check filing deadline (30 days from report pull)
- Contact not found → verify SSN/DOB/name combination

## Common Workflows

### Check Customer's Active Disputes
```
getDisputes({ customerId: "cust_xyz", status: "active" })
→ returns array of active disputes with status and deadlines
```

### Pull Credit Report
```
pullCreditReport({ customerId: "cust_xyz", reportType: "triple_bureau" })
→ returns report data (encrypted, summary only in response)
```

### Update Dispute Status
```
updateDispute({
  disputeId: "disp_abc",
  status: "in_review",
  evidence: "Bureau responded requesting additional documentation..."
})
```

### List Active Enrollments
```
listEnrollments({ status: "active", limit: 20 })
→ returns customers currently enrolled in credit repair
```

## Refinement Notes

- **Version:** 1.0.0
- **Created:** 2026-06-09
- **Last Reviewed:** 2026-06-09
- **Source:** Base44 Forth Bridge, FCRA compliance documentation
- **Related:** Base44 Two-Lane Workflow PRD (credit repair pipeline)
