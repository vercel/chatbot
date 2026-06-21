# Twenty CRM — Workflows

## Overview
Twenty's visual workflow engine automates CRM operations without code. Workflows consist of triggers (what starts them) and actions (what they do), connected in a visual builder.

## Trigger Types
| Trigger | Config | Use Case |
|---------|--------|----------|
| **Record Events** | Object + operation (created/updated/deleted) | `paymentRecord.created` → update subscription |
| **Schedule** | Cron pattern or relative time | Daily SLA check at 9am, every Monday |
| **Manual** | Button trigger | "Run follow-up sequence" from record page |
| **Webhook** | Incoming HTTP call | Typeform submission → create lead |

## Action Types
| Action | Description | Example |
|--------|-------------|---------|
| **Create Record** | Create any object record | Create a task on SLA breach |
| **Update Record** | Modify existing record | Mark subscription as healthy |
| **Delete Record** | Remove a record | Clean up test data |
| **Search Records** | Find records by filter | Find all subscriptions for a person |
| **Upsert Record** | Create or update based on match | Sync contact from webhook |
| **Iterator** | Loop through array | Process each overdue enrollment |
| **Filter** | Conditional branch | Only if payments >= 3 |
| **Delay** | Pause execution | Wait 24h before follow-up |
| **Send Email** | From user's mailbox | "Welcome to NewLeaf" |
| **Code** | JavaScript snippet | Custom transformation logic |
| **HTTP Request** | External API call | Post to Slack, call n8n |
| **Form** | Collect user input | Approval form for dispute escalation |

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
  (First 3 payments done → advance to active service)

Step 4: Update Record
  Object: Enrollment (linked to person)
  Set: stage = "ACTIVE_SERVICE"
       stageEnteredAt = now()
```

## Worked Example: SLA Breach Alert
```
Trigger: Schedule → Every weekday at 9am

Step 1: Search Records
  Object: Enrollment
  Filter: stageEnteredAt < (now - stageSlaHours)
         AND stage != "ACTIVE_SERVICE"

Step 2: Iterator
  Array: Search results from Step 1

Step 3: Create Record
  Object: Task
  Data:
    title = "SLA breach: {enrollment.person.firstName} {enrollment.person.lastName}"
    assignedTo = enrollment.enrolledBy
    priority = "high"

Step 4: HTTP Request
  URL: https://slack.com/api/chat.postMessage
  Method: POST
  Headers: Authorization: Bearer {SLACK_BOT_TOKEN}
  Body: {
    channel: "C0AQDDC3HAB",
    text: "⚠️ SLA breach: {enrollment.person.firstName} stuck in {enrollment.stage} for {slaOverdueHours}h"
  }
```

## Worked Example: Dispute Round Progression
```
Trigger: Record events → creditDispute.updated (status = "responded")

Step 1: Filter
  Condition: creditDispute.responseReceived = true
            AND creditDispute.resolution = "items_removed"

Step 2: Update Record
  Object: Enrollment (linked to person)
  Set: stage = "DISPUTE_PREP"

Step 3: Create Record
  Object: CreditDispute
  Data:
    bureau = creditDispute.bureau
    roundNumber = creditDispute.roundNumber + 1
    status = "pending"
    person = creditDispute.person

Step 4: HTTP Request
  URL: https://hooks.newleaf.financial/notify
  Method: POST
  Body: {
    event: "dispute.round_completed",
    personId: creditDispute.personId,
    bureau: creditDispute.bureau,
    round: creditDispute.roundNumber
  }
```

## Best Practices
1. **Rename steps** descriptively — "Find subscription" not "Step 1"
2. **Leverage previous step data** — any output available downstream via `{stepName.field}`
3. **Start simple** — add complexity incrementally, test after each step
4. **Use Iterator + Filter** for bulk processing with conditions
5. **Test before activating** — use the Test button to dry-run
6. **Set timeouts** on HTTP requests — default may be too long
7. **Handle errors** — add error branches for external API calls

## Common Workflow Patterns for NewLeaf
| Pattern | Trigger | Actions | Purpose |
|---------|---------|---------|---------|
| Payment received | paymentRecord.created | Update subscription, filter, advance enrollment | Auto-pipeline progression |
| SLA monitoring | Schedule (daily 9am) | Search overdue, iterate, create tasks, Slack alert | Never miss deadlines |
| Dispute round | creditDispute.updated | Filter resolution, create next round | Continuous repair cycle |
| Lead routing | person.created | Search agent, assign task | Auto-assign new leads |
| Welcome sequence | enrollment.stageEntered | Delay 1h, Send Email | Automated onboarding |
| Billing alert | subscription.updated (health=declining) | HTTP Request to Slack | Early warning system |
