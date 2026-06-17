---
type: "playbook"
name: "Custom Knowledge"
description: "Auto-generated description for Custom Knowledge"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# Customer Support — Custom Business Knowledge (NewLeaf Financial)

> **Domain:** support-triage | **Priority:** P0 | **Playbook:** playbook-support.md
> **Last Updated:** 2026-06-16 | **Phase:** 24

---

## Ticket Triage Rules (SLA-Backed)

### Priority Matrix
| Priority | Trigger | Response Time | Resolution Target | Escalation |
|----------|---------|---------------|-------------------|------------|
| **P0 (Critical)** | Payment failure, account access lost, legal threat, chargeback risk, data breach | < 1 hour | < 4 hours | Immediate: Slack #jarvis-admin + manager DM |
| **P1 (High)** | Billing question, dispute status inquiry, enrollment issue, card update failure | < 4 hours | < 24 hours | Escalate if no response in 2 hours |
| **P2 (Medium)** | General question, document request, profile update, password reset | < 24 hours | < 72 hours | Standard queue |
| **P3 (Low)** | Feature request, feedback, testimonial, general inquiry | < 48 hours | < 1 week | Backlog |

### Auto-Escalation Triggers
- P0 ticket open > 30 minutes without response → manager DM
- P1 ticket open > 2 hours → channel alert
- Any ticket with keyword "lawsuit", "attorney", "sue", "legal action" → P0 + legal team notify
- Any ticket with keyword "chargeback", "unauthorized", "didn't authorize" → P0 + disputes handoff
- Customer contact attempts > 3 in 24 hours → priority bump + merge duplicates

---

## Customer 360 Patterns

### Mandatory Pre-Response Checklist
Before responding to ANY customer inquiry, ALWAYS:

```
[ ] Pull full customer 360 via cross_system_lookup (customer_id OR email OR phone)
[ ] Check: profile (name, status, enrollment)
[ ] Check: payments (recent transactions, active subscriptions, payment method health)
[ ] Check: tickets (open/closed, recent activity, assigned agent)
[ ] Check: communications (last Slack message, last SMS, last email)
[ ] Check: credit reports (active disputes, negative items, bureau status)
[ ] Check: automations (active sequences, upcoming scheduled actions)
[ ] Identify: active subscriptions, recent payments, open disputes, pending actions
[ ] NEVER answer without full context — incomplete context = incorrect response
```

### 360 Data Sources
| Source | Entity/Tool | What It Provides |
|--------|------------|------------------|
| Base44 | CustomerProfile | Name, email, phone, status, enrollment date |
| Base44 | PaymentLog | Transaction history, amounts, statuses |
| NMI | customer_vault_query | Active payment methods, vault health |
| Base44 | SupportTicket | Open/closed tickets, assigned agent, history |
| Base44 | DisputeRounds | Active disputes, round number, bureau status |
| Slack | slack_messages_v2 | Recent communications, sentiment |
| VAPI | CallLog | Call history, transcripts, outcomes |
| Base44 | NegativeItem | Credit report items under dispute |
| GHL | Contact | CRM status, pipeline stage, sequences |

---

## Common Support Flows

### Flow 1: "Where's my refund?"
```
Step 1: Pull customer 360
Step 2: Query payment_logs WHERE type='refund' AND customer_id=X
Step 3: Check NMI transaction status (nmi_mcp_bridge action: transaction_query)
Step 4: Compile response: date + amount + status + expected settlement date
Step 5: If not found → check original charge (may not have been refunded yet)
Step 6: If pending > 5 days → escalate to billing team
```

### Flow 2: "Dispute status?"
```
Step 1: Pull customer 360
Step 2: Query dispute_rounds WHERE customer_id=X
Step 3: Check credit_reports for bureau response status
Step 4: Provide: round number + bureau + date filed + status + next step
Step 5: If overdue (> 30 days since filed) → escalate with FCRA clock warning
Step 6: NEVER promise specific outcomes ("this will be removed")
```

### Flow 3: "Cancel my account"
```
Step 1: Verify identity (name + email + last 4 of phone OR security question)
Step 2: Pull customer 360 → check active subscriptions
Step 3: List what will be cancelled (subscriptions, sequences, automations)
Step 4: Confirm cancellation intent (required: explicit confirmation)
Step 5: Cancel in NMI (subscription_cancel for each active sub)
Step 6: Update Base44 profile (status = cancelled)
Step 7: Pause GHL sequences (do not delete — 90-day retention)
Step 8: Confirm cancellation to customer with effective date + final statement date
```

### Flow 4: "Update my card"
```
Step 1: Verify identity
Step 2: Send secure billing link (NMI Collect.js hosted form)
Step 3: Wait for customer to submit new card (secure — agent never sees raw PAN)
Step 4: Verify vault update ($1 auth via NMI validate)
Step 5: Confirm to customer: "Card ending in XXXX updated successfully"
Step 6: Check if any failed payments need retry with new card
```

### Flow 5: "I was charged incorrectly"
```
Step 1: Pull customer 360 → recent payments
Step 2: Verify amount vs agreement in Base44 agreements entity
Step 3: If duplicate → void (same day) or refund (past settlement)
Step 4: If wrong amount → refund difference + explain discrepancy
Step 5: If unrecognized → full investigation (check NMI logs, Hyperswitch routing)
Step 6: Post resolution to #jarvis-admin for audit trail
```

---

## Communication Channels

| Channel | Tool | Use Case | Response Expectation |
|---------|------|----------|---------------------|
| Slack | #jarvis-admin (internal) | Agent-to-agent escalations, status updates | Real-time |
| Slack | slack_mcp_bridge | Customer-facing messages (when customer is in Slack) | < 1 hour for P0 |
| Email | GHL automation | Async communications, documents, formal responses | < 24 hours |
| SMS | Twilio via Base44 | Urgent notifications, payment reminders | < 2 hours |
| Voice | VAPI (Haley) | Automated call handling, payment collection | Immediate |
| Ticket | SupportTicket (Base44) | Structured issue tracking | Per SLA |

---

## Anti-Patterns (NEVER DO)

| # | Anti-Pattern | Why Wrong | Fix |
|---|-------------|----------|-----|
| 1 | Responding without full 360 context | Incomplete context = incorrect response | Always pull 360 first |
| 2 | Discussing another customer's data | Privacy violation, legal liability | Verify identity before discussing any data |
| 3 | Promising specific credit score improvements | Impossible to guarantee, deceptive practice | Explain dispute process, never promise outcomes |
| 4 | Guaranteeing dispute outcomes | FCRA violations, false promises | Explain process + timeline, not outcomes |
| 5 | Sharing raw credit report data without redaction | Privacy violation, data exposure | Redact sensitive fields before sharing |
| 6 | Communicating outside approved channels | No audit trail, compliance risk | Slack, Email, SMS, VAPI only |
| 7 | Creating duplicate tickets | Fragmented context, wasted effort | Always search for existing tickets first |
| 8 | Closing tickets without customer confirmation | Unresolved issues, customer frustration | Get explicit confirmation before closing |
| 9 | Making billing changes without identity verification | Fraud risk | Always verify identity before billing actions |
| 10 | Ignoring sentiment signals (angry, frustrated, legal threat) | Escalation missed, brand damage | Auto-escalate on sentiment keywords |

---

## Sentiment Escalation Triggers

| Keyword | Sentiment | Action |
|---------|-----------|--------|
| "lawsuit", "attorney", "sue" | Legal threat | Immediate P0 + legal notify |
| "chargeback", "unauthorized" | Dispute risk | P0 + disputes handoff |
| "angry", "frustrated", "unacceptable" | High negative | P1 + empathy response |
| "manager", "supervisor" | Escalation request | Warm transfer to human |
| "BBB", "CFPB", "AG", "complaint" | Regulatory threat | P0 + compliance notify |

---

*End of customer-support/custom-knowledge.md — Phase 24 Stream 1*
