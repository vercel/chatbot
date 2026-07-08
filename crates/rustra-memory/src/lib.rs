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

mod config;
mod context_source;
mod processor;

pub use config::{MemoryConfig, RecallScope, SemanticRecallConfig, WorkingMemoryConfig};
pub use context_source::MemoryContextSource;
pub use processor::{CharBudgetProcessor, MemoryProcessor};

use chrono::Utc;
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

use rustra_core::{new_id, Error, FunctionTool, Result};
use rustra_llm::{ContentBlock, Message, Role};
use rustra_storage::types::{ResourceRecord, StoredMessage, Thread};
use rustra_storage::{Embedder, Page, SharedStorage, SharedVectorStore};

/// Vector index holding message embeddings.
const MESSAGE_INDEX: &str = "rustra_memory_messages";

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

/// Vector store + embedder pair — semantic recall needs both or neither,
/// so they are stored as one unit.
struct SemanticIndex {
    vector: SharedVectorStore,
    embedder: Arc<dyn Embedder>,
}

/// Metadata stored alongside each message embedding. The field names are part
/// of the stored format and must keep matching the metadata filter in
/// `semantic_recall`.
#[derive(serde::Serialize)]
struct MessageVectorMetadata<'a> {
    resource_id: &'a str,
    thread_id: &'a str,
}

/// The memory subsystem: persistence + recall over a storage backend and an
/// optional vector store/embedder pair.
pub struct Memory {
    storage: SharedStorage,
    semantic: Option<SemanticIndex>,
    processors: Vec<Arc<dyn MemoryProcessor>>,
    config: MemoryConfig,
}

impl Memory {
    /// Build a memory subsystem over `storage` with the default
    /// [`MemoryConfig`]. Semantic recall stays inert until
    /// [`Memory::with_vector`] supplies a vector store and embedder.
    pub fn new(storage: SharedStorage) -> Self {
        Self {
            storage,
            semantic: None,
            processors: Vec::new(),
            config: MemoryConfig::default(),
        }
    }

    /// Replace the memory options.
    pub fn with_config(mut self, config: MemoryConfig) -> Self {
        self.config = config;
        self
    }

    /// Enable semantic recall by providing the vector backend + embedder.
    pub fn with_vector(mut self, vector: SharedVectorStore, embedder: Arc<dyn Embedder>) -> Self {
        self.semantic = Some(SemanticIndex { vector, embedder });
        self
    }

    /// Add a processor applied to recalled history (filtering, budgeting).
    pub fn with_processor(mut self, processor: Arc<dyn MemoryProcessor>) -> Self {
        self.processors.push(processor);
        self
    }

    /// The active memory options.
    pub fn config(&self) -> &MemoryConfig {
        &self.config
    }

    // -- Threads ------------------------------------------------------------

    /// Create a new conversation thread owned by `resource_id`, optionally
    /// titled.
    pub async fn create_thread(&self, resource_id: &str, title: Option<String>) -> Result<Thread> {
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

    /// Page through `resource_id`'s threads, most recently updated first.
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
            role: role_str(message.role).to_string(),
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
        if self.config.semantic_recall.is_some() {
            let text = message.text();
            if !text.trim().is_empty() {
                if let Err(e) = self.index_message(&stored, &text).await {
                    tracing::warn!(error = %e, "semantic recall indexing failed");
                }
            }
        }
        Ok(stored)
    }

    /// Embed `text` and upsert it into the message vector index. A no-op when
    /// no vector store/embedder pair is configured.
    async fn index_message(&self, stored: &StoredMessage, text: &str) -> Result<()> {
        let Some(index) = &self.semantic else {
            return Ok(());
        };
        index
            .vector
            .create_index(MESSAGE_INDEX, index.embedder.dimension())
            .await?;
        let vectors = index.embedder.embed(&[text.to_string()]).await?;
        let Some(embedding) = vectors.into_iter().next() else {
            return Err(Error::Model(
                "embedder returned no vector for message".into(),
            ));
        };
        index
            .vector
            .upsert(
                MESSAGE_INDEX,
                vec![(
                    stored.id.clone(),
                    embedding,
                    serde_json::to_value(MessageVectorMetadata {
                        resource_id: &stored.resource_id,
                        thread_id: &stored.thread_id,
                    })?,
                )],
            )
            .await
    }

    /// Recall everything relevant for the next model turn.
    pub async fn recall(
        &self,
        thread_id: &str,
        resource_id: &str,
        query: &str,
    ) -> Result<RecalledMemory> {
        let stored_recent = self.processed_recent(thread_id, resource_id).await?;
        let recent_ids: Vec<String> = stored_recent.iter().map(|m| m.id.clone()).collect();
        let recent = stored_recent.iter().filter_map(to_model_message).collect();

        let semantic = self
            .semantic_recall(thread_id, resource_id, query, &recent_ids)
            .await?;

        let working_memory = if self.config.working_memory.enabled {
            self.get_working_memory(resource_id).await?
        } else {
            None
        };

        Ok(RecalledMemory {
            recent,
            semantic,
            working_memory,
        })
    }

    /// Semantic recall only: past messages similar to `query`, excluding
    /// anything the recent history of [`Memory::recall`] would already
    /// replay. Empty when semantic recall is disabled or unconfigured.
    pub async fn recall_semantic(
        &self,
        thread_id: &str,
        resource_id: &str,
        query: &str,
    ) -> Result<Vec<StoredMessage>> {
        let recent_ids: Vec<String> = self
            .processed_recent(thread_id, resource_id)
            .await?
            .into_iter()
            .map(|m| m.id)
            .collect();
        self.semantic_recall(thread_id, resource_id, query, &recent_ids)
            .await
    }

    /// Recent thread history after the processor pipeline, chronological.
    async fn processed_recent(
        &self,
        thread_id: &str,
        resource_id: &str,
    ) -> Result<Vec<StoredMessage>> {
        let mut stored_recent = self
            .storage
            .recent_messages(thread_id, self.config.last_messages)
            .await?;
        // Defense-in-depth: recent history is resource-scoped even if the
        // caller passes an unverified thread_id.
        stored_recent.retain(|m| m.resource_id == resource_id);
        for processor in &self.processors {
            stored_recent = processor.process(stored_recent);
        }
        Ok(stored_recent)
    }

    async fn semantic_recall(
        &self,
        thread_id: &str,
        resource_id: &str,
        query: &str,
        exclude_ids: &[String],
    ) -> Result<Vec<StoredMessage>> {
        let (Some(config), Some(index)) = (&self.config.semantic_recall, &self.semantic) else {
            return Ok(Vec::new());
        };
        if query.trim().is_empty() {
            return Ok(Vec::new());
        }
        let query_vec = index.embedder.embed(&[query.to_string()]).await?;
        let Some(query_embedding) = query_vec.first() else {
            return Err(Error::Model(
                "embedder returned no vector for recall query".into(),
            ));
        };
        // Over-fetch so scope filtering + dedup still leaves top_k results.
        let hits = match index
            .vector
            .query(
                MESSAGE_INDEX,
                query_embedding,
                config
                    .top_k
                    .saturating_mul(4)
                    .saturating_add(exclude_ids.len()),
            )
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

    /// The resource's working memory document, falling back to the
    /// configured seed template when none has been stored yet.
    pub async fn get_working_memory(&self, resource_id: &str) -> Result<Option<String>> {
        Ok(self
            .storage
            .get_resource(resource_id)
            .await?
            .and_then(|r| r.working_memory)
            .or_else(|| self.config.working_memory.template.clone()))
    }

    /// Replace the resource's working memory document, creating the resource
    /// record on first write.
    pub async fn update_working_memory(&self, resource_id: &str, content: &str) -> Result<()> {
        let mut record = self
            .storage
            .get_resource(resource_id)
            .await?
            .unwrap_or_else(|| ResourceRecord {
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
                    memory
                        .update_working_memory(ctx.runtime.user_id(), content)
                        .await?;
                    Ok(json!({ "ok": true }))
                }
            },
        )
    }
}

/// The storage spelling of a model role. [`to_model_message`] holds the
/// inverse (str -> [`Role`]) mapping.
fn role_str(role: Role) -> &'static str {
    match role {
        Role::User => "user",
        Role::Assistant => "assistant",
    }
}

/// Convert a stored message back into a model message. Returns `None` for
/// roles the model conversation cannot replay (e.g. `system` annotations)
/// and for stored content that no longer decodes as content blocks.
pub fn to_model_message(stored: &StoredMessage) -> Option<Message> {
    let role = match stored.role.as_str() {
        "user" => Role::User,
        "assistant" => Role::Assistant,
        _ => return None,
    };
    let content = match Vec::<ContentBlock>::deserialize(&stored.content) {
        Ok(content) => content,
        Err(e) => {
            tracing::warn!(
                message_id = %stored.id,
                error = %e,
                "stored message content failed to decode; omitting from replay"
            );
            return None;
        }
    };
    Some(Message { role, content })
}

/// Plain-text rendering of a stored message (for semantic recall fragments).
pub fn stored_message_text(stored: &StoredMessage) -> String {
    Vec::<ContentBlock>::deserialize(&stored.content)
        .map(|blocks| {
            blocks
                .into_iter()
                .filter_map(|b| match b {
                    ContentBlock::Text { text } => Some(text),
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
        Arc::new(Memory::new(Arc::new(InMemoryStorage::new())).with_vector(
            Arc::new(InMemoryVectorStore::new()),
            Arc::new(MockEmbedder::default()),
        ))
    }

    #[tokio::test]
    async fn recall_returns_recent_and_working_memory() {
        let memory = memory_with_vector();
        let thread = memory
            .create_thread("user-1", Some("test".into()))
            .await
            .unwrap();

        memory
            .save_message(&thread.id, "user-1", &Message::user("hello there"))
            .await
            .unwrap();
        memory
            .save_message(
                &thread.id,
                "user-1",
                &Message::assistant("hi! how can I help?"),
            )
            .await
            .unwrap();

        let recalled = memory
            .recall(&thread.id, "user-1", "greetings")
            .await
            .unwrap();
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
        let recalled = memory
            .recall(&new_thread.id, "alice", "kubernetes deployment")
            .await
            .unwrap();
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
        tool.execute(json!({"content": "# Notes\n- likes rust"}), &ctx)
            .await
            .unwrap();

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
