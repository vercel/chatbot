# Base44 Connector Skill

> **Connector:** base44 | **Priority:** P0 | **Type:** Internal Data Platform
> **Dependencies:** Base44 MCP Bridge (b44_* tools)

## Purpose
Query and manage all internal data entities via the Base44 platform. This is the PRIMARY data backbone for NewLeaf Financial — customer profiles, payment logs, tickets, automations, reporting.

## When to Use
- Customer 360 lookups
- Entity CRUD operations (query, create, update)
- Aggregation and reporting queries
- Cross-system lookups (NMI + Slack + SMS + tickets)
- Payment log analysis
- Ticket management
- Action queue and findings emission
- Operational reporting hub

## Required Env Vars
- `BASE44_BRIDGE_URL` — Base44 API endpoint
- Internal token via `BASE44_DIAG_KEY`

## Cross-References
- Playbooks: billing, customer-support, disputes, engineering, reporting, planning
- Most playbooks depend on Base44 as primary data source
