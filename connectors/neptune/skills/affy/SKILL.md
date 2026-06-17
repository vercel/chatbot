---
name: affy-skills
version: 1.0.0
connector: affy
scope: neptune-custom
total_actions: 15
priority: P0
intent_tags:
  - affy
  - chargeback
  - dispute
  - affidavit
  - evidence
associated_connectors:
  - base44
  - forth
  - nmi
  - slack
headline: |
  15 Affy chargeback actions: disputes, evidence, affidavits, tracking,
  deadlines, and resolution. Fight chargebacks with documented evidence.
type: "skill"
access: internal
---

# Affy Chargeback Skills — 15 Actions

## Core Intent
Complete chargeback dispute management: monitor open chargebacks, generate defense affidavits, submit evidence packages, track resolutions, and analyze dispute trends. All actions proxy through the Base44 Affy bridge.

## Action Catalog

### Chargeback Monitoring (3 actions)
| # | Action | Description |
|---|--------|-------------|
| 1 | `chargeback.list` | List chargebacks by status, customer, date range |
| 2 | `chargeback.get` | Get chargeback details with reason code and deadline |
| 3 | `chargeback.alert` | Alert on approaching evidence submission deadlines |

### Evidence Management (4 actions)
| 4 | `evidence.prepare` | Prepare evidence package from transaction data |
| 5 | `evidence.submit` | Submit defense evidence for a chargeback |
| 6 | `evidence.status` | Check evidence submission status |
| 7 | `evidence.requirements` | Get required evidence checklist by reason code |

### Affidavit Generation (3 actions)
| 8 | `affidavit.generate` | Auto-generate defense affidavit from transaction |
| 9 | `affidavit.review` | Mark affidavit as reviewed (required before submission) |
| 10 | `affidavit.template` | Get affidavit template for a specific reason code |

### Dispute Tracking (3 actions)
| 11 | `dispute.track` | Track dispute through resolution lifecycle |
| 12 | `dispute.outcome` | Record final outcome (won/lost/partial) |
| 13 | `dispute.timeline` | Get complete dispute timeline with all events |

### Analytics & Trends (2 actions)
| 14 | `analytics.by_reason` | Chargeback breakdown by reason code |
| 15 | `analytics.win_rate` | Win rate analysis by reason code and time period |

## Operational Context
- All calls proxy through Base44 Affy bridge (`callAffyBridge(action, payload)`)
- Affidavits require: transaction ID, Day 0 CIT proof, service description, delivery evidence
- Evidence deadlines: 7-21 days depending on card network
- Won disputes: funds returned; Lost: $15-25 chargeback fee
- NEVER auto-approve chargeback responses — always human review
- NEVER miss submission deadlines

## Anti-Patterns
- NEVER submit evidence without verifying all required fields
- NEVER generate affidavits for transactions < 60 days old
- NEVER auto-approve chargeback responses (always human review)
- NEVER include raw card numbers in evidence packages
- NEVER miss submission deadlines (set 48h and 24h reminders)

## Workflow Examples

### Fight a Chargeback
```
1. chargeback.get({ chargebackId }) → understand reason and deadline
2. evidence.requirements({ reasonCode }) → know what's needed
3. affidavit.generate({ transactionId, customerId, reason }) → build defense
4. affidavit.review({ affidavitId }) → human approval gate
5. evidence.submit({ chargebackId, evidence }) → submit defense
6. dispute.track({ chargebackId }) → monitor outcome
```

### Chargeback Health Dashboard
```
1. chargeback.list({ status: "open" }) → all active disputes
2. chargeback.alert() → approaching deadlines
3. analytics.by_reason({ dateRange: "last_90_days" }) → trend analysis
4. analytics.win_rate() → defense effectiveness
```

### Urgent: Deadline in 24 Hours
```
1. chargeback.alert() → find chargebacks due within 24h
2. evidence.prepare({ chargebackId }) → auto-assemble evidence
3. affidavit.generate({ transactionId, customerId }) → generate affidavit
4. review → human approval
5. evidence.submit({ chargebackId, evidence }) → file before deadline
```
