---
name: ghl-connector
version: 1.0.0
kind: connector
primary_domain: customer-comms
also_in: [lead-flow, customer-enrollment]
tools: [createContact, sendSms, sendEmail, queryConversations, getOpportunity]
dependencies: [base44-connector]
headline: |
  GoHighLevel CRM via Base44 bridge. SMS requires opt-in + 9am-9pm window. TCPA + CAN-SPAM compliant.
type: "skill"
---

# GHL Connector Skill

## Operational Knowledge
GoHighLevel CRM accessed through Base44 bridge. GHL API key lives in Base44 — never in Neptune env vars.

## Tools
| Tool | Description |
|------|-------------|
| createContact | Create/update contact |
| sendSms | Send SMS (TCPA compliant) |
| sendEmail | Send email (CAN-SPAM) |
| queryConversations | Fetch conversation history |
| getOpportunity | Get pipeline opportunity |

## Anti-Patterns
- NEVER hardcode GHL API key in Neptune
- NEVER send SMS outside 9am-9pm window
- NEVER SMS without verified opt-in

## Safeguards
- SMS: verify opt-in status before send
- SMS: check time window (9am-9pm local)
- Email: include unsubscribe link
