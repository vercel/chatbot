---
name: forth-skills
version: 1.0.0
connector: forth
scope: neptune-custom
total_actions: 30
priority: P0
intent_tags:
  - forth
  - credit
  - dispute
  - fcra
  - credit-report
  - bureau
associated_connectors:
  - base44
  - affy
  - slack
headline: |
  30 Forth DPP actions: credit reports, disputes, enrollments, contacts,
  bureau letters, evidence, resolutions, and FCRA compliance. Full credit repair.
type: "skill"
access: internal
---

# Forth DPP Skills — 30 Actions

## Core Intent
Complete credit repair lifecycle via Forth DPP: pull credit reports, manage disputes, track enrollments, generate bureau letters, submit evidence, and maintain FCRA compliance. All actions proxy through the Base44 Forth bridge. PII-sensitive.

## Action Catalog

### Credit Report Operations (6 actions)
| # | Action | Description |
|---|--------|-------------|
| 1 | `report.pull_single` | Pull single bureau credit report |
| 2 | `report.pull_triple` | Pull triple bureau report (counts as 3 per FCRA) |
| 3 | `report.get` | Get previously pulled report by ID |
| 4 | `report.summary` | Get report summary with score and negative items |
| 5 | `report.compare` | Compare two reports for changes over time |
| 6 | `report.negative_items` | Extract all negative items from a report |

### Contact & Identity (4 actions)
| 7 | `contact.query` | Look up contact by SSN last 4, name, DOB |
| 8 | `contact.verify` | Verify customer identity for credit operations |
| 9 | `contact.authorization` | Check if signed credit pull authorization exists |
| 10 | `contact.history` | Get full contact interaction history |

### Enrollment Management (5 actions)
| 11 | `enrollment.list` | List DPP enrollments by status and date |
| 12 | `enrollment.create` | Create a new credit repair enrollment |
| 13 | `enrollment.status` | Get detailed enrollment status with progress |
| 14 | `enrollment.pause` | Pause enrollment (customer request) |
| 15 | `enrollment.resume` | Resume a paused enrollment |

### Dispute Management (8 actions)
| 16 | `dispute.list` | List disputes by customer, status, bureau |
| 17 | `dispute.create` | Create a new dispute for a negative item |
| 18 | `dispute.get` | Get dispute details with timeline |
| 19 | `dispute.update` | Update dispute status or add notes |
| 20 | `dispute.evidence.add` | Add supporting evidence to a dispute |
| 21 | `dispute.evidence.list` | List all evidence for a dispute |
| 22 | `dispute.letter.generate` | Generate FCRA-compliant dispute letter |
| 23 | `dispute.letter.send` | Send dispute letter to bureau |

### Resolution & Tracking (4 actions)
| 24 | `resolution.track` | Track dispute through resolution |
| 25 | `resolution.outcome` | Record dispute outcome (deleted, verified, updated) |
| 26 | `resolution.notify` | Notify customer of dispute outcome |
| 27 | `resolution.reinvestigate` | Request reinvestigation (Round 2) |

### Compliance & Audit (3 actions)
| 28 | `compliance.check` | Check FCRA compliance for all active disputes |
| 29 | `compliance.deadline` | Check approaching statutory deadlines |
| 30 | `compliance.audit_log` | Get full audit trail for a customer |

## Operational Context
- All calls proxy through Base44 Forth bridge (`callForthBridge(action, payload)`)
- SSN: only last 4 digits stored/queried (PII protection)
- Credit reports encrypted at rest
- FCRA deadlines: 30 days for bureau disputes, 45 for free annual report
- Authorization required before any credit pull

## Anti-Patterns
- NEVER pull credit without verified authorization
- NEVER query by full SSN — only last 4 digits
- NEVER file disputes without reviewing report first
- NEVER share credit report data outside authorized personnel
- NEVER auto-resolve disputes without human review
- NEVER log full DOB or SSN in application logs

## Workflow Examples

### Full Dispute Round
```
1. report.pull_triple({ customerId }) → get all three bureaus
2. report.negative_items({ reportId }) → identify disputable items
3. dispute.create({ customerId, negativeItemId, bureau, reason })
4. dispute.letter.generate({ disputeId }) → FCRA-compliant letter
5. dispute.letter.send({ disputeId, bureau })
6. resolution.track({ disputeId }) → monitor 30-day window
```

### Enrollment Health Check
```
1. enrollment.list({ status: "active" })
2. enrollment.status({ enrollmentId }) → check progress
3. compliance.check({ customerId }) → verify FCRA compliance
4. compliance.deadline({ customerId }) → identify approaching deadlines
```
