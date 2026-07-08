//! Record types persisted by the domain stores.
//!
//! These are deliberately storage-shaped (flat, JSON payload columns for
//! open-ended data) rather than runtime-shaped; higher crates convert to
//! their richer types. `resource_id` follows Mastra's naming: the stable
//! owner scope of memory (in Rustra this is the user id).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use rustra_core::{new_id, ResourceKind, Visibility};

fn default_json() -> Value {
    Value::Null
}

// ---------------------------------------------------------------------------
// Memory domain (threads / messages / resources)
// ---------------------------------------------------------------------------

/// A conversation thread (Mastra: `threads` table).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Thread {
    pub id: String,
    /// Owner scope — the user id. Immutable for the thread's lifetime.
    pub resource_id: String,
    pub title: Option<String>,
    #[serde(default = "default_json")]
    pub metadata: Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Thread {
    pub fn new(resource_id: impl Into<String>) -> Self {
        let now = Utc::now();
        Self {
            id: new_id("thr"),
            resource_id: resource_id.into(),
            title: None,
            metadata: Value::Null,
            created_at: now,
            updated_at: now,
        }
    }
}

/// A persisted conversation message (Mastra: `messages` table).
///
/// `content` is the JSON-serialized content-block list from `rustra-llm`;
/// storage stays independent of the model layer.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StoredMessage {
    pub id: String,
    pub thread_id: String,
    pub resource_id: String,
    /// `user` | `assistant` | `system` | `tool`.
    pub role: String,
    pub content: Value,
    pub created_at: DateTime<Utc>,
}

/// Per-resource (per-user) memory record (Mastra: `resources` table).
/// Holds working memory and durable user preferences.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ResourceRecord {
    /// The resource id (user id).
    pub id: String,
    /// Markdown/structured working memory maintained by the agent.
    pub working_memory: Option<String>,
    #[serde(default = "default_json")]
    pub metadata: Value,
    pub updated_at: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// Workflow domain (snapshots)
// ---------------------------------------------------------------------------

/// Serialized workflow run state (Mastra: `workflow_snapshot`). Written at
/// every checkpoint so suspended/crashed runs survive restarts.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct WorkflowSnapshot {
    pub run_id: String,
    pub workflow_id: String,
    /// Owner of the run.
    pub resource_id: String,
    /// `running` | `suspended` | `waiting` | `success` | `failed` | `cancelled`.
    pub status: String,
    /// Engine-defined serialized state (step results, cursor, suspense data).
    pub snapshot: Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// Observability domain (runs / spans / logs)
// ---------------------------------------------------------------------------

/// A top-level unit of work: an agent invocation, workflow run, or task
/// execution.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RunRecord {
    pub id: String,
    /// `agent` | `workflow` | `task`.
    pub kind: String,
    /// Id of the agent/workflow/task definition that ran.
    pub subject_id: String,
    pub user_id: String,
    /// `running` | `suspended` | `success` | `failed` | `cancelled`.
    pub status: String,
    #[serde(default = "default_json")]
    pub input: Value,
    #[serde(default = "default_json")]
    pub output: Value,
    pub error: Option<String>,
    pub trace_id: String,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    #[serde(default = "default_json")]
    pub metadata: Value,
}

/// One span in a trace. Spans cover LLM calls, tool calls, memory ops, MCP
/// calls, flow steps, context attachment, interrupts, retries.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TraceSpan {
    pub id: String,
    pub trace_id: String,
    pub parent_id: Option<String>,
    pub name: String,
    /// `agent_run` | `llm_call` | `tool_call` | `memory_op` | `mcp_call` |
    /// `flow_step` | `context_attach` | `interrupt` | `retry` | `other`.
    pub kind: String,
    pub user_id: String,
    #[serde(default = "default_json")]
    pub input: Value,
    #[serde(default = "default_json")]
    pub output: Value,
    pub error: Option<String>,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    #[serde(default = "default_json")]
    pub metadata: Value,
}

/// A structured log line, optionally correlated to a run.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct LogRecord {
    pub id: String,
    /// `trace` | `debug` | `info` | `warn` | `error`.
    pub level: String,
    pub message: String,
    #[serde(default = "default_json")]
    pub fields: Value,
    pub user_id: Option<String>,
    pub run_id: Option<String>,
    pub created_at: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// Task domain (tasks / schedules / subscriptions / decisions)
// ---------------------------------------------------------------------------

/// A unit of executable work managed by the task runtime.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TaskRecord {
    pub id: String,
    pub user_id: String,
    /// What triggered it: `direct` | `background` | `schedule` | `signal` |
    /// `webhook`.
    pub trigger: String,
    /// What to run: `{ "target": "agent"|"workflow", "id": ..., "input": ... }`.
    pub spec: Value,
    /// `pending` | `running` | `suspended` | `completed` | `failed` |
    /// `cancelled`.
    pub status: String,
    pub attempts: u32,
    pub max_retries: u32,
    pub last_error: Option<String>,
    #[serde(default = "default_json")]
    pub output: Value,
    /// Run id in observability, once started.
    pub run_id: Option<String>,
    /// Backlink when spawned by a schedule / subscription.
    pub schedule_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub ended_at: Option<DateTime<Utc>>,
}

/// A cron schedule that fires tasks (Mastra: `mastra.schedules`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ScheduleRecord {
    pub id: String,
    pub user_id: String,
    pub name: String,
    /// 5/6-field cron expression.
    pub cron: String,
    /// IANA timezone name; `None` means UTC.
    pub timezone: Option<String>,
    /// Task spec fired on each tick (same shape as [`TaskRecord::spec`]).
    pub spec: Value,
    pub enabled: bool,
    pub next_run_at: Option<DateTime<Utc>>,
    pub last_run_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// A persisted event subscription: when an event matching `event_name` fires
/// (exact or `*` suffix wildcard), launch `spec` as a task.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SubscriptionRecord {
    pub id: String,
    pub user_id: String,
    /// e.g. `webhook.github.*`, `browser.page_loaded`.
    pub event_name: String,
    pub spec: Value,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
}

/// A pending human-in-the-loop decision attached to a run.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DecisionRecord {
    pub id: String,
    pub user_id: String,
    pub run_id: String,
    /// `approval` | `input`.
    pub kind: String,
    pub prompt: String,
    /// For approvals: option labels; for input: an input schema.
    #[serde(default = "default_json")]
    pub payload: Value,
    /// `pending` | `approved` | `rejected` | `answered` | `cancelled`.
    pub status: String,
    /// The human's answer, once resolved.
    #[serde(default = "default_json")]
    pub resolution: Value,
    pub created_at: DateTime<Utc>,
    pub resolved_at: Option<DateTime<Utc>>,
}

// ---------------------------------------------------------------------------
// Definitions domain (user-created agents / skills / flows / knowledge)
// ---------------------------------------------------------------------------

/// A versioned, user-created artifact definition.
///
/// `spec` holds the artifact body in its native declarative format (agent
/// config, SKILL.md content + assets manifest, workflow graph, knowledge
/// manifest). Every save creates a new version; `latest` marks the head.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DefinitionRecord {
    /// Stable artifact id shared across versions.
    pub id: String,
    pub kind: ResourceKind,
    pub owner_id: String,
    pub name: String,
    pub version: u32,
    pub spec: Value,
    pub visibility: Visibility,
    pub latest: bool,
    pub created_at: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// ACL domain (users / grants)
// ---------------------------------------------------------------------------

/// A registered user.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct UserRecord {
    pub id: String,
    pub display_name: String,
    /// Role names (see `rustra_core::Role`).
    pub roles: Vec<String>,
    /// SHA-256 hex digest of the user's API token. Plaintext is never stored.
    pub token_hash: Option<String>,
    /// Profile/settings JSON; also exposed to agents as a context source.
    #[serde(default = "default_json")]
    pub profile: Value,
    pub created_at: DateTime<Utc>,
}

/// An explicit sharing grant: `grantee` may perform `actions` on the
/// resource. Grants are additive on top of ownership and role permissions.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GrantRecord {
    pub id: String,
    pub resource_kind: ResourceKind,
    pub resource_id: String,
    /// User id, or `role:<name>` to grant to a role.
    pub grantee: String,
    /// Action names (see `rustra_core::Action`).
    pub actions: Vec<String>,
    pub granted_by: String,
    pub created_at: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// Infra domain (workspaces / mcp / ui / channel messages)
// ---------------------------------------------------------------------------

/// Metadata for a per-user workspace (the files live on a filesystem or
/// object store; this record locates and configures it).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct WorkspaceRecord {
    pub id: String,
    pub user_id: String,
    pub name: String,
    /// Root directory of the workspace on the host.
    pub root_path: String,
    #[serde(default = "default_json")]
    pub settings: Value,
    pub created_at: DateTime<Utc>,
}

/// A configured MCP server (config-only: no code required to add one).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct McpServerRecord {
    pub id: String,
    /// Owner; `None` for deployment-wide shared servers.
    pub owner_id: Option<String>,
    pub name: String,
    /// Full `rustra-mcp` server definition (transport, env, permissions).
    pub config: Value,
    pub enabled: bool,
    pub visibility: Visibility,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// A generated UI artifact (HTML/JS document produced by an agent).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct UiArtifactRecord {
    pub id: String,
    pub owner_id: String,
    pub title: String,
    /// `html` (default) — extension hook for richer kinds later.
    pub kind: String,
    pub html: String,
    /// Optional structured data the artifact renders.
    #[serde(default = "default_json")]
    pub data: Value,
    pub version: u32,
    pub visibility: Visibility,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// An in-app message delivered to a user through the `in_app` channel (also
/// the persistence record for other channels' sends).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ChannelMessageRecord {
    pub id: String,
    pub user_id: String,
    /// `in_app` | `slack` | `email` | `webhook` | custom adapter names.
    pub channel: String,
    /// Sending agent id or `system`.
    pub sender: String,
    pub content: String,
    #[serde(default = "default_json")]
    pub metadata: Value,
    pub read: bool,
    pub created_at: DateTime<Utc>,
}
