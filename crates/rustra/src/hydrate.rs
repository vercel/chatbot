//! Hydration of declarative definitions into live objects, plus the
//! facade-level context sources (user profile, prior runs).

use async_trait::async_trait;
use serde_json::json;
use std::sync::Arc;

use rustra_agent::{Agent, AgentDefinition};
use rustra_core::{
    ContextCandidate, ContextFragment, ContextKind, ContextRequest, ContextSource, Error, Result,
};
use rustra_storage::{Page, SharedStorage};
use rustra_workflow::{
    approval_step, FlowDefinition, FlowStepDef, FunctionStep, StepOutcome, Workflow,
};

use crate::Rustra;

/// Build a live [`Agent`] from a stored definition, resolving the model,
/// tools, and sub-agents from the registry.
pub fn agent_from_definition(rustra: &Rustra, definition: &AgentDefinition) -> Result<Agent> {
    let mut builder = Agent::builder(definition.id.clone())
        .name(definition.name.clone())
        .description(definition.description.clone())
        .instructions(definition.instructions.clone())
        .model(rustra.model(&definition.model)?)
        .observability(rustra.observability().clone());
    if definition.memory {
        builder = builder.memory(Arc::clone(rustra.memory()));
    }
    for tool_id in &definition.tools {
        builder = builder.tool(rustra.tool(tool_id)?);
    }
    for agent_id in &definition.agents {
        builder = builder.sub_agent(rustra.agent(agent_id)?);
    }
    builder.build()
}

/// Compile a declarative flow into a runnable [`Workflow`]. Steps resolve
/// their agents/tools lazily at execution time so definitions can reference
/// artifacts registered after the flow was saved.
pub fn flow_from_definition(rustra: &Rustra, definition: &FlowDefinition) -> Result<Workflow> {
    definition.validate()?;
    let mut builder = Workflow::builder(definition.id.clone())
        .storage(rustra.storage().clone())
        .observability(rustra.observability().clone());
    // Weak reference: flows must not keep the runtime alive.
    let weak = ArcRustra::downgrade(rustra);

    for step in &definition.steps {
        match step.clone() {
            FlowStepDef::Agent { id, agent, prompt } => {
                let weak = weak.clone();
                builder = builder.then(FunctionStep::new(id, move |ctx| {
                    let weak = weak.clone();
                    let agent_id = agent.clone();
                    let prompt = prompt.clone();
                    async move {
                        let rustra = weak.upgrade()?;
                        let resolved = if agent_id == "main" {
                            rustra.main_agent_for(ctx.runtime.user_id()).await?
                        } else {
                            rustra.agent(&agent_id)?
                        };
                        let input_json = serde_json::to_string(&ctx.input)?;
                        let message = prompt.replace("{{input}}", &input_json);
                        let response = resolved.generate(message, ctx.runtime.clone()).await?;
                        Ok(StepOutcome::Done(json!({ "text": response.text })))
                    }
                }));
            }
            FlowStepDef::Tool { id, tool } => {
                let weak = weak.clone();
                builder = builder.then(FunctionStep::new(id, move |ctx| {
                    let weak = weak.clone();
                    let tool_id = tool.clone();
                    async move {
                        let rustra = weak.upgrade()?;
                        let resolved = rustra.tool(&tool_id)?;
                        let tool_ctx = rustra_core::ToolContext::new(ctx.runtime.clone());
                        let output = resolved.execute(ctx.input.clone(), &tool_ctx).await?;
                        Ok(StepOutcome::Done(output))
                    }
                }));
            }
            FlowStepDef::Approval { id, prompt } => {
                builder = builder.then(approval_step(id, prompt));
            }
            FlowStepDef::WaitForEvent { id: _, event } => {
                builder = builder.wait_for_event(event);
            }
        }
    }
    Ok(builder.commit())
}

/// A `Weak<Rustra>` with an ergonomic upgrade-or-error. `Rustra` is always
/// constructed inside an `Arc` (via `Arc::new_cyclic` in the builder) and
/// keeps a weak self-reference, so flows never keep the runtime alive.
#[derive(Clone)]
struct ArcRustra(std::sync::Weak<Rustra>);

impl ArcRustra {
    fn downgrade(rustra: &Rustra) -> Self {
        Self(rustra.weak_self())
    }

    fn upgrade(&self) -> Result<std::sync::Arc<Rustra>> {
        self.0.upgrade().ok_or_else(|| Error::Cancelled("runtime is shutting down".into()))
    }
}

// -- Context sources owned by the facade -------------------------------------

/// User profile/settings as attachable context (always relevant, small).
pub struct UserProfileContextSource {
    storage: SharedStorage,
}

impl UserProfileContextSource {
    pub fn new(storage: SharedStorage) -> Self {
        Self { storage }
    }
}

#[async_trait]
impl ContextSource for UserProfileContextSource {
    fn id(&self) -> &str {
        "user_profile"
    }

    fn kind(&self) -> ContextKind {
        ContextKind::UserProfile
    }

    async fn candidates(&self, _req: &ContextRequest) -> Result<Vec<ContextCandidate>> {
        Ok(vec![ContextCandidate {
            id: "profile".into(),
            kind: ContextKind::UserProfile,
            title: "User profile".into(),
            description: "The user's profile and settings".into(),
            score: 0.8,
            estimated_chars: 512,
        }])
    }

    async fn load(&self, _candidate_id: &str, req: &ContextRequest) -> Result<ContextFragment> {
        let user = self.storage.get_user(req.runtime.user_id()).await?;
        let content = match user {
            Some(u) => format!(
                "Name: {}\nRoles: {}\nProfile: {}",
                u.display_name,
                u.roles.join(", "),
                serde_json::to_string_pretty(&u.profile).unwrap_or_default()
            ),
            None => "(no profile on record)".to_string(),
        };
        Ok(ContextFragment {
            id: "profile".into(),
            kind: ContextKind::UserProfile,
            title: "User profile".into(),
            content,
            metadata: json!({}),
        })
    }
}

/// Recent runs as attachable context — lets the agent see what it recently
/// did for this user (and whether it failed).
pub struct PriorRunsContextSource {
    storage: SharedStorage,
}

impl PriorRunsContextSource {
    pub fn new(storage: SharedStorage) -> Self {
        Self { storage }
    }
}

#[async_trait]
impl ContextSource for PriorRunsContextSource {
    fn id(&self) -> &str {
        "prior_runs"
    }

    fn kind(&self) -> ContextKind {
        ContextKind::PriorRun
    }

    async fn candidates(&self, req: &ContextRequest) -> Result<Vec<ContextCandidate>> {
        // Only relevant when the user refers to previous work.
        let lowered = req.query.to_lowercase();
        let referring = ["last time", "again", "previous", "earlier", "retry", "before"]
            .iter()
            .any(|kw| lowered.contains(kw));
        if !referring {
            return Ok(Vec::new());
        }
        Ok(vec![ContextCandidate {
            id: "recent".into(),
            kind: ContextKind::PriorRun,
            title: "Recent runs".into(),
            description: "Summaries of this user's recent agent/workflow runs".into(),
            score: 0.7,
            estimated_chars: 1024,
        }])
    }

    async fn load(&self, _candidate_id: &str, req: &ContextRequest) -> Result<ContextFragment> {
        let runs = self
            .storage
            .list_runs(req.runtime.user_id(), None, None, Page::first(5))
            .await?;
        let content = if runs.is_empty() {
            "(no prior runs)".to_string()
        } else {
            runs.iter()
                .map(|r| {
                    format!(
                        "- [{}] {} `{}` at {}: {}",
                        r.status,
                        r.kind,
                        r.subject_id,
                        r.started_at,
                        r.error.clone().unwrap_or_else(|| "ok".into())
                    )
                })
                .collect::<Vec<_>>()
                .join("\n")
        };
        Ok(ContextFragment {
            id: "recent".into(),
            kind: ContextKind::PriorRun,
            title: "Recent runs".into(),
            content,
            metadata: json!({ "count": runs.len() }),
        })
    }
}
