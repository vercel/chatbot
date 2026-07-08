//! Declarative flow definitions — the serializable spec users author for
//! their own flows. The runtime (facade crate) hydrates these into
//! [`Workflow`](crate::Workflow)s by resolving agents/tools from its
//! registries. Code-first workflows (closures) remain the richer option;
//! declarative flows cover the user-authoring path.

use serde::{Deserialize, Serialize};
use serde_json::Value;

use rustra_core::{Error, Result};

/// One declarative step.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum FlowStepDef {
    /// Run an agent with a prompt template. `{{input}}` interpolates the
    /// JSON of the step input.
    Agent { id: String, agent: String, prompt: String },
    /// Invoke a tool; the step input is passed as the tool input.
    Tool { id: String, tool: String },
    /// Human approval gate.
    Approval { id: String, prompt: String },
    /// Pause for an external event.
    WaitForEvent { id: String, event: String },
}

impl FlowStepDef {
    pub fn id(&self) -> &str {
        match self {
            Self::Agent { id, .. }
            | Self::Tool { id, .. }
            | Self::Approval { id, .. }
            | Self::WaitForEvent { id, .. } => id,
        }
    }
}

/// A user-created flow, as data.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowDefinition {
    /// Stable id, kebab-case.
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    /// Steps run sequentially. (Declarative parallel/branch is future work —
    /// see TECH_DEBT.md.)
    pub steps: Vec<FlowStepDef>,
    #[serde(default)]
    pub metadata: Value,
}

impl FlowDefinition {
    pub fn validate(&self) -> Result<()> {
        if self.id.is_empty()
            || !self.id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
        {
            return Err(Error::Validation(format!(
                "flow id `{}` must be non-empty kebab-case ([a-z0-9-])",
                self.id
            )));
        }
        if self.steps.is_empty() {
            return Err(Error::Validation("flow must have at least one step".into()));
        }
        let mut seen = std::collections::HashSet::new();
        for step in &self.steps {
            if step.id().is_empty() {
                return Err(Error::Validation("step ids must not be empty".into()));
            }
            if !seen.insert(step.id()) {
                return Err(Error::Validation(format!("duplicate step id `{}`", step.id())));
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parses_and_validates() {
        let def: FlowDefinition = serde_json::from_value(json!({
            "id": "review-and-ship",
            "name": "Review and ship",
            "steps": [
                {"kind": "agent", "id": "draft", "agent": "writer", "prompt": "Draft: {{input}}"},
                {"kind": "approval", "id": "gate", "prompt": "Ship it?"},
                {"kind": "tool", "id": "send", "tool": "send_message"}
            ]
        }))
        .unwrap();
        def.validate().unwrap();

        let dup = FlowDefinition {
            steps: vec![
                FlowStepDef::Approval { id: "a".into(), prompt: "p".into() },
                FlowStepDef::Approval { id: "a".into(), prompt: "p".into() },
            ],
            ..def
        };
        assert!(dup.validate().is_err());
    }
}
