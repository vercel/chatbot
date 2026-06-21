---
name: "manage-workflows"
description: "Create, configure, and manage Twenty workflow automations for NewLeaf CRM operations"
version: "1.0.0"
domain: "twenty-crm"
repo_refs:
  - "/home/hermes/repos/twenty/packages/twenty-server/src/engine/core-modules/workflow/"
  - "/home/hermes/cortex/research/twenty/features/workflows-engine.md"
api_refs:
  - "Workflow triggers: record events, schedule, manual, webhook"
  - "Workflow actions: create/update/delete record, search, upsert, iterator, filter, delay, email, code, HTTP request, form"
---

# Manage Workflows Skill

## Overview
Create visual workflow automations in Twenty. Workflows automate CRM operations — lead routing, payment tracking, SLA alerts, dispute processing.

## Trigger Types
| Trigger | Config | Example |
|---------|--------|---------|
| Record events | Object + operation (created/updated/deleted) | `person.created` |
| Schedule | Cron pattern or relative | Daily at 9am, every Monday |
| Manual | Button trigger | "Run follow-up sequence" |
| Webhook | Incoming HTTP call | Typeform submission → lead |

## Action Types
| Action | Input | Output |
|--------|-------|--------|
| Create Record | Object type + field data | Created record |
| Update Record | Record ID + field changes | Updated record |
| Delete Record | Record ID | Deleted record |
| Search Records | Object + filters | Matching records |
| Upsert Record | Data + match criteria | Created/updated record |
| Iterator | Array from previous step | Loops through items |
| Filter | Condition (field = value) | Pass or block |
| Delay | Duration (minutes/hours) or date | Continues after delay |
| Send Email | From user's mailbox | Sends email |
| Code | JavaScript snippet | Code result |
| HTTP Request | URL + method + headers + body | API response |
| Form | Field definitions | User input |

## Worked Example: Payment Succeeded Automation
```
Trigger: Record events → paymentRecord.created

Step 1: Search Records
  Object: Subscription
  Filter: nmiVaultId = paymentRecord.person.nmiVaultId

Step 2: Update Record
  Object: Subscription  
  Set: completedPayments = subscription.completedPayments + 1
       billingHealth = "healthy"

Step 3: Filter
  Condition: subscription.completedPayments >= 3
  (First 3 payments completed → advance pipeline)

Step 4: Update Record
  Object: enrollment (linked to person)
  Set: stage = "ACTIVE_SERVICE"
```

## Worked Example: SLA Breach Alert
```
Trigger: Schedule → Every weekday at 9am

Step 1: Search Records
  Object: enrollment
  Filter: stageEnteredAt < (now - stageSlaHours)

Step 2: Iterator
  Array: Search results

Step 3: Create Record
  Object: task
  Data: title = "SLA breach: {enrollment.person.firstName}"
        assignedTo = enrollment.enrolledBy

Step 4: HTTP Request
  URL: https://slack.com/api/chat.postMessage
  Method: POST
  Body: { channel: "C0AQDDC3HAB", text: "SLA breach alert..." }
```

## Best Practices
1. **Rename steps** descriptively for maintainability
2. **Leverage previous step data** — any output available downstream
3. **Start simple** — add complexity incrementally
4. **Use Iterator + Filter** for bulk processing
5. **Test before activating** — use the Test button

## Error Handling
| Issue | Check | Fix |
|-------|-------|-----|
| Workflow doesn't fire | Trigger configured? Activated? | Check trigger settings, toggle Active |
| Step fails | Check run logs | Review step input/output in run history |
| Iterator hangs | Array size | Add limit or filter before iterator |
| HTTP Request fails | URL reachable? Auth valid? | Test endpoint separately |
| Code action errors | JavaScript syntax | Check code in browser console first |
