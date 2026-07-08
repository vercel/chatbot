use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::error::Result;
use crate::runtime_context::RuntimeContext;

/// The category of a context source. The assembler uses this for budgeting
/// and ordering, and observability records which kinds were attached.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ContextKind {
    Skill,
    Knowledge,
    Memory,
    WorkspaceFile,
    UserProfile,
    ToolConfig,
    PriorRun,
    Other,
}

/// Declarative trigger conditions describing *when* a context source is
/// relevant. Mirrors the trigger/description metadata of the Agent Skills
/// convention: sources are matched against the request before anything is
/// loaded into the prompt (progressive disclosure).
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TriggerCondition {
    /// Case-insensitive keywords; any match makes the candidate relevant.
    #[serde(default)]
    pub keywords: Vec<String>,
    /// Regex patterns matched against the request text.
    #[serde(default)]
    pub patterns: Vec<String>,
    /// If true the source is always offered as a candidate (e.g. working
    /// memory, user profile).
    #[serde(default)]
    pub always: bool,
}

impl TriggerCondition {
    pub fn always() -> Self {
        Self { always: true, ..Default::default() }
    }

    /// Cheap lexical relevance score in `[0, 1]`. Sources can use this as a
    /// baseline and layer semantic scoring on top.
    pub fn score(&self, request_text: &str) -> f32 {
        if self.always {
            return 1.0;
        }
        let text = request_text.to_lowercase();
        let mut hits = 0usize;
        let mut total = 0usize;
        for kw in &self.keywords {
            total += 1;
            if text.contains(&kw.to_lowercase()) {
                hits += 1;
            }
        }
        for pat in &self.patterns {
            total += 1;
            if regex_lite_match(pat, &text) {
                hits += 1;
            }
        }
        if total == 0 {
            0.0
        } else {
            hits as f32 / total as f32
        }
    }
}

/// Minimal glob-ish pattern match (`*` wildcard only) so core stays
/// dependency-free. Sources needing real regexes implement their own scoring.
fn regex_lite_match(pattern: &str, text: &str) -> bool {
    let parts: Vec<&str> = pattern.split('*').collect();
    let mut pos = 0usize;
    for (i, part) in parts.iter().enumerate() {
        if part.is_empty() {
            continue;
        }
        match text[pos..].find(&part.to_lowercase()) {
            Some(found) => {
                if i == 0 && found != 0 && !pattern.starts_with('*') {
                    return false;
                }
                pos += found + part.len();
            }
            None => return false,
        }
    }
    true
}

/// What the agent is about to do, given to every context source so it can
/// decide whether (and what) to offer.
#[derive(Debug, Clone)]
pub struct ContextRequest {
    /// The triggering text: the latest user message or task description.
    pub query: String,
    /// The agent asking for context.
    pub agent_id: String,
    /// Active memory thread, if any.
    pub thread_id: Option<String>,
    /// The invocation's runtime context (principal, variables).
    pub runtime: RuntimeContext,
    /// Soft budget, in characters, the assembler will try to honor across
    /// all attached fragments.
    pub char_budget: usize,
}

/// A lightweight advertisement of available context — name + description +
/// relevance — cheap to produce. Only selected candidates get `load`ed.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextCandidate {
    /// Source-scoped identifier (e.g. skill name, document id, memory key).
    pub id: String,
    pub kind: ContextKind,
    pub title: String,
    pub description: String,
    /// Relevance in `[0, 1]`; the assembler ranks across sources.
    pub score: f32,
    /// Estimated size in characters if loaded (for budgeting).
    pub estimated_chars: usize,
}

/// A fully loaded piece of context ready to be placed into the prompt.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextFragment {
    pub id: String,
    pub kind: ContextKind,
    pub title: String,
    /// The text placed into the system prompt / context window.
    pub content: String,
    /// Structured provenance recorded by observability.
    #[serde(default)]
    pub metadata: Value,
}

/// A provider of dynamically attachable context.
///
/// This is the single mental model shared by skills, knowledge, memory,
/// workspace files, user profiles, tool/MCP configuration, and prior runs:
///
/// 1. `candidates` — cheaply advertise what *could* be attached for a
///    request (progressive disclosure; usually name + description only).
/// 2. `load` — materialize a selected candidate into prompt-ready text.
///
/// The agent's context assembler queries all registered sources, ranks
/// candidates by score, packs them within the request budget, then loads the
/// winners. Every attachment is recorded in the run trace.
#[async_trait]
pub trait ContextSource: Send + Sync {
    /// Stable identifier for this source (e.g. `skills`, `knowledge`,
    /// `memory`, `workspace`).
    fn id(&self) -> &str;

    fn kind(&self) -> ContextKind;

    /// Advertise candidates relevant to the request. Must be cheap; no large
    /// reads. Sources must scope results to `req.runtime.user_id()` unless a
    /// resource is explicitly shared.
    async fn candidates(&self, req: &ContextRequest) -> Result<Vec<ContextCandidate>>;

    /// Load a candidate's full content.
    async fn load(&self, candidate_id: &str, req: &ContextRequest) -> Result<ContextFragment>;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn trigger_scores_keywords() {
        let t = TriggerCondition {
            keywords: vec!["deploy".into(), "kubernetes".into()],
            ..Default::default()
        };
        assert_eq!(t.score("how do I deploy this?"), 0.5);
        assert_eq!(t.score("unrelated"), 0.0);
        assert_eq!(TriggerCondition::always().score("anything"), 1.0);
    }

    #[test]
    fn wildcard_patterns_match() {
        let t = TriggerCondition { patterns: vec!["*.py".into()], ..Default::default() };
        assert!(t.score("please lint main.py") > 0.0);
    }
}
