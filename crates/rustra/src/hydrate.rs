//! Hydration of declarative definitions into live objects.

use serde_json::json;
use std::sync::Arc;

use rustra_agent::{Agent, AgentDefinition};
use rustra_core::{Error, Result};
use rustra_workflow::{
    approval_step, FlowDefinition, FlowStepDef, FunctionStep, StepOutcome, Workflow,
};

use crate::Rustra;

/// Build a live [`Agent`] from a stored definition, resolving the model,
/// tools, and sub-agents from the registry.
pub(crate) fn agent_from_definition(
    rustra: &Rustra,
    definition: &AgentDefinition,
) -> Result<Agent> {
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
pub(crate) fn flow_from_definition(
    rustra: &Rustra,
    definition: &FlowDefinition,
) -> Result<Workflow> {
    definition.validate()?;
    let mut builder = Workflow::builder(definition.id.clone())
        .storage(rustra.storage().clone())
        .observability(rustra.observability().clone());
    // Weak reference: flows must not keep the runtime alive.
    let weak = WeakRustra::downgrade(rustra);

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

/// A `Weak<Rustra>` with an ergonomic upgrade-or-error: the single home of
/// the "runtime is shutting down" policy shared by hydrated flows and the
/// task executor. `Rustra` is always constructed inside an `Arc` (via
/// `Arc::new_cyclic` in the builder) and keeps a weak self-reference, so
/// these handles never keep the runtime alive.
#[derive(Clone)]
pub(crate) struct WeakRustra(std::sync::Weak<Rustra>);

impl WeakRustra {
    pub(crate) fn downgrade(rustra: &Rustra) -> Self {
        Self(rustra.weak_self())
    }

    pub(crate) fn upgrade(&self) -> Result<Arc<Rustra>> {
        self.0
            .upgrade()
            .ok_or_else(|| Error::Cancelled("runtime is shutting down".into()))
    }
}
