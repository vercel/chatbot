---
name: ghl-skills
version: 1.0.0
connector: ghl
scope: neptune-custom
total_actions: 35
priority: P1
intent_tags:
  - ghl
  - gohighlevel
  - crm
  - marketing
  - sms
  - email
associated_connectors:
  - base44
  - slack
  - vapi
headline: |
  35 GoHighLevel actions: contacts, SMS, email, campaigns, pipelines,
  opportunities, automations, calendars, and analytics. Full CRM management.
type: "skill"
---

# GoHighLevel Skills — 35 Actions

## Core Intent
Complete GoHighLevel CRM management: contacts, communications, pipeline tracking, campaign automation, calendar scheduling, and analytics. All actions proxy through the Base44 GHL bridge.

## Action Catalog

### Contact Management (6 actions)
| # | Action | Description |
|---|--------|-------------|
| 1 | `contact.create` | Create or update a contact by email/phone |
| 2 | `contact.get` | Get contact details by ID, email, or phone |
| 3 | `contact.search` | Search contacts by name, email, phone, tags |
| 4 | `contact.update` | Update contact fields, tags, custom fields |
| 5 | `contact.delete` | Delete a contact (soft-delete with confirmation) |
| 6 | `contact.merge` | Merge duplicate contacts by email or phone |

### SMS Communications (5 actions)
| 7 | `sms.send` | Send SMS to contact (max 1600 chars, requires opt-in) |
| 8 | `sms.send_bulk` | Send SMS to multiple contacts with template |
| 9 | `sms.template.create` | Create a reusable SMS template |
| 10 | `sms.template.list` | List all SMS templates |
| 11 | `sms.opt_status` | Check opt-in/opt-out status for a phone number |

### Email Communications (5 actions)
| 12 | `email.send` | Send email to contact (HTML or plain text) |
| 13 | `email.send_bulk` | Send email campaign to contact list |
| 14 | `email.template.create` | Create a reusable email template |
| 15 | `email.template.list` | List all email templates |
| 16 | `email.unsub_status` | Check unsubscribe status for an email |

### Pipeline & Opportunity Management (6 actions)
| 17 | `pipeline.list` | List all pipelines with stages |
| 18 | `pipeline.create` | Create a new pipeline with custom stages |
| 19 | `opportunity.create` | Create a new opportunity in a pipeline |
| 20 | `opportunity.get` | Get opportunity details with stage history |
| 21 | `opportunity.update` | Update opportunity stage, value, or status |
| 22 | `opportunity.search` | Search opportunities by contact, stage, value |

### Campaign & Automation (5 actions)
| 23 | `campaign.create` | Create a new campaign with trigger rules |
| 24 | `campaign.list` | List all active campaigns |
| 25 | `campaign.status` | Get campaign performance metrics |
| 26 | `workflow.create` | Create an automation workflow |
| 27 | `workflow.trigger` | Manually trigger a workflow for a contact |

### Calendar & Appointments (4 actions)
| 28 | `calendar.list` | List available calendars and time slots |
| 29 | `appointment.create` | Book an appointment for a contact |
| 30 | `appointment.reschedule` | Reschedule an existing appointment |
| 31 | `appointment.cancel` | Cancel an appointment with notification |

### Analytics & Reporting (4 actions)
| 32 | `analytics.pipeline` | Pipeline performance report |
| 33 | `analytics.campaign` | Campaign effectiveness report |
| 34 | `analytics.sms` | SMS delivery and response rates |
| 35 | `analytics.lead_source` | Lead source attribution report |

## Operational Context
- All calls proxy through Base44 bridge (`callBridge("action", payload)`)
- SMS requires opt-in + 9am-9pm local time window
- Email requires unsubscribe link (CAN-SPAM)
- Rate limit: 100 requests per 10 seconds per location
- TCPA + CAN-SPAM compliance mandatory

## Anti-Patterns
- NEVER send SMS without opt-in verification
- NEVER create duplicate contacts without checking first
- NEVER send email without unsubscribe link
- NEVER query conversations without date bounds
- NEVER hardcode GHL API key in Neptune Chat

## Workflow Examples

### Customer Onboarding Sequence
```
1. contact.create({ firstName, lastName, email, phone, tags: ["lead"] })
2. sms.send({ contactId, message: "Welcome to NewLeaf!..." })
3. opportunity.create({ contactId, pipelineId, name: "New Enrollment" })
4. workflow.trigger({ contactId, workflowId: "onboarding-sequence" })
```

### Billing Follow-up
```
1. contact.search({ email: "customer@example.com" })
2. opportunity.search({ contactId, stage: "payment_pending" })
3. sms.send({ contactId, message: "Your payment link is ready: ..." })
```

### Campaign Performance Review
```
1. campaign.list()
2. analytics.campaign({ campaignId, dateRange: "last_30_days" })
3. analytics.lead_source({ campaignId })
```
