//! The per-domain store traits and the composite [`Storage`] supertrait.
//!
//! Conventions:
//!
//! * `upsert_*` inserts or replaces by primary key.
//! * `list_*` returns newest-first unless documented otherwise and always
//!   takes a [`Page`].
//! * Backends never enforce access control — that is the RBAC layer's job.
//!   They *do* enforce scoping parameters they are given (a `resource_id`
//!   filter must be applied, not advisory).

use async_trait::async_trait;
use chrono::{DateTime, Utc};

use rustra_core::{ResourceKind, Result};

use crate::types::*;
use crate::Page;

/// Threads, messages, and per-resource working memory (Mastra `memory`
/// domain).
#[async_trait]
pub trait MemoryStore: Send + Sync {
    async fn create_thread(&self, thread: Thread) -> Result<()>;
    async fn get_thread(&self, thread_id: &str) -> Result<Option<Thread>>;
    async fn update_thread(&self, thread: Thread) -> Result<()>;
    /// Deletes the thread and all of its messages.
    async fn delete_thread(&self, thread_id: &str) -> Result<()>;
    /// Threads owned by `resource_id`, most recently updated first.
    async fn list_threads(&self, resource_id: &str, page: Page) -> Result<Vec<Thread>>;

    async fn append_message(&self, message: StoredMessage) -> Result<()>;
    /// The last `limit` messages of a thread in chronological order.
    async fn recent_messages(&self, thread_id: &str, limit: usize) -> Result<Vec<StoredMessage>>;
    /// Fetch specific messages by id (used by semantic recall), chronological.
    async fn get_messages(&self, ids: &[String]) -> Result<Vec<StoredMessage>>;

    async fn get_resource(&self, resource_id: &str) -> Result<Option<ResourceRecord>>;
    async fn save_resource(&self, resource: ResourceRecord) -> Result<()>;
}

/// Workflow run snapshots (Mastra `workflows` domain).
#[async_trait]
pub trait WorkflowStore: Send + Sync {
    async fn save_snapshot(&self, snapshot: WorkflowSnapshot) -> Result<()>;
    async fn load_snapshot(&self, run_id: &str) -> Result<Option<WorkflowSnapshot>>;
    /// Snapshots for a user, optionally filtered by workflow id and status.
    async fn list_snapshots(
        &self,
        resource_id: &str,
        workflow_id: Option<&str>,
        status: Option<&str>,
        page: Page,
    ) -> Result<Vec<WorkflowSnapshot>>;
    async fn delete_snapshot(&self, run_id: &str) -> Result<()>;
}

/// Runs, trace spans, and logs (Mastra `observability` domain).
#[async_trait]
pub trait ObservabilityStore: Send + Sync {
    async fn insert_run(&self, run: RunRecord) -> Result<()>;
    async fn update_run(&self, run: RunRecord) -> Result<()>;
    async fn get_run(&self, run_id: &str) -> Result<Option<RunRecord>>;
    async fn list_runs(
        &self,
        user_id: &str,
        kind: Option<&str>,
        status: Option<&str>,
        page: Page,
    ) -> Result<Vec<RunRecord>>;

    async fn insert_spans(&self, spans: Vec<TraceSpan>) -> Result<()>;
    /// All spans of a trace in start order.
    async fn list_spans(&self, trace_id: &str) -> Result<Vec<TraceSpan>>;

    async fn insert_log(&self, log: LogRecord) -> Result<()>;
    async fn list_logs(
        &self,
        user_id: Option<&str>,
        run_id: Option<&str>,
        page: Page,
    ) -> Result<Vec<LogRecord>>;
}

/// Tasks, schedules, subscriptions, and HITL decisions.
#[async_trait]
pub trait TaskStore: Send + Sync {
    async fn insert_task(&self, task: TaskRecord) -> Result<()>;
    async fn update_task(&self, task: TaskRecord) -> Result<()>;
    async fn get_task(&self, task_id: &str) -> Result<Option<TaskRecord>>;
    async fn list_tasks(
        &self,
        user_id: &str,
        status: Option<&str>,
        page: Page,
    ) -> Result<Vec<TaskRecord>>;

    async fn upsert_schedule(&self, schedule: ScheduleRecord) -> Result<()>;
    async fn get_schedule(&self, schedule_id: &str) -> Result<Option<ScheduleRecord>>;
    async fn delete_schedule(&self, schedule_id: &str) -> Result<()>;
    /// `user_id = None` lists all users' schedules (scheduler loop only).
    async fn list_schedules(&self, user_id: Option<&str>, page: Page)
        -> Result<Vec<ScheduleRecord>>;
    /// Enabled schedules with `next_run_at <= now`.
    async fn due_schedules(&self, now: DateTime<Utc>) -> Result<Vec<ScheduleRecord>>;

    async fn upsert_subscription(&self, sub: SubscriptionRecord) -> Result<()>;
    async fn delete_subscription(&self, sub_id: &str) -> Result<()>;
    /// `user_id = None` lists all (signal dispatcher only).
    async fn list_subscriptions(
        &self,
        user_id: Option<&str>,
        page: Page,
    ) -> Result<Vec<SubscriptionRecord>>;

    async fn insert_decision(&self, decision: DecisionRecord) -> Result<()>;
    async fn update_decision(&self, decision: DecisionRecord) -> Result<()>;
    async fn get_decision(&self, decision_id: &str) -> Result<Option<DecisionRecord>>;
    async fn list_decisions(
        &self,
        user_id: &str,
        pending_only: bool,
        page: Page,
    ) -> Result<Vec<DecisionRecord>>;
}

/// Versioned user-created artifact definitions.
#[async_trait]
pub trait DefinitionStore: Send + Sync {
    /// Persist a new version and mark it latest. `record.version` is assigned
    /// by the store (previous latest + 1) and returned.
    async fn put_definition(&self, record: DefinitionRecord) -> Result<DefinitionRecord>;
    /// Latest version of a definition.
    async fn get_definition(
        &self,
        kind: ResourceKind,
        id: &str,
    ) -> Result<Option<DefinitionRecord>>;
    async fn get_definition_version(
        &self,
        kind: ResourceKind,
        id: &str,
        version: u32,
    ) -> Result<Option<DefinitionRecord>>;
    /// Latest versions owned by `owner_id`; with `include_shared`, also
    /// shared/public definitions from other owners.
    async fn list_definitions(
        &self,
        kind: ResourceKind,
        owner_id: &str,
        include_shared: bool,
        page: Page,
    ) -> Result<Vec<DefinitionRecord>>;
    /// Remove all versions.
    async fn delete_definition(&self, kind: ResourceKind, id: &str) -> Result<()>;
}

/// Users and sharing grants.
#[async_trait]
pub trait AclStore: Send + Sync {
    async fn upsert_user(&self, user: UserRecord) -> Result<()>;
    async fn get_user(&self, user_id: &str) -> Result<Option<UserRecord>>;
    async fn find_user_by_token_hash(&self, token_hash: &str) -> Result<Option<UserRecord>>;
    async fn list_users(&self, page: Page) -> Result<Vec<UserRecord>>;

    async fn insert_grant(&self, grant: GrantRecord) -> Result<()>;
    async fn delete_grant(&self, grant_id: &str) -> Result<()>;
    async fn list_grants_for_resource(
        &self,
        kind: ResourceKind,
        resource_id: &str,
    ) -> Result<Vec<GrantRecord>>;
    async fn list_grants_for_grantee(&self, grantee: &str) -> Result<Vec<GrantRecord>>;
}

/// Workspace metadata, MCP configs, UI artifacts, channel messages.
#[async_trait]
pub trait InfraStore: Send + Sync {
    async fn upsert_workspace(&self, ws: WorkspaceRecord) -> Result<()>;
    async fn get_workspace(&self, ws_id: &str) -> Result<Option<WorkspaceRecord>>;
    async fn list_workspaces(&self, user_id: &str, page: Page) -> Result<Vec<WorkspaceRecord>>;
    async fn delete_workspace(&self, ws_id: &str) -> Result<()>;

    async fn upsert_mcp_server(&self, server: McpServerRecord) -> Result<()>;
    async fn get_mcp_server(&self, server_id: &str) -> Result<Option<McpServerRecord>>;
    /// Servers owned by `user_id` plus, with `include_shared`, shared/global
    /// servers.
    async fn list_mcp_servers(
        &self,
        user_id: &str,
        include_shared: bool,
        page: Page,
    ) -> Result<Vec<McpServerRecord>>;
    async fn delete_mcp_server(&self, server_id: &str) -> Result<()>;

    async fn upsert_ui_artifact(&self, artifact: UiArtifactRecord) -> Result<()>;
    async fn get_ui_artifact(&self, artifact_id: &str) -> Result<Option<UiArtifactRecord>>;
    async fn list_ui_artifacts(&self, owner_id: &str, page: Page)
        -> Result<Vec<UiArtifactRecord>>;
    async fn delete_ui_artifact(&self, artifact_id: &str) -> Result<()>;

    async fn insert_channel_message(&self, message: ChannelMessageRecord) -> Result<()>;
    async fn list_channel_messages(
        &self,
        user_id: &str,
        channel: Option<&str>,
        page: Page,
    ) -> Result<Vec<ChannelMessageRecord>>;
    async fn mark_message_read(&self, message_id: &str) -> Result<()>;
}

/// The composite storage backend — everything a Rustra deployment persists.
///
/// Implemented in full by `InMemoryStorage` (tests/dev), `SqliteStorage`
/// (default), `PostgresStorage`, and `FirebaseStorage`. Blanket-implemented
/// for any type that implements all domain traits.
pub trait Storage:
    MemoryStore
    + WorkflowStore
    + ObservabilityStore
    + TaskStore
    + DefinitionStore
    + AclStore
    + InfraStore
    + Send
    + Sync
{
}

impl<T> Storage for T where
    T: MemoryStore
        + WorkflowStore
        + ObservabilityStore
        + TaskStore
        + DefinitionStore
        + AclStore
        + InfraStore
        + Send
        + Sync
{
}
