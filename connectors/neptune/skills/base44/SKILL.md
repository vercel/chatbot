---
name: base44-skills
version: 1.0.0
connector: base44
scope: neptune-custom
total_actions: 6
priority: P0
intent_tags:
  - base44
  - crm
  - entities
  - customer
  - reporting
associated_connectors:
  - nmi
  - slack
  - vapi
  - hyperswitch
headline: |
  6 Base44 actions: entity queries, customer 360, reporting hub, and function
  invocation. Full CRM data access for NewLeaf operations.
type: "skill"
access: internal
---

# Base44 CRM Skills — 6 Actions

## Core Intent
Complete Base44 CRM data access: query entities with MongoDB-style filters, create and update records, get full customer dossiers, run operational reports, and invoke backend functions. All actions go through the Base44 API bridge.

## Action Catalog

### Entity Operations (4 actions)
| # | Action | Description |
|---|--------|-------------|
| 1 | `entity.query` | Query any Base44 entity with MongoDB-style filter |
| 2 | `entity.create` | Create a new Base44 entity record |
| 3 | `entity.get` | Get a single entity record by ID |
| 4 | `entity.update` | Patch an existing entity record |

### Customer Intelligence (1 action)
| 5 | `customer.360` | Full customer dossier across all systems |

### Reporting & Functions (1 action)
| 6 | `reporting.hub` | Operational reporting aggregator |

## Anti-Patterns
- NEVER call hostingerBridge from VPS — use native Bash/Read/Write
- NEVER expose internal tokens in responses
- ALWAYS validate entity exists before updating
