//! Declarative agent definitions — the serializable spec users author
//! (stored versioned in the definitions domain) that the runtime hydrates
//! into a live [`Agent`](crate::Agent). Field names follow Mastra's agent
//! config.

use serde::{Deserialize, Serialize};
use serde_json::Value;

use rustra_core::{Error, Result};

/// A user-created agent, as data.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AgentDefinition {
    /// Stable id, kebab-case.
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    pub instructions: String,
    /// Provider-qualified model id (e.g. `anthropic/claude-sonnet-5`),
    /// resolved by the host's model registry.
    pub model: String,
    /// Tool ids to attach, resolved by the host's tool registry.
    #[serde(default)]
    pub tools: Vec<String>,
    /// Sub-agent ids (supervisor pattern).
    #[serde(default)]
    pub agents: Vec<String>,
    /// Whether memory is enabled (default true — the platform default).
    #[serde(default = "default_true")]
    pub memory: bool,
    /// Free-form metadata for discovery.
    #[serde(default)]
    pub metadata: Value,
}

fn default_true() -> bool {
    true
}

impl AgentDefinition {
    pub fn validate(&self) -> Result<()> {
        if self.id.is_empty()
            || !self
                .id
                .chars()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
        {
            return Err(Error::Validation(format!(
                "agent id `{}` must be non-empty kebab-case ([a-z0-9-])",
                self.id
            )));
        }
        if self.name.trim().is_empty() {
            return Err(Error::Validation("agent name must not be empty".into()));
        }
        if self.instructions.trim().is_empty() {
            return Err(Error::Validation(
                "agent instructions must not be empty".into(),
            ));
        }
        if self.model.trim().is_empty() {
            return Err(Error::Validation("agent model must not be empty".into()));
        }
        if self.agents.contains(&self.id) {
            return Err(Error::Validation(
                "an agent cannot delegate to itself".into(),
            ));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn validates_and_roundtrips() {
        let def: AgentDefinition = serde_json::from_value(json!({
            "id": "research-helper",
            "name": "Research Helper",
            "instructions": "Help with research.",
            "model": "anthropic/claude-sonnet-5"
        }))
        .unwrap();
        def.validate().unwrap();
        assert!(def.memory, "memory defaults to on");

        let bad = AgentDefinition {
            id: "Bad Id!".into(),
            ..def
        };
        assert!(bad.validate().is_err());
    }
}
