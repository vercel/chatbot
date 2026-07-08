//! # rustra-memory
//!
//! The Rust analogue of `@mastra/memory`. Memory is scoped by two
//! identifiers, exactly as in Mastra:
//!
//! * **resource** (`resource_id`) — the stable owner scope. In Rustra this is
//!   the user id, which is what makes memory per-user by default.
//! * **thread** (`thread_id`) — one conversation.
//!
//! Three kinds of memory, all on by default for the main agent:
//!
//! * **Message history** (short-term): the last `last_messages` turns of the
//!   active thread, replayed into the model conversation.
//! * **Working memory** (long-term): a persistent, agent-maintained document
//!   scoped to the resource, updated through the
//!   [`working_memory_tool`](Memory::working_memory_tool).
//! * **Semantic recall** (long-term): vector search over past messages,
//!   thread- or resource-scoped, configured with `top_k`.
//!
//! [`MemoryContextSource`] exposes working memory and semantic recall through
//! the framework-wide dynamic context attachment model.

mod context_source;
mod processor;

pub use context_source::MemoryContextSource;
pub use processor::{CharBudgetProcessor, MemoryProcessor};

use chrono::Utc;
use serde_json::{json, Value};
use std::sync::Arc;

use rustra_core::{new_id, Error, FunctionTool, Result};
use rustra_llm::{ContentBlock, Message, Role};
use rustra_storage::types::{ResourceRecord, StoredMessage, Thread};
use rustra_storage::{Embedder, Page, SharedStorage, SharedVectorStore};

/// Vector index holding message embeddings.
const MESSAGE_INDEX: &str = "rustra_memory_messages";

/// Whether semantic recall searches one thread or the whole resource
/// (all of a user's conversations).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum RecallScope {
    Thread,
    #[default]
    Resource,
}

/// Semantic recall configuration (Mastra `semanticRecall`).
#[derive(Debug, Clone)]
pub struct SemanticRecallConfig {
    /// Number of past messages to retrieve.
    pub top_k: usize,
    pub scope: RecallScope,
}

impl Default for SemanticRecallConfig {
    fn default() -> Self {
        Self { top_k: 4, scope: RecallScope::Resource }
    }
}

/// Working memory configuration (Mastra `workingMemory`).
#[derive(Debug, Clone)]
pub struct WorkingMemoryConfig {
    pub enabled: bool,
    /// Markdown template used to seed working memory the first time.
    pub template: Option<String>,
}

impl Default for WorkingMemoryConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            template: Some(
                "# User Profile\n\n- Name:\n- Preferences:\n- Current goals:\n- Open items:\n"
                    .to_string(),
            ),
        }
    }
}

/// Memory options (Mastra `Memory` constructor `options`).
#[derive(Debug, Clone)]
pub struct MemoryConfig {
    /// How many recent thread messages to replay (short-term memory).
    pub last_messages: usize,
    /// `None` disables semantic recall.
    pub semantic_recall: Option<SemanticRecallConfig>,
    pub working_memory: WorkingMemoryConfig,
}

impl Default for MemoryConfig {
    fn default() -> Self {
        Self {
            last_messages: 20,
            semantic_recall: Some(SemanticRecallConfig::default()),
            working_memory: WorkingMemoryConfig::default(),
        }
    }
}

/// What memory recalled for one agent turn.
#[derive(Debug, Clone, Default)]
pub struct RecalledMemory {
    /// Recent thread history, chronological, converted for the model.
    pub recent: Vec<Message>,
    /// Semantically similar past messages (deduplicated against `recent`).
    pub semantic: Vec<StoredMessage>,
    /// The resource's working memory document.
    pub working_memory: Option<String>,
}

/// The memory subsystem: persistence + recall over a storage backend and an
/// optional vector store/embedder pair.
pub struct Memory {
    storage: SharedStorage,
    vector: Option<SharedVectorStore>,
    embedder: Option<Arc<dyn Embedder>>,
    processors: Vec<Arc<dyn MemoryProcessor>>,
    config: MemoryConfig,
}

impl Memory {
    pub fn new(storage: SharedStorage) -> Self {
        Self { storage, vector: None, embedder: None, processors: Vec::new(), config: MemoryConfig::default() }
    }

    pub fn with_config(mut self, config: MemoryConfig) -> Self {
        self.config = config;
        self
    }

    /// Enable semantic recall by providing the vector backend + embedder.
    pub fn with_vector(mut self, vector: SharedVectorStore, embedder: Arc<dyn Embedder>) -> Self {
        self.vector = Some(vector);
        self.embedder = Some(embedder);
        self
    }

    /// Add a processor applied to recalled history (filtering, budgeting).
    pub fn with_processor(mut self, processor: Arc<dyn MemoryProcessor>) -> Self {
        self.processors.push(processor);
        self
    }

    pub fn config(&self) -> &MemoryConfig {
        &self.config
    }

    // -- Threads ------------------------------------------------------------

    pub async fn create_thread(
        &self,
        resource_id: &str,
        title: Option<String>,
    ) -> Result<Thread> {
        let mut thread = Thread::new(resource_id);
        thread.title = title;
        self.storage.create_thread(thread.clone()).await?;
        Ok(thread)
    }

    /// Fetch a thread, verifying it belongs to `resource_id` (a thread is
    /// never served across user scopes).
    pub async fn get_thread(&self, thread_id: &str, resource_id: &str) -> Result<Thread> {
        let thread = self
            .storage
            .get_thread(thread_id)
            .await?
            .ok_or_else(|| Error::not_found("thread", thread_id))?;
        if thread.resource_id != resource_id {
            return Err(Error::PermissionDenied(format!(
                "thread `{thread_id}` does not belong to resource `{resource_id}`"
            )));
        }
        Ok(thread)
    }

    pub async fn list_threads(&self, resource_id: &str, page: Page) -> Result<Vec<Thread>> {
        self.storage.list_threads(resource_id, page).await
    }

    // -- Messages -----------------------------------------------------------

    /// Persist one conversation message and index it for semantic recall.
    pub async fn save_message(
        &self,
        thread_id: &str,
        resource_id: &str,
        message: &Message,
    ) -> Result<StoredMessage> {
        let stored = StoredMessage {
            id: new_id("msg"),
            thread_id: thread_id.to_string(),
            resource_id: resource_id.to_string(),
            role: match message.role {
                Role::User => "user".to_string(),
                Role::Assistant => "assistant".to_string(),
            },
            content: serde_json::to_value(&message.content)?,
            created_at: Utc::now(),
        };
        self.storage.append_message(stored.clone()).await?;

        // Touch the thread so it sorts to the top of listings.
        if let Some(mut thread) = self.storage.get_thread(thread_id).await? {
            thread.updated_at = Utc::now();
            self.storage.update_thread(thread).await?;
        }

        // Index text content for semantic recall (best effort — an indexing
        // failure must not lose the message).
        if let (Some(vector), Some(embedder), Some(_)) =
            (&self.vector, &self.embedder, &self.config.semantic_recall)
        {
            let text = message.text();
            if !text.trim().is_empty() {
                let result: Result<()> = async {
                    vector.create_index(MESSAGE_INDEX, embedder.dimension()).await?;
                    let vectors = embedder.embed(std::slice::from_ref(&text)).await?;
                    vector
                        .upsert(
                            MESSAGE_INDEX,
                            vec![(
                                stored.id.clone(),
                                vectors.into_iter().next().unwrap_or_default(),
                                json!({
                                    "resource_id": resource_id,
                                    "thread_id": thread_id,
                                }),
                            )],
                        )
                        .await
                }
                .await;
                if let Err(e) = result {
                    tracing::warn!(error = %e, "semantic recall indexing failed");
                }
            }
        }
        Ok(stored)
    }

    /// Recall everything relevant for the next model turn.
    pub async fn recall(
        &self,
        thread_id: &str,
        resource_id: &str,
        query: &str,
    ) -> Result<RecalledMemory> {
        let mut stored_recent =
            self.storage.recent_messages(thread_id, self.config.last_messages).await?;
        for processor in &self.processors {
            stored_recent = processor.process(stored_recent);
        }
        let recent_ids: Vec<String> = stored_recent.iter().map(|m| m.id.clone()).collect();
        let recent = stored_recent.iter().filter_map(to_model_message).collect();

        let semantic = self.semantic_recall(thread_id, resource_id, query, &recent_ids).await?;

        let working_memory = if self.config.working_memory.enabled {
            self.get_working_memory(resource_id).await?
        } else {
            None
        };

        Ok(RecalledMemory { recent, semantic, working_memory })
    }

    async fn semantic_recall(
        &self,
        thread_id: &str,
        resource_id: &str,
        query: &str,
        exclude_ids: &[String],
    ) -> Result<Vec<StoredMessage>> {
        let (Some(config), Some(vector), Some(embedder)) =
            (&self.config.semantic_recall, &self.vector, &self.embedder)
        else {
            return Ok(Vec::new());
        };
        if query.trim().is_empty() {
            return Ok(Vec::new());
        }
        let query_vec = embedder.embed(&[query.to_string()]).await?;
        // Over-fetch so scope filtering + dedup still leaves top_k results.
        let hits = match vector
            .query(MESSAGE_INDEX, &query_vec[0], config.top_k * 4 + exclude_ids.len())
            .await
        {
            Ok(hits) => hits,
            // Index does not exist until the first message is saved.
            Err(Error::NotFound { .. }) => return Ok(Vec::new()),
            Err(e) => return Err(e),
        };
        let ids: Vec<String> = hits
            .into_iter()
            .filter(|hit| {
                // Per-user isolation: only this resource's messages, ever.
                hit.metadata["resource_id"] == resource_id
                    && match config.scope {
                        RecallScope::Thread => hit.metadata["thread_id"] == thread_id,
                        RecallScope::Resource => true,
                    }
                    && !exclude_ids.contains(&hit.id)
            })
            .take(config.top_k)
            .map(|hit| hit.id)
            .collect();
        self.storage.get_messages(&ids).await
    }

    // -- Working memory -----------------------------------------------------

    pub async fn get_working_memory(&self, resource_id: &str) -> Result<Option<String>> {
        let existing = self.storage.get_resource(resource_id).await?;
        match existing {
            Some(r) => Ok(r.working_memory),
            None => Ok(self.config.working_memory.template.clone()),
        }
    }

    pub async fn update_working_memory(&self, resource_id: &str, content: &str) -> Result<()> {
        let mut record = self.storage.get_resource(resource_id).await?.unwrap_or(ResourceRecord {
            id: resource_id.to_string(),
            working_memory: None,
            metadata: Value::Null,
            updated_at: Utc::now(),
        });
        record.working_memory = Some(content.to_string());
        record.updated_at = Utc::now();
        self.storage.save_resource(record).await
    }

    /// The tool agents use to persist long-term facts, mirroring Mastra's
    /// working-memory tool: the model rewrites the whole document.
    pub fn working_memory_tool(self: &Arc<Self>) -> FunctionTool {
        let memory = Arc::clone(self);
        FunctionTool::new(
            "update_working_memory",
            "Replace your persistent working memory document for this user. Use it to remember \
             durable facts, preferences, and goals across conversations. Always write the \
             complete updated document.",
            json!({
                "type": "object",
                "properties": {
                    "content": {
                        "type": "string",
                        "description": "The full, updated working memory document (markdown)."
                    }
                },
                "required": ["content"]
            }),
            move |input, ctx| {
                let memory = Arc::clone(&memory);
                async move {
                    let content = input["content"]
                        .as_str()
                        .ok_or_else(|| Error::Validation("`content` must be a string".into()))?;
                    memory.update_working_memory(ctx.runtime.user_id(), content).await?;
                    Ok(json!({ "ok": true }))
                }
            },
        )
    }
}

/// Convert a stored message back into a model message. Returns `None` for
/// roles the model conversation cannot replay (e.g. `system` annotations).
pub fn to_model_message(stored: &StoredMessage) -> Option<Message> {
    let role = match stored.role.as_str() {
        "user" => Role::User,
        "assistant" => Role::Assistant,
        _ => return None,
    };
    let content: Vec<ContentBlock> = serde_json::from_value(stored.content.clone()).ok()?;
    Some(Message { role, content })
}

/// Plain-text rendering of a stored message (for semantic recall fragments).
pub fn stored_message_text(stored: &StoredMessage) -> String {
    serde_json::from_value::<Vec<ContentBlock>>(stored.content.clone())
        .map(|blocks| {
            blocks
                .iter()
                .filter_map(|b| match b {
                    ContentBlock::Text { text } => Some(text.clone()),
                    _ => None,
                })
                .collect::<Vec<_>>()
                .join("\n")
        })
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use rustra_storage::{InMemoryStorage, InMemoryVectorStore, MockEmbedder};

    fn memory_with_vector() -> Arc<Memory> {
        Arc::new(
            Memory::new(Arc::new(InMemoryStorage::new())).with_vector(
                Arc::new(InMemoryVectorStore::new()),
                Arc::new(MockEmbedder::default()),
            ),
        )
    }

    #[tokio::test]
    async fn recall_returns_recent_and_working_memory() {
        let memory = memory_with_vector();
        let thread = memory.create_thread("user-1", Some("test".into())).await.unwrap();

        memory
            .save_message(&thread.id, "user-1", &Message::user("hello there"))
            .await
            .unwrap();
        memory
            .save_message(&thread.id, "user-1", &Message::assistant("hi! how can I help?"))
            .await
            .unwrap();

        let recalled = memory.recall(&thread.id, "user-1", "greetings").await.unwrap();
        assert_eq!(recalled.recent.len(), 2);
        // Default template is served before any update.
        assert!(recalled.working_memory.unwrap().contains("User Profile"));
    }

    #[tokio::test]
    async fn semantic_recall_is_resource_scoped() {
        let memory = memory_with_vector();
        let alice_thread = memory.create_thread("alice", None).await.unwrap();
        let bob_thread = memory.create_thread("bob", None).await.unwrap();

        memory
            .save_message(
                &alice_thread.id,
                "alice",
                &Message::user("my kubernetes deployment keeps crashing"),
            )
            .await
            .unwrap();
        memory
            .save_message(
                &bob_thread.id,
                "bob",
                &Message::user("kubernetes deployment strategies for canary rollouts"),
            )
            .await
            .unwrap();

        // A new thread for alice: recall should find her old kubernetes
        // message, never bob's.
        let new_thread = memory.create_thread("alice", None).await.unwrap();
        let recalled =
            memory.recall(&new_thread.id, "alice", "kubernetes deployment").await.unwrap();
        assert!(!recalled.semantic.is_empty());
        for msg in &recalled.semantic {
            assert_eq!(msg.resource_id, "alice");
        }
    }

    #[tokio::test]
    async fn working_memory_tool_updates_document() {
        use rustra_core::{Principal, RuntimeContext, Tool, ToolContext};

        let memory = memory_with_vector();
        let tool = memory.working_memory_tool();
        let ctx = ToolContext::new(RuntimeContext::new(Principal::user("user-9")));
        tool.execute(json!({"content": "# Notes\n- likes rust"}), &ctx).await.unwrap();

        let wm = memory.get_working_memory("user-9").await.unwrap().unwrap();
        assert!(wm.contains("likes rust"));
    }

    #[tokio::test]
    async fn threads_are_isolated_across_users() {
        let memory = memory_with_vector();
        let thread = memory.create_thread("alice", None).await.unwrap();
        let err = memory.get_thread(&thread.id, "mallory").await.unwrap_err();
        assert!(matches!(err, Error::PermissionDenied(_)));
    }
}
