//! Memory as a [`ContextSource`]: working memory and semantic recall
//! participate in the same dynamic-attachment model as skills and knowledge.
//! (Recent thread history is replayed natively by the agent loop, not here —
//! it is conversation, not attached context.)

use async_trait::async_trait;
use serde_json::json;
use std::sync::Arc;

use rustra_core::{
    ContextCandidate, ContextFragment, ContextKind, ContextRequest, ContextSource, Error, Result,
};

use crate::{stored_message_text, Memory};

const WORKING_MEMORY_ID: &str = "working_memory";
const SEMANTIC_RECALL_ID: &str = "semantic_recall";

/// Offers two candidates per request: the user's working memory document
/// (always relevant) and semantic recall results for the query.
pub struct MemoryContextSource {
    memory: Arc<Memory>,
}

impl MemoryContextSource {
    pub fn new(memory: Arc<Memory>) -> Self {
        Self { memory }
    }
}

#[async_trait]
impl ContextSource for MemoryContextSource {
    fn id(&self) -> &str {
        "memory"
    }

    fn kind(&self) -> ContextKind {
        ContextKind::Memory
    }

    async fn candidates(&self, req: &ContextRequest) -> Result<Vec<ContextCandidate>> {
        let mut candidates = Vec::new();
        if self.memory.config().working_memory.enabled {
            candidates.push(ContextCandidate {
                id: WORKING_MEMORY_ID.into(),
                kind: ContextKind::Memory,
                title: "Working memory".into(),
                description: "Durable facts and preferences for this user".into(),
                score: 1.0,
                estimated_chars: 1024,
            });
        }
        if self.memory.config().semantic_recall.is_some() {
            candidates.push(ContextCandidate {
                id: SEMANTIC_RECALL_ID.into(),
                kind: ContextKind::Memory,
                title: "Relevant past conversation".into(),
                description: "Semantically similar messages from prior conversations".into(),
                score: 0.9,
                estimated_chars: 2048,
            });
        }
        let _ = req;
        Ok(candidates)
    }

    async fn load(&self, candidate_id: &str, req: &ContextRequest) -> Result<ContextFragment> {
        let user_id = req.runtime.user_id();
        match candidate_id {
            WORKING_MEMORY_ID => {
                let content = self
                    .memory
                    .get_working_memory(user_id)
                    .await?
                    .unwrap_or_else(|| "(empty)".to_string());
                Ok(ContextFragment {
                    id: WORKING_MEMORY_ID.into(),
                    kind: ContextKind::Memory,
                    title: "Working memory".into(),
                    content,
                    metadata: json!({ "resource_id": user_id }),
                })
            }
            SEMANTIC_RECALL_ID => {
                let thread_id = req.thread_id.clone().unwrap_or_default();
                let recalled = self.memory.recall(&thread_id, user_id, &req.query).await?;
                let content = if recalled.semantic.is_empty() {
                    "(no relevant past conversation found)".to_string()
                } else {
                    recalled
                        .semantic
                        .iter()
                        .map(|m| format!("[{} @ {}] {}", m.role, m.created_at, stored_message_text(m)))
                        .collect::<Vec<_>>()
                        .join("\n")
                };
                Ok(ContextFragment {
                    id: SEMANTIC_RECALL_ID.into(),
                    kind: ContextKind::Memory,
                    title: "Relevant past conversation".into(),
                    content,
                    metadata: json!({ "count": recalled.semantic.len() }),
                })
            }
            other => Err(Error::not_found("memory context", other)),
        }
    }
}
