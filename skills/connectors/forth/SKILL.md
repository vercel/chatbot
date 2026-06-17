---
name: forth-connector
version: 1.0.0
kind: connector
primary_domain: credit-disputes
also_in: [customer-enrollment]
tools: [getDisputes, updateDispute, queryContact, pullCreditReport, listEnrollments]
dependencies: [base44-connector]
headline: |
  Forth DPP credit repair. SSN only last 4 digits. Credit reports encrypted at rest.
  FCRA compliance required — never pull without signed authorization.
type: "skill"
---

# Forth Connector Skill

## Operational Knowledge
Forth DPP (Dispute Processing Platform) for credit repair operations.

## Tools
| Tool | Description |
|------|-------------|
| getDisputes | List active disputes |
| updateDispute | Update dispute status |
| queryContact | Look up contact by ID |
| pullCreditReport | Pull credit report (FCRA) |
| listEnrollments | List customer enrollments |

## Anti-Patterns
- NEVER store full SSN — last 4 only
- NEVER pull credit without signed authorization
- NEVER share credit report data outside authorized context

## Safeguards
- FCRA compliance: verify signed authorization exists before pull
- SSN: redact to last 4 digits in all outputs
- Credit reports encrypted at rest
