//! Domain-trait implementations over the Firestore REST client.
//!
//! Fully implemented: [`MemoryStore`], [`WorkflowStore`], [`TaskStore`],
//! [`DefinitionStore`], [`AclStore`]. Stubbed (every method returns
//! `Error::Config`): [`ObservabilityStore`], [`InfraStore`] — see the crate
//! docs for the exhaustive list and rationale.

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use rustra_core::{Error, ResourceKind, Result};
use rustra_storage::types::{
    ChannelMessageRecord, DecisionRecord, DefinitionRecord, GrantRecord, LogRecord,
    McpServerRecord, ResourceRecord, RunRecord, ScheduleRecord, StoredMessage, SubscriptionRecord,
    TaskRecord, Thread, TraceSpan, UiArtifactRecord, UserRecord, WorkflowSnapshot, WorkspaceRecord,
};
use rustra_storage::{
    AclStore, DefinitionStore, InfraStore, MemoryStore, ObservabilityStore, Page, TaskStore,
    WorkflowStore,
};
use serde_json::Value;

use crate::{codecs, coll, queries, FirebaseStorage};

impl FirebaseStorage {
    /// Delete every document matched by `query` (by resource name).
    /// TECH DEBT: not atomic — one DELETE request per document.
    async fn delete_matched(&self, query: Value) -> Result<()> {
        let docs = self.rest.run_query(query).await?;
        for doc in &docs {
            if let Some(name) = doc.get("name").and_then(Value::as_str) {
                self.rest.delete_document_by_name(name).await?;
            }
        }
        Ok(())
    }
}

fn decode_all<T>(docs: &[Value], decode: impl Fn(&Value) -> Result<T>) -> Result<Vec<T>> {
    docs.iter().map(decode).collect()
}

// ---------------------------------------------------------------------------
// MemoryStore
// ---------------------------------------------------------------------------

#[async_trait]
impl MemoryStore for FirebaseStorage {
    async fn create_thread(&self, thread: Thread) -> Result<()> {
        self.rest
            .patch_document(coll::THREADS, &thread.id, codecs::thread_to_doc(&thread))
            .await
    }

    async fn get_thread(&self, thread_id: &str) -> Result<Option<Thread>> {
        self.rest
            .get_document(coll::THREADS, thread_id)
            .await?
            .as_ref()
            .map(codecs::thread_from_doc)
            .transpose()
    }

    async fn update_thread(&self, thread: Thread) -> Result<()> {
        self.rest
            .update_existing_document(
                coll::THREADS,
                &thread.id,
                codecs::thread_to_doc(&thread),
                "thread",
            )
            .await
    }

    async fn delete_thread(&self, thread_id: &str) -> Result<()> {
        self.delete_matched(queries::messages_in_thread(thread_id))
            .await?;
        self.rest.delete_document(coll::THREADS, thread_id).await
    }

    async fn list_threads(&self, resource_id: &str, page: Page) -> Result<Vec<Thread>> {
        let docs = self
            .rest
            .run_query(queries::list_threads(resource_id, page))
            .await?;
        decode_all(&docs, codecs::thread_from_doc)
    }

    async fn append_message(&self, message: StoredMessage) -> Result<()> {
        self.rest
            .patch_document(
                coll::MESSAGES,
                &message.id,
                codecs::message_to_doc(&message),
            )
            .await
    }

    async fn recent_messages(&self, thread_id: &str, limit: usize) -> Result<Vec<StoredMessage>> {
        let docs = self
            .rest
            .run_query(queries::recent_messages(thread_id, limit))
            .await?;
        let mut messages = decode_all(&docs, codecs::message_from_doc)?;
        messages.reverse();
        Ok(messages)
    }

    async fn get_messages(&self, ids: &[String]) -> Result<Vec<StoredMessage>> {
        // TECH DEBT: one GET per id (no documents:batchGet); missing ids are
        // skipped, matching the reference backends.
        let mut messages = Vec::with_capacity(ids.len());
        for id in ids {
            if let Some(doc) = self.rest.get_document(coll::MESSAGES, id).await? {
                messages.push(codecs::message_from_doc(&doc)?);
            }
        }
        messages.sort_by_key(|m| m.created_at);
        Ok(messages)
    }

    async fn get_resource(&self, resource_id: &str) -> Result<Option<ResourceRecord>> {
        self.rest
            .get_document(coll::RESOURCES, resource_id)
            .await?
            .as_ref()
            .map(codecs::resource_from_doc)
            .transpose()
    }

    async fn save_resource(&self, resource: ResourceRecord) -> Result<()> {
        self.rest
            .patch_document(
                coll::RESOURCES,
                &resource.id,
                codecs::resource_to_doc(&resource),
            )
            .await
    }
}

// ---------------------------------------------------------------------------
// WorkflowStore
// ---------------------------------------------------------------------------

#[async_trait]
impl WorkflowStore for FirebaseStorage {
    async fn save_snapshot(&self, snapshot: WorkflowSnapshot) -> Result<()> {
        self.rest
            .patch_document(
                coll::WORKFLOW_SNAPSHOTS,
                &snapshot.run_id,
                codecs::snapshot_to_doc(&snapshot),
            )
            .await
    }

    async fn load_snapshot(&self, run_id: &str) -> Result<Option<WorkflowSnapshot>> {
        self.rest
            .get_document(coll::WORKFLOW_SNAPSHOTS, run_id)
            .await?
            .as_ref()
            .map(codecs::snapshot_from_doc)
            .transpose()
    }

    async fn list_snapshots(
        &self,
        resource_id: &str,
        workflow_id: Option<&str>,
        status: Option<&str>,
        page: Page,
    ) -> Result<Vec<WorkflowSnapshot>> {
        let docs = self
            .rest
            .run_query(queries::list_snapshots(
                resource_id,
                workflow_id,
                status,
                page,
            ))
            .await?;
        decode_all(&docs, codecs::snapshot_from_doc)
    }

    async fn delete_snapshot(&self, run_id: &str) -> Result<()> {
        self.rest
            .delete_document(coll::WORKFLOW_SNAPSHOTS, run_id)
            .await
    }
}

// ---------------------------------------------------------------------------
// TaskStore
// ---------------------------------------------------------------------------

#[async_trait]
impl TaskStore for FirebaseStorage {
    async fn insert_task(&self, task: TaskRecord) -> Result<()> {
        self.rest
            .patch_document(coll::TASKS, &task.id, codecs::task_to_doc(&task))
            .await
    }

    async fn update_task(&self, task: TaskRecord) -> Result<()> {
        self.rest
            .patch_document(coll::TASKS, &task.id, codecs::task_to_doc(&task))
            .await
    }

    async fn get_task(&self, task_id: &str) -> Result<Option<TaskRecord>> {
        self.rest
            .get_document(coll::TASKS, task_id)
            .await?
            .as_ref()
            .map(codecs::task_from_doc)
            .transpose()
    }

    async fn list_tasks(
        &self,
        user_id: &str,
        status: Option<&str>,
        page: Page,
    ) -> Result<Vec<TaskRecord>> {
        let docs = self
            .rest
            .run_query(queries::list_tasks(user_id, status, page))
            .await?;
        decode_all(&docs, codecs::task_from_doc)
    }

    async fn upsert_schedule(&self, schedule: ScheduleRecord) -> Result<()> {
        self.rest
            .patch_document(
                coll::SCHEDULES,
                &schedule.id,
                codecs::schedule_to_doc(&schedule),
            )
            .await
    }

    async fn get_schedule(&self, schedule_id: &str) -> Result<Option<ScheduleRecord>> {
        self.rest
            .get_document(coll::SCHEDULES, schedule_id)
            .await?
            .as_ref()
            .map(codecs::schedule_from_doc)
            .transpose()
    }

    async fn delete_schedule(&self, schedule_id: &str) -> Result<()> {
        self.rest
            .delete_document(coll::SCHEDULES, schedule_id)
            .await
    }

    async fn list_schedules(
        &self,
        user_id: Option<&str>,
        page: Page,
    ) -> Result<Vec<ScheduleRecord>> {
        let docs = self
            .rest
            .run_query(queries::list_schedules(user_id, page))
            .await?;
        decode_all(&docs, codecs::schedule_from_doc)
    }

    async fn due_schedules(&self, now: DateTime<Utc>) -> Result<Vec<ScheduleRecord>> {
        let docs = self.rest.run_query(queries::due_schedules(now)).await?;
        decode_all(&docs, codecs::schedule_from_doc)
    }

    async fn upsert_subscription(&self, sub: SubscriptionRecord) -> Result<()> {
        self.rest
            .patch_document(
                coll::SUBSCRIPTIONS,
                &sub.id,
                codecs::subscription_to_doc(&sub),
            )
            .await
    }

    async fn delete_subscription(&self, sub_id: &str) -> Result<()> {
        self.rest.delete_document(coll::SUBSCRIPTIONS, sub_id).await
    }

    async fn list_subscriptions(
        &self,
        user_id: Option<&str>,
        page: Page,
    ) -> Result<Vec<SubscriptionRecord>> {
        let docs = self
            .rest
            .run_query(queries::list_subscriptions(user_id, page))
            .await?;
        decode_all(&docs, codecs::subscription_from_doc)
    }

    async fn insert_decision(&self, decision: DecisionRecord) -> Result<()> {
        self.rest
            .patch_document(
                coll::DECISIONS,
                &decision.id,
                codecs::decision_to_doc(&decision),
            )
            .await
    }

    async fn update_decision(&self, decision: DecisionRecord) -> Result<()> {
        self.rest
            .patch_document(
                coll::DECISIONS,
                &decision.id,
                codecs::decision_to_doc(&decision),
            )
            .await
    }

    async fn get_decision(&self, decision_id: &str) -> Result<Option<DecisionRecord>> {
        self.rest
            .get_document(coll::DECISIONS, decision_id)
            .await?
            .as_ref()
            .map(codecs::decision_from_doc)
            .transpose()
    }

    async fn list_decisions(
        &self,
        user_id: &str,
        pending_only: bool,
        page: Page,
    ) -> Result<Vec<DecisionRecord>> {
        let docs = self
            .rest
            .run_query(queries::list_decisions(user_id, pending_only, page))
            .await?;
        decode_all(&docs, codecs::decision_from_doc)
    }
}

// ---------------------------------------------------------------------------
// DefinitionStore
// ---------------------------------------------------------------------------

#[async_trait]
impl DefinitionStore for FirebaseStorage {
    async fn put_definition(&self, mut record: DefinitionRecord) -> Result<DefinitionRecord> {
        // TECH DEBT: read-modify-write without a Firestore transaction —
        // concurrent writers to the same definition can race (should use
        // beginTransaction/commit).
        let max_docs = self
            .rest
            .run_query(queries::max_definition_version(record.kind, &record.id))
            .await?;
        let next_version = match max_docs.first() {
            Some(doc) => {
                let prev = codecs::definition_from_doc(doc)?;
                prev.version.checked_add(1).ok_or_else(|| {
                    Error::Storage(format!(
                        "definition {}/{}: version overflow (already at u32::MAX)",
                        prev.kind.as_str(),
                        prev.id
                    ))
                })?
            }
            None => 1,
        };

        // Demote whatever currently claims `latest`.
        let latest_docs = self
            .rest
            .run_query(queries::latest_definition_flags(record.kind, &record.id))
            .await?;
        for doc in &latest_docs {
            let mut prev = codecs::definition_from_doc(doc)?;
            prev.latest = false;
            let doc_id = codecs::definition_doc_id(prev.kind, &prev.id, prev.version);
            self.rest
                .patch_document(coll::DEFINITIONS, &doc_id, codecs::definition_to_doc(&prev))
                .await?;
        }

        record.version = next_version;
        record.latest = true;
        let doc_id = codecs::definition_doc_id(record.kind, &record.id, record.version);
        self.rest
            .patch_document(
                coll::DEFINITIONS,
                &doc_id,
                codecs::definition_to_doc(&record),
            )
            .await?;
        Ok(record)
    }

    async fn get_definition(
        &self,
        kind: ResourceKind,
        id: &str,
    ) -> Result<Option<DefinitionRecord>> {
        let docs = self
            .rest
            .run_query(queries::latest_definition(kind, id))
            .await?;
        docs.first().map(codecs::definition_from_doc).transpose()
    }

    async fn get_definition_version(
        &self,
        kind: ResourceKind,
        id: &str,
        version: u32,
    ) -> Result<Option<DefinitionRecord>> {
        let doc_id = codecs::definition_doc_id(kind, id, version);
        self.rest
            .get_document(coll::DEFINITIONS, &doc_id)
            .await?
            .as_ref()
            .map(codecs::definition_from_doc)
            .transpose()
    }

    async fn list_definitions(
        &self,
        kind: ResourceKind,
        owner_id: &str,
        include_shared: bool,
        page: Page,
    ) -> Result<Vec<DefinitionRecord>> {
        let docs = self
            .rest
            .run_query(queries::list_definitions(
                kind,
                owner_id,
                include_shared,
                page,
            ))
            .await?;
        decode_all(&docs, codecs::definition_from_doc)
    }

    async fn delete_definition(&self, kind: ResourceKind, id: &str) -> Result<()> {
        self.delete_matched(queries::definition_versions(kind, id))
            .await
    }
}

// ---------------------------------------------------------------------------
// AclStore
// ---------------------------------------------------------------------------

#[async_trait]
impl AclStore for FirebaseStorage {
    async fn upsert_user(&self, user: UserRecord) -> Result<()> {
        self.rest
            .patch_document(coll::USERS, &user.id, codecs::user_to_doc(&user))
            .await
    }

    async fn get_user(&self, user_id: &str) -> Result<Option<UserRecord>> {
        self.rest
            .get_document(coll::USERS, user_id)
            .await?
            .as_ref()
            .map(codecs::user_from_doc)
            .transpose()
    }

    async fn find_user_by_token_hash(&self, token_hash: &str) -> Result<Option<UserRecord>> {
        let docs = self
            .rest
            .run_query(queries::find_user_by_token_hash(token_hash))
            .await?;
        docs.first().map(codecs::user_from_doc).transpose()
    }

    async fn list_users(&self, page: Page) -> Result<Vec<UserRecord>> {
        let docs = self.rest.run_query(queries::list_users(page)).await?;
        decode_all(&docs, codecs::user_from_doc)
    }

    async fn insert_grant(&self, grant: GrantRecord) -> Result<()> {
        self.rest
            .patch_document(coll::GRANTS, &grant.id, codecs::grant_to_doc(&grant))
            .await
    }

    async fn delete_grant(&self, grant_id: &str) -> Result<()> {
        self.rest.delete_document(coll::GRANTS, grant_id).await
    }

    async fn list_grants_for_resource(
        &self,
        kind: ResourceKind,
        resource_id: &str,
    ) -> Result<Vec<GrantRecord>> {
        let docs = self
            .rest
            .run_query(queries::grants_for_resource(kind, resource_id))
            .await?;
        decode_all(&docs, codecs::grant_from_doc)
    }

    async fn list_grants_for_grantee(&self, grantee: &str) -> Result<Vec<GrantRecord>> {
        let docs = self
            .rest
            .run_query(queries::grants_for_grantee(grantee))
            .await?;
        decode_all(&docs, codecs::grant_from_doc)
    }
}

// ---------------------------------------------------------------------------
// Stubs: ObservabilityStore / InfraStore
// ---------------------------------------------------------------------------

fn not_implemented(method: &str) -> Error {
    Error::Config(format!(
        "{method} is not yet implemented for the Firebase backend; \
         see the TECH DEBT notes in the rustra-storage-firebase crate docs"
    ))
}

#[async_trait]
impl ObservabilityStore for FirebaseStorage {
    async fn insert_run(&self, _run: RunRecord) -> Result<()> {
        Err(not_implemented("ObservabilityStore::insert_run"))
    }

    async fn update_run(&self, _run: RunRecord) -> Result<()> {
        Err(not_implemented("ObservabilityStore::update_run"))
    }

    async fn get_run(&self, _run_id: &str) -> Result<Option<RunRecord>> {
        Err(not_implemented("ObservabilityStore::get_run"))
    }

    async fn list_runs(
        &self,
        _user_id: &str,
        _kind: Option<&str>,
        _status: Option<&str>,
        _page: Page,
    ) -> Result<Vec<RunRecord>> {
        Err(not_implemented("ObservabilityStore::list_runs"))
    }

    async fn insert_spans(&self, _spans: Vec<TraceSpan>) -> Result<()> {
        Err(not_implemented("ObservabilityStore::insert_spans"))
    }

    async fn list_spans(&self, _trace_id: &str) -> Result<Vec<TraceSpan>> {
        Err(not_implemented("ObservabilityStore::list_spans"))
    }

    async fn insert_log(&self, _log: LogRecord) -> Result<()> {
        Err(not_implemented("ObservabilityStore::insert_log"))
    }

    async fn list_logs(
        &self,
        _user_id: Option<&str>,
        _run_id: Option<&str>,
        _page: Page,
    ) -> Result<Vec<LogRecord>> {
        Err(not_implemented("ObservabilityStore::list_logs"))
    }
}

#[async_trait]
impl InfraStore for FirebaseStorage {
    async fn upsert_workspace(&self, _ws: WorkspaceRecord) -> Result<()> {
        Err(not_implemented("InfraStore::upsert_workspace"))
    }

    async fn get_workspace(&self, _ws_id: &str) -> Result<Option<WorkspaceRecord>> {
        Err(not_implemented("InfraStore::get_workspace"))
    }

    async fn list_workspaces(&self, _user_id: &str, _page: Page) -> Result<Vec<WorkspaceRecord>> {
        Err(not_implemented("InfraStore::list_workspaces"))
    }

    async fn delete_workspace(&self, _ws_id: &str) -> Result<()> {
        Err(not_implemented("InfraStore::delete_workspace"))
    }

    async fn upsert_mcp_server(&self, _server: McpServerRecord) -> Result<()> {
        Err(not_implemented("InfraStore::upsert_mcp_server"))
    }

    async fn get_mcp_server(&self, _server_id: &str) -> Result<Option<McpServerRecord>> {
        Err(not_implemented("InfraStore::get_mcp_server"))
    }

    async fn list_mcp_servers(
        &self,
        _user_id: &str,
        _include_shared: bool,
        _page: Page,
    ) -> Result<Vec<McpServerRecord>> {
        Err(not_implemented("InfraStore::list_mcp_servers"))
    }

    async fn delete_mcp_server(&self, _server_id: &str) -> Result<()> {
        Err(not_implemented("InfraStore::delete_mcp_server"))
    }

    async fn upsert_ui_artifact(&self, _artifact: UiArtifactRecord) -> Result<()> {
        Err(not_implemented("InfraStore::upsert_ui_artifact"))
    }

    async fn get_ui_artifact(&self, _artifact_id: &str) -> Result<Option<UiArtifactRecord>> {
        Err(not_implemented("InfraStore::get_ui_artifact"))
    }

    async fn list_ui_artifacts(
        &self,
        _owner_id: &str,
        _page: Page,
    ) -> Result<Vec<UiArtifactRecord>> {
        Err(not_implemented("InfraStore::list_ui_artifacts"))
    }

    async fn delete_ui_artifact(&self, _artifact_id: &str) -> Result<()> {
        Err(not_implemented("InfraStore::delete_ui_artifact"))
    }

    async fn insert_channel_message(&self, _message: ChannelMessageRecord) -> Result<()> {
        Err(not_implemented("InfraStore::insert_channel_message"))
    }

    async fn list_channel_messages(
        &self,
        _user_id: &str,
        _channel: Option<&str>,
        _page: Page,
    ) -> Result<Vec<ChannelMessageRecord>> {
        Err(not_implemented("InfraStore::list_channel_messages"))
    }

    async fn mark_message_read(&self, _message_id: &str) -> Result<()> {
        Err(not_implemented("InfraStore::mark_message_read"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rustra_storage::Storage;

    /// The blanket `Storage` supertrait must be satisfied even with the
    /// stubbed domains.
    #[test]
    fn firebase_storage_satisfies_storage_supertrait() {
        fn assert_storage<T: Storage>() {}
        assert_storage::<FirebaseStorage>();
    }
}
