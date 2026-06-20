---
name: vapi-skills
version: 1.0.0
connector: vapi
scope: neptune-custom
total_actions: 3
priority: P1
intent_tags:
  - vapi
  - voice
  - calls
  - transcripts
  - analytics
associated_connectors:
  - base44
  - slack
headline: |
  3 Vapi actions: call logs, transcripts, and agent analytics.
  Voice AI operations for NewLeaf support and outreach.
type: "skill"
access: internal
---

# Vapi Voice AI Skills — 3 Actions

## Core Intent
Complete Vapi Voice AI operations: search call logs by filters, retrieve full call transcripts, and get outcome analytics. The Vapi connector powers NewLeaf's voice AI calling infrastructure.

## Action Catalog

### Call Intelligence (3 actions)
| # | Action | Description |
|---|--------|-------------|
| 1 | `call.query` | Search Vapi call logs by filters (date, status, agent) |
| 2 | `call.transcript` | Retrieve a full call transcript |
| 3 | `call.analytics` | Get call outcome analytics and metrics |

## Anti-Patterns
- NEVER expose full call transcripts without redaction of PII
- NEVER share call recording URLs publicly
- ALWAYS verify call outcome before using in customer profiles
