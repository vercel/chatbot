//! Configuration vocabulary for the memory subsystem.

/// Whether semantic recall searches one thread or the whole resource
/// (all of a user's conversations).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum RecallScope {
    /// Search only the current conversation thread.
    Thread,
    /// Search every thread the resource (user) owns.
    #[default]
    Resource,
}

/// Semantic recall configuration (Mastra `semanticRecall`).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SemanticRecallConfig {
    /// Number of past messages to retrieve.
    pub top_k: usize,
    /// Whether the search covers the current thread or the whole resource.
    pub scope: RecallScope,
}

impl Default for SemanticRecallConfig {
    fn default() -> Self {
        Self {
            top_k: 4,
            scope: RecallScope::Resource,
        }
    }
}

/// Working memory configuration (Mastra `workingMemory`).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkingMemoryConfig {
    /// Master switch: when `false`, working memory is neither recalled nor
    /// offered as attachable context.
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
#[derive(Debug, Clone, PartialEq, Eq)]
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
