//! The in-memory reference backend. Implements every domain store with
//! `RwLock`-guarded maps. Used for tests, examples, and as the executable
//! specification the SQL backends are validated against.

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use std::collections::{HashMap, HashSet};
use std::sync::RwLock;

use rustra_core::{Error, ResourceKind, Result, Visibility};

use crate::traits::*;
use crate::types::*;
use crate::Page;

#[derive(Default)]
struct State {
    threads: HashMap<String, Thread>,
    messages: Vec<StoredMessage>,
    resources: HashMap<String, ResourceRecord>,
    snapshots: HashMap<String, WorkflowSnapshot>,
    runs: HashMap<String, RunRecord>,
    spans: Vec<TraceSpan>,
    logs: Vec<LogRecord>,
    tasks: HashMap<String, TaskRecord>,
    schedules: HashMap<String, ScheduleRecord>,
    subscriptions: HashMap<String, SubscriptionRecord>,
    decisions: HashMap<String, DecisionRecord>,
    definitions: Vec<DefinitionRecord>,
    users: HashMap<String, UserRecord>,
    grants: HashMap<String, GrantRecord>,
    workspaces: HashMap<String, WorkspaceRecord>,
    mcp_servers: HashMap<String, McpServerRecord>,
    ui_artifacts: HashMap<String, UiArtifactRecord>,
    channel_messages: Vec<ChannelMessageRecord>,
}

/// See module docs.
#[derive(Default)]
pub struct InMemoryStorage {
    state: RwLock<State>,
}

impl InMemoryStorage {
    pub fn new() -> Self {
        Self::default()
    }

    fn read(&self) -> std::sync::RwLockReadGuard<'_, State> {
        self.state.read().expect("storage lock poisoned")
    }

    fn write(&self) -> std::sync::RwLockWriteGuard<'_, State> {
        self.state.write().expect("storage lock poisoned")
    }
}

fn paginate<T>(items: Vec<T>, page: Page) -> Vec<T> {
    items
        .into_iter()
        .skip(page.offset)
        .take(page.limit)
        .collect()
}

/// Sort newest-first by `key` (ties broken by ascending id so pagination is a
/// total order), then paginate.
fn page_newest_first<T, K: Ord>(
    items: impl Iterator<Item = T>,
    key: impl Fn(&T) -> (K, String),
    page: Page,
) -> Vec<T> {
    let mut items: Vec<T> = items.collect();
    items.sort_by_cached_key(|t| {
        let (k, id) = key(t);
        (std::cmp::Reverse(k), id)
    });
    paginate(items, page)
}

/// Sort oldest-first by `key` (ties broken by ascending id so pagination is a
/// total order), then paginate.
fn page_oldest_first<T, K: Ord>(
    items: impl Iterator<Item = T>,
    key: impl Fn(&T) -> (K, String),
    page: Page,
) -> Vec<T> {
    let mut items: Vec<T> = items.collect();
    items.sort_by_cached_key(key);
    paginate(items, page)
}

#[async_trait]
impl MemoryStore for InMemoryStorage {
    async fn create_thread(&self, thread: Thread) -> Result<()> {
        self.write().threads.insert(thread.id.clone(), thread);
        Ok(())
    }

    async fn get_thread(&self, thread_id: &str) -> Result<Option<Thread>> {
        Ok(self.read().threads.get(thread_id).cloned())
    }

    async fn update_thread(&self, thread: Thread) -> Result<()> {
        let mut state = self.write();
        if !state.threads.contains_key(&thread.id) {
            return Err(Error::not_found("thread", &thread.id));
        }
        state.threads.insert(thread.id.clone(), thread);
        Ok(())
    }

    async fn delete_thread(&self, thread_id: &str) -> Result<()> {
        let mut state = self.write();
        state.threads.remove(thread_id);
        state.messages.retain(|m| m.thread_id != thread_id);
        Ok(())
    }

    async fn list_threads(&self, resource_id: &str, page: Page) -> Result<Vec<Thread>> {
        let state = self.read();
        let threads = state
            .threads
            .values()
            .filter(|t| t.resource_id == resource_id)
            .cloned();
        Ok(page_newest_first(
            threads,
            |t| (t.updated_at, t.id.clone()),
            page,
        ))
    }

    async fn append_message(&self, message: StoredMessage) -> Result<()> {
        self.write().messages.push(message);
        Ok(())
    }

    async fn recent_messages(&self, thread_id: &str, limit: usize) -> Result<Vec<StoredMessage>> {
        let state = self.read();
        let mut msgs: Vec<StoredMessage> = state
            .messages
            .iter()
            .filter(|m| m.thread_id == thread_id)
            .cloned()
            .collect();
        msgs.sort_by(|a, b| a.created_at.cmp(&b.created_at));
        let skip = msgs.len().saturating_sub(limit);
        Ok(msgs.split_off(skip))
    }

    async fn get_messages(&self, ids: &[String]) -> Result<Vec<StoredMessage>> {
        let ids: HashSet<&str> = ids.iter().map(String::as_str).collect();
        let state = self.read();
        let mut msgs: Vec<StoredMessage> = state
            .messages
            .iter()
            .filter(|m| ids.contains(m.id.as_str()))
            .cloned()
            .collect();
        msgs.sort_by(|a, b| a.created_at.cmp(&b.created_at));
        Ok(msgs)
    }

    async fn get_resource(&self, resource_id: &str) -> Result<Option<ResourceRecord>> {
        Ok(self.read().resources.get(resource_id).cloned())
    }

    async fn save_resource(&self, resource: ResourceRecord) -> Result<()> {
        self.write().resources.insert(resource.id.clone(), resource);
        Ok(())
    }
}

#[async_trait]
impl WorkflowStore for InMemoryStorage {
    async fn save_snapshot(&self, snapshot: WorkflowSnapshot) -> Result<()> {
        self.write()
            .snapshots
            .insert(snapshot.run_id.clone(), snapshot);
        Ok(())
    }

    async fn load_snapshot(&self, run_id: &str) -> Result<Option<WorkflowSnapshot>> {
        Ok(self.read().snapshots.get(run_id).cloned())
    }

    async fn list_snapshots(
        &self,
        resource_id: &str,
        workflow_id: Option<&str>,
        status: Option<&str>,
        page: Page,
    ) -> Result<Vec<WorkflowSnapshot>> {
        let state = self.read();
        let snaps = state
            .snapshots
            .values()
            .filter(|s| s.resource_id == resource_id)
            .filter(|s| workflow_id.is_none_or(|w| s.workflow_id == w))
            .filter(|s| status.is_none_or(|st| s.status == st))
            .cloned();
        Ok(page_newest_first(
            snaps,
            |s| (s.updated_at, s.run_id.clone()),
            page,
        ))
    }

    async fn delete_snapshot(&self, run_id: &str) -> Result<()> {
        self.write().snapshots.remove(run_id);
        Ok(())
    }
}

#[async_trait]
impl ObservabilityStore for InMemoryStorage {
    async fn insert_run(&self, run: RunRecord) -> Result<()> {
        self.write().runs.insert(run.id.clone(), run);
        Ok(())
    }

    async fn update_run(&self, run: RunRecord) -> Result<()> {
        self.write().runs.insert(run.id.clone(), run);
        Ok(())
    }

    async fn get_run(&self, run_id: &str) -> Result<Option<RunRecord>> {
        Ok(self.read().runs.get(run_id).cloned())
    }

    async fn list_runs(
        &self,
        user_id: &str,
        kind: Option<&str>,
        status: Option<&str>,
        page: Page,
    ) -> Result<Vec<RunRecord>> {
        let state = self.read();
        let runs = state
            .runs
            .values()
            .filter(|r| r.user_id == user_id)
            .filter(|r| kind.is_none_or(|k| r.kind == k))
            .filter(|r| status.is_none_or(|s| r.status == s))
            .cloned();
        Ok(page_newest_first(
            runs,
            |r| (r.started_at, r.id.clone()),
            page,
        ))
    }

    async fn insert_spans(&self, spans: Vec<TraceSpan>) -> Result<()> {
        self.write().spans.extend(spans);
        Ok(())
    }

    async fn list_spans(&self, trace_id: &str) -> Result<Vec<TraceSpan>> {
        let mut spans: Vec<TraceSpan> = self
            .read()
            .spans
            .iter()
            .filter(|s| s.trace_id == trace_id)
            .cloned()
            .collect();
        spans.sort_by(|a, b| a.started_at.cmp(&b.started_at));
        Ok(spans)
    }

    async fn insert_log(&self, log: LogRecord) -> Result<()> {
        self.write().logs.push(log);
        Ok(())
    }

    async fn list_logs(
        &self,
        user_id: Option<&str>,
        run_id: Option<&str>,
        page: Page,
    ) -> Result<Vec<LogRecord>> {
        let state = self.read();
        let logs = state
            .logs
            .iter()
            .filter(|l| user_id.is_none_or(|u| l.user_id.as_deref() == Some(u)))
            .filter(|l| run_id.is_none_or(|r| l.run_id.as_deref() == Some(r)))
            .cloned();
        Ok(page_newest_first(
            logs,
            |l| (l.created_at, l.id.clone()),
            page,
        ))
    }
}

#[async_trait]
impl TaskStore for InMemoryStorage {
    async fn insert_task(&self, task: TaskRecord) -> Result<()> {
        self.write().tasks.insert(task.id.clone(), task);
        Ok(())
    }

    async fn update_task(&self, task: TaskRecord) -> Result<()> {
        self.write().tasks.insert(task.id.clone(), task);
        Ok(())
    }

    async fn get_task(&self, task_id: &str) -> Result<Option<TaskRecord>> {
        Ok(self.read().tasks.get(task_id).cloned())
    }

    async fn list_tasks(
        &self,
        user_id: &str,
        status: Option<&str>,
        page: Page,
    ) -> Result<Vec<TaskRecord>> {
        let state = self.read();
        let tasks = state
            .tasks
            .values()
            .filter(|t| t.user_id == user_id)
            .filter(|t| status.is_none_or(|s| t.status == s))
            .cloned();
        Ok(page_newest_first(
            tasks,
            |t| (t.created_at, t.id.clone()),
            page,
        ))
    }

    async fn upsert_schedule(&self, schedule: ScheduleRecord) -> Result<()> {
        self.write().schedules.insert(schedule.id.clone(), schedule);
        Ok(())
    }

    async fn get_schedule(&self, schedule_id: &str) -> Result<Option<ScheduleRecord>> {
        Ok(self.read().schedules.get(schedule_id).cloned())
    }

    async fn delete_schedule(&self, schedule_id: &str) -> Result<()> {
        self.write().schedules.remove(schedule_id);
        Ok(())
    }

    async fn list_schedules(
        &self,
        user_id: Option<&str>,
        page: Page,
    ) -> Result<Vec<ScheduleRecord>> {
        let state = self.read();
        let schedules = state
            .schedules
            .values()
            .filter(|s| user_id.is_none_or(|u| s.user_id == u))
            .cloned();
        Ok(page_newest_first(
            schedules,
            |s| (s.created_at, s.id.clone()),
            page,
        ))
    }

    async fn due_schedules(&self, now: DateTime<Utc>) -> Result<Vec<ScheduleRecord>> {
        let mut due: Vec<ScheduleRecord> = self
            .read()
            .schedules
            .values()
            .filter(|s| s.enabled && s.next_run_at.is_some_and(|t| t <= now))
            .cloned()
            .collect();
        due.sort_by(|a, b| {
            a.next_run_at
                .cmp(&b.next_run_at)
                .then_with(|| a.id.cmp(&b.id))
        });
        Ok(due)
    }

    async fn upsert_subscription(&self, sub: SubscriptionRecord) -> Result<()> {
        self.write().subscriptions.insert(sub.id.clone(), sub);
        Ok(())
    }

    async fn delete_subscription(&self, sub_id: &str) -> Result<()> {
        self.write().subscriptions.remove(sub_id);
        Ok(())
    }

    async fn list_subscriptions(
        &self,
        user_id: Option<&str>,
        page: Page,
    ) -> Result<Vec<SubscriptionRecord>> {
        let state = self.read();
        let subs = state
            .subscriptions
            .values()
            .filter(|s| user_id.is_none_or(|u| s.user_id == u))
            .cloned();
        Ok(page_newest_first(
            subs,
            |s| (s.created_at, s.id.clone()),
            page,
        ))
    }

    async fn insert_decision(&self, decision: DecisionRecord) -> Result<()> {
        self.write().decisions.insert(decision.id.clone(), decision);
        Ok(())
    }

    async fn update_decision(&self, decision: DecisionRecord) -> Result<()> {
        self.write().decisions.insert(decision.id.clone(), decision);
        Ok(())
    }

    async fn get_decision(&self, decision_id: &str) -> Result<Option<DecisionRecord>> {
        Ok(self.read().decisions.get(decision_id).cloned())
    }

    async fn list_decisions(
        &self,
        user_id: &str,
        pending_only: bool,
        page: Page,
    ) -> Result<Vec<DecisionRecord>> {
        let state = self.read();
        let decisions = state
            .decisions
            .values()
            .filter(|d| d.user_id == user_id)
            .filter(|d| !pending_only || d.status == "pending")
            .cloned();
        Ok(page_newest_first(
            decisions,
            |d| (d.created_at, d.id.clone()),
            page,
        ))
    }
}

#[async_trait]
impl DefinitionStore for InMemoryStorage {
    async fn put_definition(&self, mut record: DefinitionRecord) -> Result<DefinitionRecord> {
        let mut state = self.write();
        let next_version = state
            .definitions
            .iter()
            .filter(|d| d.kind == record.kind && d.id == record.id)
            .map(|d| d.version)
            .max()
            .map_or(1, |v| v + 1);
        for d in state.definitions.iter_mut() {
            if d.kind == record.kind && d.id == record.id {
                d.latest = false;
            }
        }
        record.version = next_version;
        record.latest = true;
        state.definitions.push(record.clone());
        Ok(record)
    }

    async fn get_definition(
        &self,
        kind: ResourceKind,
        id: &str,
    ) -> Result<Option<DefinitionRecord>> {
        Ok(self
            .read()
            .definitions
            .iter()
            .find(|d| d.kind == kind && d.id == id && d.latest)
            .cloned())
    }

    async fn get_definition_version(
        &self,
        kind: ResourceKind,
        id: &str,
        version: u32,
    ) -> Result<Option<DefinitionRecord>> {
        Ok(self
            .read()
            .definitions
            .iter()
            .find(|d| d.kind == kind && d.id == id && d.version == version)
            .cloned())
    }

    async fn list_definitions(
        &self,
        kind: ResourceKind,
        owner_id: &str,
        include_shared: bool,
        page: Page,
    ) -> Result<Vec<DefinitionRecord>> {
        let state = self.read();
        let defs = state
            .definitions
            .iter()
            .filter(|d| d.kind == kind && d.latest)
            .filter(|d| {
                d.owner_id == owner_id || (include_shared && d.visibility != Visibility::Private)
            })
            .cloned();
        Ok(page_newest_first(
            defs,
            |d| (d.created_at, d.id.clone()),
            page,
        ))
    }

    async fn delete_definition(&self, kind: ResourceKind, id: &str) -> Result<()> {
        self.write()
            .definitions
            .retain(|d| !(d.kind == kind && d.id == id));
        Ok(())
    }
}

#[async_trait]
impl AclStore for InMemoryStorage {
    async fn upsert_user(&self, user: UserRecord) -> Result<()> {
        self.write().users.insert(user.id.clone(), user);
        Ok(())
    }

    async fn get_user(&self, user_id: &str) -> Result<Option<UserRecord>> {
        Ok(self.read().users.get(user_id).cloned())
    }

    async fn find_user_by_token_hash(&self, token_hash: &str) -> Result<Option<UserRecord>> {
        Ok(self
            .read()
            .users
            .values()
            .find(|u| u.token_hash.as_deref() == Some(token_hash))
            .cloned())
    }

    async fn list_users(&self, page: Page) -> Result<Vec<UserRecord>> {
        let state = self.read();
        Ok(page_oldest_first(
            state.users.values().cloned(),
            |u| (u.created_at, u.id.clone()),
            page,
        ))
    }

    async fn insert_grant(&self, grant: GrantRecord) -> Result<()> {
        self.write().grants.insert(grant.id.clone(), grant);
        Ok(())
    }

    async fn delete_grant(&self, grant_id: &str) -> Result<()> {
        self.write().grants.remove(grant_id);
        Ok(())
    }

    async fn list_grants_for_resource(
        &self,
        kind: ResourceKind,
        resource_id: &str,
    ) -> Result<Vec<GrantRecord>> {
        let mut grants: Vec<GrantRecord> = self
            .read()
            .grants
            .values()
            .filter(|g| g.resource_kind == kind && g.resource_id == resource_id)
            .cloned()
            .collect();
        grants.sort_by(|a, b| {
            a.created_at
                .cmp(&b.created_at)
                .then_with(|| a.id.cmp(&b.id))
        });
        Ok(grants)
    }

    async fn list_grants_for_grantee(&self, grantee: &str) -> Result<Vec<GrantRecord>> {
        let mut grants: Vec<GrantRecord> = self
            .read()
            .grants
            .values()
            .filter(|g| g.grantee == grantee)
            .cloned()
            .collect();
        grants.sort_by(|a, b| {
            a.created_at
                .cmp(&b.created_at)
                .then_with(|| a.id.cmp(&b.id))
        });
        Ok(grants)
    }
}

#[async_trait]
impl InfraStore for InMemoryStorage {
    async fn upsert_workspace(&self, ws: WorkspaceRecord) -> Result<()> {
        self.write().workspaces.insert(ws.id.clone(), ws);
        Ok(())
    }

    async fn get_workspace(&self, ws_id: &str) -> Result<Option<WorkspaceRecord>> {
        Ok(self.read().workspaces.get(ws_id).cloned())
    }

    async fn list_workspaces(&self, user_id: &str, page: Page) -> Result<Vec<WorkspaceRecord>> {
        let state = self.read();
        let workspaces = state
            .workspaces
            .values()
            .filter(|w| w.user_id == user_id)
            .cloned();
        Ok(page_oldest_first(
            workspaces,
            |w| (w.created_at, w.id.clone()),
            page,
        ))
    }

    async fn delete_workspace(&self, ws_id: &str) -> Result<()> {
        self.write().workspaces.remove(ws_id);
        Ok(())
    }

    async fn upsert_mcp_server(&self, server: McpServerRecord) -> Result<()> {
        self.write().mcp_servers.insert(server.id.clone(), server);
        Ok(())
    }

    async fn get_mcp_server(&self, server_id: &str) -> Result<Option<McpServerRecord>> {
        Ok(self.read().mcp_servers.get(server_id).cloned())
    }

    async fn list_mcp_servers(
        &self,
        user_id: &str,
        include_shared: bool,
        page: Page,
    ) -> Result<Vec<McpServerRecord>> {
        let state = self.read();
        let servers = state
            .mcp_servers
            .values()
            .filter(|s| {
                s.owner_id.as_deref() == Some(user_id)
                    || (include_shared
                        && (s.owner_id.is_none() || s.visibility != Visibility::Private))
            })
            .cloned();
        Ok(page_oldest_first(
            servers,
            |s| (s.created_at, s.id.clone()),
            page,
        ))
    }

    async fn delete_mcp_server(&self, server_id: &str) -> Result<()> {
        self.write().mcp_servers.remove(server_id);
        Ok(())
    }

    async fn upsert_ui_artifact(&self, artifact: UiArtifactRecord) -> Result<()> {
        self.write()
            .ui_artifacts
            .insert(artifact.id.clone(), artifact);
        Ok(())
    }

    async fn get_ui_artifact(&self, artifact_id: &str) -> Result<Option<UiArtifactRecord>> {
        Ok(self.read().ui_artifacts.get(artifact_id).cloned())
    }

    async fn list_ui_artifacts(&self, owner_id: &str, page: Page) -> Result<Vec<UiArtifactRecord>> {
        let state = self.read();
        let artifacts = state
            .ui_artifacts
            .values()
            .filter(|a| a.owner_id == owner_id)
            .cloned();
        Ok(page_newest_first(
            artifacts,
            |a| (a.updated_at, a.id.clone()),
            page,
        ))
    }

    async fn delete_ui_artifact(&self, artifact_id: &str) -> Result<()> {
        self.write().ui_artifacts.remove(artifact_id);
        Ok(())
    }

    async fn insert_channel_message(&self, message: ChannelMessageRecord) -> Result<()> {
        self.write().channel_messages.push(message);
        Ok(())
    }

    async fn list_channel_messages(
        &self,
        user_id: &str,
        channel: Option<&str>,
        page: Page,
    ) -> Result<Vec<ChannelMessageRecord>> {
        let state = self.read();
        let msgs = state
            .channel_messages
            .iter()
            .filter(|m| m.user_id == user_id)
            .filter(|m| channel.is_none_or(|c| m.channel == c))
            .cloned();
        Ok(page_newest_first(
            msgs,
            |m| (m.created_at, m.id.clone()),
            page,
        ))
    }

    async fn mark_message_read(&self, message_id: &str) -> Result<()> {
        let mut state = self.write();
        if let Some(m) = state
            .channel_messages
            .iter_mut()
            .find(|m| m.id == message_id)
        {
            m.read = true;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::InMemoryStorage;
    use crate::conformance;

    #[tokio::test]
    async fn thread_and_message_roundtrip() {
        conformance::thread_and_message_roundtrip(&InMemoryStorage::new()).await;
    }

    #[tokio::test]
    async fn definitions_version_monotonically() {
        conformance::definitions_version_monotonically(&InMemoryStorage::new()).await;
    }

    #[tokio::test]
    async fn shared_definitions_visible_to_others() {
        conformance::shared_definitions_visible_to_others(&InMemoryStorage::new()).await;
    }
}
