---
type: "playbook"
name: "Patterns"
description: "Auto-generated description for Patterns"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# Base44 Patterns — Always-Check Rules

## Pre-Flight (ALWAYS)
- [ ] Entity type confirmed against schema_list_entities
- [ ] Filter uses correct field names (schema_describe)
- [ ] Large queries use b44_count first (NOT query + count in memory)
- [ ] Customer lookups use b44_customer_360 (NOT individual entity reads)
- [ ] Cross-system lookups use cross_system_lookup for full picture
- [ ] Actions emitted via emit_action / emit_finding for Canvas v5

## Pattern: Customer Research
1. Use cross_system_lookup (customer_id, email, or phone)
2. Surface: profile, NMI transactions, Slack messages, tickets, recovery items
3. Emit findings to Canvas v5
4. Log actions to action queue

## Pattern: Entity Query Safety
1. Check schema_describe for correct field names
2. Count first (b44_count) if dataset could be large
3. Query with appropriate limit
4. Use b44_aggregate for counts-by-group

## Pattern: Action Queue
1. emit_action for every actionable next step
2. Priority 1-5, customer, action_type, deadline
3. emit_finding for every issue discovered
4. Category, severity, entity, evidence included
