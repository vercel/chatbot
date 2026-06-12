# Base44 Functions Guide — U2.3.A

## Overview

Beyond entity CRUD, the Base44 connector provides access to the Jarvis function ecosystem:
reporting, file system, task management, data guard, rolling context, and MCP bridges.

## Jarvis File System

The file system stores PRDs, skills, playbooks, and memory in a managed hierarchy.

### `jarvis_file_read`
Read a file from the Jarvis cortex/skills tree.

**Args:**
- `path` (string, required): Full path, e.g. `"jarvis/cortex/skills/nmi.md"`

**Returns:** File content and metadata.

**Example:**
```typescript
execute({ action: "jarvis_file_read", args: { path: "jarvis/cortex/missions/U2-3.md" } })
```

### `jarvis_file_write`
Write content to a file in the Jarvis File System.

**Args:**
- `path` (string, required): Target path
- `content` (string, required): File content

**Example:**
```typescript
execute({ action: "jarvis_file_write", args: { path: "proofs/test.json", content: '{"ok":true}' } })
```

### `jarvis_file_list`
List files in a directory.

**Args:**
- `parentPath` (string, default: `"/skills"`): Directory to list

**Example:**
```typescript
execute({ action: "jarvis_file_list", args: { parentPath: "/skills" } })
```

### `jarvis_file_search`
Search files by filename or content query.

**Args:**
- `query` (string, required): Search term

**Example:**
```typescript
execute({ action: "jarvis_file_search", args: { query: "golden vault" } })
```

## Jarvis Task Manager

Agent task queue for work tracking and assignment.

### `jarvis_task_get_my_tasks`
Get tasks assigned to the current agent.

**Args:** None (or optional filter params)

**Returns:** Array of JarvisTask records.

### `jarvis_task_create`
Create a new task.

**Args:**
- `title` (string, required): Task title
- `description` (string): Task description
- `priority` (string): "high" | "medium" | "low" (default: "medium")
- `assignee` (string): Agent email (default: "jarvis")
- `metadata` (object): Arbitrary metadata

**Returns:** Created task with ID.

### `jarvis_task_complete`
Mark a task as complete.

**Args:**
- `id` (string, required): Task ID
- `resolution` (string): Resolution notes

## Jarvis Data Guard

Secure data persistence with session-based access.

### `jarvis_data_guard_query`
Run a validated, read-only SQL query against the NewLeaf data warehouse.

**Args:**
- `sql` (string, required): SQL SELECT statement
- `params` (object): Query parameters

**Tables available:** activity_log, agent_calls, agreements, billing_queue, client_360, clients, credit_reports, danger_clients, dispute_rounds, emails, negative_items, nmi_transactions, payment_logs, recovery_items, slack_messages, slack_messages_v2, slack_submissions, sms_messages, subscriptions, support_calls, support_tickets

**Example:**
```typescript
execute({
  action: "jarvis_data_guard_query",
  args: {
    sql: "SELECT * FROM clients WHERE status = ? LIMIT 10",
    params: { 0: "active" }
  }
})
```

### `jarvis_data_guard_session_deposit`
Store data in the session vault for cross-turn persistence.

**Args:**
- `key` (string, required): Storage key
- `data` (any): Data to store (objects auto-stringified)

### `jarvis_data_guard_session_recall`
Retrieve previously stored data from the session vault.

**Args:**
- `key` (string, required): Storage key from deposit

## Rolling Context

In-memory context buffer for conversation continuity.

### `rolling_context_read`
Read current context buffer entries.

**Args:**
- `limit` (number, default: 20): Max entries to return

### `rolling_context_add_item`
Add an item to the rolling context buffer.

**Args:**
- `item` (object, required): Data to store
- `tag` (string): Category tag (default: "general")

## MCP Bridge Delegates

Bridge to external services through Base44's function layer.

### `nmi_invoke`
Proxy to NMI payment gateway operations.

**Args:**
- `bridgeAction` (string): NMI action ("charge", "refund", "vault_create", "subscription_create", etc.)
- `payload` (object): Action-specific parameters

### `slack_invoke`
Proxy to Slack workspace operations.

**Args:**
- `bridgeAction` (string): Slack action ("post_message", "get_channel_history", etc.)
- `payload` (object): Action-specific parameters

### `ghl_invoke`
Proxy to GoHighLevel CRM operations.

**Args:**
- `bridgeAction` (string): GHL action
- `payload` (object): Action-specific parameters

### `vapi_invoke`
Proxy to VAPI voice AI operations.

**Args:**
- `bridgeAction` (string): VAPI action ("list_calls", "create_call", etc.)
- `payload` (object): Action-specific parameters

## Customer 360

Cross-system full customer dossier.

### `customer_360`
Get complete customer profile across ALL systems in one call.

**Args (one of):**
- `customerId` (string): Base44 customer ID
- `email` (string): Customer email
- `phone` (string): Customer phone (E.164)

**Returns:** Profile + NMI transactions + payment logs + Slack mentions + SMS/emails + tickets + recovery items + linked PRDs.

## Reporting Hub

16 pre-built operational reports. Each returns pre-aggregated data — no manual queries needed.

See [api-reference.md](./api-reference.md#reporting-hub-actions) for the full list of 16 reporting actions.

**Pattern:**
```typescript
execute({ action: "reporting_<report_name>", args: { /* optional params */ } })
```

## Error Handling Pattern

All actions return a consistent `ActionResponse`:

```typescript
{
  success: boolean;     // true if action completed
  data?: any;           // result payload
  error?: string;       // error message if success=false
  action?: string;      // action name executed
  count?: number;       // result count (entity queries)
}
```

Failed actions return `{ success: false, error: "..." }` — never throw.
