---
type: "connector"
name: "Api Reference"
description: "Auto-generated description for Api Reference"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# Base44 API Reference — U2.3.A Comprehensive

## Overview

Base44 CRM is the operational backbone of NewLeaf Financial. It provides:
- **Entity CRUD** across 11+ entity types
- **Reporting Hub** with 16 pre-built operational reports
- **MCP Bridge Delegates** (NMI, Slack, GHL, VAPI)
- **Jarvis Utility Functions** (file system, task manager, data guard, rolling context)

**SDK:** `@base44/sdk` v0.8.31+
**Auth:** Service-role via `BASE44_API_KEY`
**App ID:** `692f9a5fce9fd7c889a4b4ac`

## Entity Schema Summary

### CustomerProfile
The central customer entity. Links to credit reports, payment logs, call logs, support tickets, and enrollment status.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `email` | string | Customer email |
| `phone` | string | Phone number (E.164) |
| `first_name` | string | First name |
| `last_name` | string | Last name |
| `status` | enum | active / inactive / enrolled / cancelled |
| `enrollment_date` | ISO date | When customer enrolled |
| `credit_score` | number | Latest credit score |
| `created_date` | ISO date | Record creation |
| `updated_date` | ISO date | Last update |

**Actions:** `customer_profile_query`, `customer_profile_get`, `customer_profile_create`, `customer_profile_update`, `customer_profile_count`

### PaymentLog
Records every payment attempt (success, decline, or error).

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `customer_id` | UUID | FK to CustomerProfile |
| `amount` | number | Payment amount in dollars |
| `status` | enum | succeeded / declined / pending / refunded |
| `method` | string | card / ach / wallet |
| `nmi_transaction_id` | string | NMI transaction reference |
| `created_date` | ISO date | When payment was processed |

**Actions:** `payment_log_query`, `payment_log_get`, `payment_log_count`

### CallLog
VAPI and agent call records.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `customer_id` | UUID | FK to CustomerProfile |
| `direction` | enum | inbound / outbound |
| `duration_seconds` | number | Call duration |
| `disposition` | string | Outcome (e.g., "enrolled", "voicemail") |
| `recording_url` | string | VAPI recording URL |
| `agent` | string | Agent name/ID |
| `created_date` | ISO date | Call timestamp |

**Actions:** `call_log_query`, `call_log_get`, `call_log_count`

### SupportTicket
Customer support tickets.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `customer_id` | UUID | FK to CustomerProfile |
| `status` | enum | open / in_progress / resolved / closed |
| `priority` | enum | low / medium / high / critical |
| `assigned_agent` | string | Agent email |
| `messages` | array | Ticket messages |
| `resolution` | string | Resolution notes |
| `created_date` | ISO date | Ticket created |

**Actions:** `support_ticket_query`, `support_ticket_get`, `support_ticket_create`, `support_ticket_update`

### CreditReport
Tri-merge credit reports.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `customer_id` | UUID | FK to CustomerProfile |
| `bureau` | enum | experian / transunion / equifax |
| `score` | number | Credit score |
| `report_date` | ISO date | Report date |
| `negative_items_count` | number | Total negative items |

**Actions:** `credit_report_query`, `credit_report_get`

### NegativeItem
Individual negative items on credit reports.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `credit_report_id` | UUID | FK to CreditReport |
| `account_name` | string | Creditor name |
| `type` | string | collections / charge_off / late_payment |
| `status` | string | unpaid / disputed / paid |
| `amount` | number | Amount owed |

**Actions:** `negative_item_query`, `negative_item_get`, `negative_item_create`, `negative_item_update`

### AdminNotification
System notifications for admins/agents.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `type` | string | Notification type |
| `message` | string | Notification body |
| `severity` | enum | info / warning / critical |
| `read` | boolean | Read status |
| `related_entity` | string | Linked entity ref |
| `created_date` | ISO date | Notification timestamp |

**Actions:** `admin_notification_query`, `admin_notification_get`, `admin_notification_create`, `admin_notification_update`

### VapiCallEvent
VAPI voice AI call events.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `call_id` | string | VAPI call SID |
| `customer_id` | UUID | FK to CustomerProfile |
| `event_type` | string | transcript / transfer / hangup |
| `transcript_summary` | string | AI-generated summary |
| `cost` | number | Call cost |
| `outcome` | string | Call outcome |

**Actions:** `vapi_call_event_query`, `vapi_call_event_get`

### GhlMessage
GoHighLevel message records.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `customer_id` | UUID | FK to CustomerProfile |
| `channel` | string | sms / email / voice |
| `direction` | enum | inbound / outbound |
| `body` | string | Message content |
| `created_date` | ISO date | Message timestamp |

**Actions:** `ghl_message_query`, `ghl_message_get`

### EmailMessage
Email communication records.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `customer_id` | UUID | FK to CustomerProfile |
| `direction` | enum | inbound / outbound |
| `subject` | string | Email subject |
| `body` | string | Email body |
| `created_date` | ISO date | Email timestamp |

**Actions:** `email_message_query`, `email_message_get`

### JarvisTask
Agent task management.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `title` | string | Task title |
| `description` | string | Task description |
| `priority` | string | high / medium / low |
| `assignee` | string | Agent email |
| `status` | string | pending / in_progress / completed |
| `metadata` | object | Arbitrary metadata |
| `created_date` | ISO date | Task created |

**Actions:** `jarvis_task_query`, `jarvis_task_get`, `jarvis_task_create`, `jarvis_task_update`

## Reporting Hub Actions

| Action | Description |
|--------|-------------|
| `reporting_overview` | Dashboard KPIs: active customers, revenue, enrollments |
| `reporting_enrollments` | Enrollment pipeline status |
| `reporting_lead_flow` | Lead conversion funnel |
| `reporting_billing` | Billing metrics: MRR, churn, declines |
| `reporting_communications` | Comms stats across Slack/SMS/Email |
| `reporting_calls` | Call center metrics: volume, duration, outcomes |
| `reporting_agents` | Agent performance dashboard |
| `reporting_support` | Support ticket metrics |
| `reporting_automations` | Automation health and throughput |
| `reporting_activity_feed` | Recent system activity |
| `reporting_customer_360` | Per-customer full dossier |
| `reporting_customer_comms` | Per-customer communication history |
| `reporting_sync_health` | Cross-system sync status |
| `reporting_morning_pulse` | Morning brief: overnight stats |
| `reporting_vapi_intelligence` | VAPI call intelligence dashboard |
| `reporting_enrollment_intelligence` | Enrollment intelligence report |

## Action Count

**Total: 63 actions** (11 entities × avg 4 ops + 16 reports + 4 MCP bridges + 12 jarvis funcs + 1 customer 360)

## Authentication

All actions use service-role authentication via `BASE44_API_KEY` stored in `secrets.base44.apiKey`. The SDK client is created once at module load time.

## Error Handling

All actions return `ActionResponse` with:
- `success: boolean`
- `data?: any` — result payload on success
- `error?: string` — error message on failure
- `action?: string` — the action name that was executed
- `count?: number` — result count for query actions

## Integration Pattern

```typescript
import { execute } from "@/connectors/base44/client";

// Query customers
const result = await execute({
  action: "customer_profile_query",
  args: { limit: 10, filter: { status: "active" } }
});

// Get reporting overview
const overview = await execute({
  action: "reporting_overview",
  args: {}
});

// Invoke NMI through MCP bridge
const charge = await execute({
  action: "nmi_invoke",
  args: { bridgeAction: "charge", payload: { amount: 99.00, vault_id: "..." } }
});
```
