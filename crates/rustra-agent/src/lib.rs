//! # rustra-agent
//!
//! The agent runtime — the Rust analogue of Mastra's `Agent` from
//! `@mastra/core/agent`. An [`Agent`] is configured with instructions, a
//! model, tools, optional memory, optional sub-agents (the supervisor
//! pattern), and dynamic [`ContextSource`]s; [`Agent::generate`] runs the
//! tool-calling loop:
//!
//! 1. Resolve the memory thread and recall history + working memory.
//! 2. Assemble dynamic context (skills, knowledge, memory, workspace files,
//!    user profile, prior runs) within a character budget — every attachment
//!    is traced.
//! 3. Loop: call the model; execute requested tools (with approval hooks for
//!    HITL); feed results back — until the model ends its turn or
//!    `max_steps` is reached.
//! 4. Persist every turn to memory and every operation to observability.
//!
//! The **main coding agent** that "runs the show" is just an `Agent` wired
//! with the full set of workspace/skill/knowledge/delegation tools — see the
//! `rustra` facade crate.

mod approval;
mod assembler;
mod definition;
mod delegate;

pub use approval::{AllowAll, ApprovalDecision, ToolApprover};
pub use assembler::{AssembledContext, ContextAssembler};
pub use definition::AgentDefinition;
pub use delegate::AgentTool;

use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::sync::Arc;

use rustra_core::{
    ContextRequest, ContextSource, Error, Result, RuntimeContext, Tool, ToolContext, ToolSpec,
};
use rustra_llm::{
    ContentBlock, Message, ModelRequest, ModelResponse, Role, SharedModel, StopReason, TokenUsage,
};
use rustra_memory::Memory;
use rustra_observability::{run_kind, span_kind, ObservabilityHub, RunHandle};

/// Per-call generation options (Mastra `defaultOptions` for
/// `generate`/`stream`).
#[derive(Debug, Clone, PartialEq)]
pub struct GenerateOptions {
    /// Maximum model⇄tool round trips per invocation.
    pub max_steps: usize,
    /// Output-token cap passed to the model (`None` = provider default).
    pub max_tokens: Option<u32>,
    /// Sampling temperature passed to the model (`None` = provider default).
    pub temperature: Option<f32>,
    /// Character budget for dynamically attached context.
    pub context_char_budget: usize,
    /// Maximum number of context fragments attached per turn.
    pub max_context_fragments: usize,
    /// Minimum relevance score for a context candidate to be considered.
    pub min_context_score: f32,
}

impl Default for GenerateOptions {
    fn default() -> Self {
        Self {
            max_steps: 12,
            max_tokens: None,
            temperature: None,
            context_char_budget: 24_000,
            max_context_fragments: 12,
            min_context_score: 0.15,
        }
    }
}

/// Input for one agent invocation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AgentInput {
    /// The user's message.
    pub message: String,
    /// Continue an existing memory thread; `None` starts a new one.
    pub thread_id: Option<String>,
}

impl From<&str> for AgentInput {
    fn from(message: &str) -> Self {
        Self::new(message)
    }
}

impl From<String> for AgentInput {
    fn from(message: String) -> Self {
        Self::new(message)
    }
}

impl AgentInput {
    /// Input with no thread: memory-enabled agents will start a new thread.
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            thread_id: None,
        }
    }

    /// Continue the given memory thread.
    pub fn in_thread(mut self, thread_id: impl Into<String>) -> Self {
        self.thread_id = Some(thread_id.into());
        self
    }
}

/// The result of one agent invocation.
#[derive(Debug, Clone)]
pub struct AgentResponse {
    /// Final assistant text.
    pub text: String,
    /// Every message produced during the invocation (assistant turns and
    /// tool results), in order.
    pub messages: Vec<Message>,
    /// Total token usage across model calls.
    pub usage: TokenUsage,
    /// Run id correlating this invocation in observability.
    pub run_id: String,
    /// Trace id containing every span recorded for this invocation.
    pub trace_id: String,
    /// Memory thread the conversation lives in (if memory is enabled).
    pub thread_id: Option<String>,
    /// Model⇄tool round trips consumed.
    pub steps: usize,
}

/// Accumulated state of one invocation's model⇄tool loop.
struct TurnState {
    conversation: Vec<Message>,
    new_messages: Vec<Message>,
    usage: TokenUsage,
    steps: usize,
}

impl TurnState {
    /// Append a message to the ongoing conversation and record it as new
    /// output of this invocation.
    fn push(&mut self, message: Message) {
        self.conversation.push(message.clone());
        self.new_messages.push(message);
    }
}

/// An LLM agent. Cheap to share (`Arc` fields); construct via
/// [`Agent::builder`].
pub struct Agent {
    id: String,
    name: String,
    description: String,
    instructions: String,
    model: SharedModel,
    tools: BTreeMap<String, Arc<dyn Tool>>,
    memory: Option<Arc<Memory>>,
    context_sources: Vec<Arc<dyn ContextSource>>,
    approver: Arc<dyn ToolApprover>,
    hub: ObservabilityHub,
    options: GenerateOptions,
}

impl Agent {
    /// Start building an agent with the given stable id.
    pub fn builder(id: impl Into<String>) -> AgentBuilder {
        AgentBuilder::new(id)
    }

    /// The agent's stable id (used in traces and `ask_<id>` delegation tool
    /// names).
    pub fn id(&self) -> &str {
        &self.id
    }
    /// Human-readable name (defaults to the id).
    pub fn name(&self) -> &str {
        &self.name
    }
    /// One-line description, shown to supervisors when this agent is a
    /// sub-agent.
    pub fn description(&self) -> &str {
        &self.description
    }
    /// Base system instructions, before dynamic context is attached.
    pub fn instructions(&self) -> &str {
        &self.instructions
    }
    /// Ids of every attached tool, including auto-attached ones (e.g.
    /// working memory).
    pub fn tool_ids(&self) -> Vec<&str> {
        self.tools.keys().map(String::as_str).collect()
    }
    /// The memory attached via [`AgentBuilder::memory`], if any.
    pub fn memory(&self) -> Option<&Arc<Memory>> {
        self.memory.as_ref()
    }

    /// Run the agent to completion for one user message.
    ///
    /// # Errors
    /// Fails when the model or memory backend fails, or when the tool loop
    /// exceeds [`GenerateOptions::max_steps`].
    pub async fn generate(
        &self,
        input: impl Into<AgentInput>,
        runtime: RuntimeContext,
    ) -> Result<AgentResponse> {
        let input: AgentInput = input.into();
        let user_id = runtime.user_id().to_string();
        let run = self
            .hub
            .start_run(
                run_kind::AGENT,
                &self.id,
                &user_id,
                json!({ "message": input.message }),
            )
            .await;
        runtime.set(RuntimeContext::RUN_ID, json!(run.run_id()));
        runtime.set(RuntimeContext::TRACE_ID, json!(run.trace_id()));

        match self.generate_inner(&input, &runtime, &run).await {
            Ok(response) => {
                run.finish_success(json!({ "text": response.text, "steps": response.steps }))
                    .await;
                Ok(response)
            }
            Err(e) => {
                run.finish_failed(&e.to_string()).await;
                Err(e)
            }
        }
    }

    async fn generate_inner(
        &self,
        input: &AgentInput,
        runtime: &RuntimeContext,
        run: &RunHandle,
    ) -> Result<AgentResponse> {
        let user_id = runtime.user_id().to_string();

        // -- Memory thread + history ---------------------------------------
        let (thread_id, conversation) = self.resolve_thread(input, &user_id, runtime, run).await?;

        // -- Dynamic context assembly ---------------------------------------
        let context_request = ContextRequest {
            query: input.message.clone(),
            agent_id: self.id.clone(),
            thread_id: thread_id.clone(),
            runtime: runtime.clone(),
            char_budget: self.options.context_char_budget,
        };
        let assembled = ContextAssembler::new(
            self.options.max_context_fragments,
            self.options.min_context_score,
        )
        .assemble(&self.context_sources, &context_request, run)
        .await;
        let system = assembled.render_system_prompt(&self.instructions);

        // -- Persist the user turn ------------------------------------------
        let user_message = Message::user(&input.message);
        self.persist_message(thread_id.as_deref(), &user_id, &user_message)
            .await?;
        let mut state = TurnState {
            conversation,
            new_messages: Vec::new(),
            usage: TokenUsage::default(),
            steps: 0,
        };
        state.conversation.push(user_message);

        // -- The loop ---------------------------------------------------------
        let tool_specs: Vec<_> = self.tools.values().map(|t| t.spec()).collect();
        loop {
            state.steps += 1;
            if state.steps > self.options.max_steps {
                return Err(Error::Other(format!(
                    "agent `{}` exceeded max_steps ({})",
                    self.id, self.options.max_steps
                )));
            }

            let step_result = self
                .run_step(
                    &mut state,
                    &system,
                    &tool_specs,
                    thread_id.as_deref(),
                    &user_id,
                    runtime,
                    run,
                )
                .await?;
            if let Some(text) = step_result {
                return Ok(AgentResponse {
                    text,
                    messages: state.new_messages,
                    usage: state.usage,
                    run_id: run.run_id().to_string(),
                    trace_id: run.trace_id().to_string(),
                    thread_id,
                    steps: state.steps,
                });
            }
        }
    }

    /// Resolve the memory thread for this invocation (when memory is
    /// enabled) and recall its history.
    async fn resolve_thread(
        &self,
        input: &AgentInput,
        user_id: &str,
        runtime: &RuntimeContext,
        run: &RunHandle,
    ) -> Result<(Option<String>, Vec<Message>)> {
        let Some(memory) = &self.memory else {
            return Ok((None, Vec::new()));
        };
        let thread = match &input.thread_id {
            Some(id) => memory.get_thread(id, user_id).await?,
            None => memory.create_thread(user_id, None).await?,
        };
        runtime.set(RuntimeContext::THREAD_ID, json!(thread.id));
        let span = run
            .span(
                "memory recall",
                span_kind::MEMORY_OP,
                json!({"thread": thread.id}),
            )
            .await;
        let recalled = match memory.recall(&thread.id, user_id, &input.message).await {
            Ok(recalled) => recalled,
            Err(e) => {
                span.end_err(&e.to_string()).await;
                return Err(e);
            }
        };
        span.end_ok(json!({ "recent": recalled.recent.len() }))
            .await;
        Ok((Some(thread.id), recalled.recent))
    }

    /// Persist `message` to memory when memory is enabled (a thread id is
    /// always present in that case).
    async fn persist_message(
        &self,
        thread_id: Option<&str>,
        user_id: &str,
        message: &Message,
    ) -> Result<()> {
        if let (Some(memory), Some(tid)) = (&self.memory, thread_id) {
            memory.save_message(tid, user_id, message).await?;
        }
        Ok(())
    }

    /// One model⇄tool round trip: call the model, persist the assistant
    /// turn, and — when the model requested tools — execute them and persist
    /// the results. Returns `Some(final_text)` once the model ends its turn.
    #[allow(clippy::too_many_arguments)]
    async fn run_step(
        &self,
        state: &mut TurnState,
        system: &str,
        tool_specs: &[ToolSpec],
        thread_id: Option<&str>,
        user_id: &str,
        runtime: &RuntimeContext,
        run: &RunHandle,
    ) -> Result<Option<String>> {
        let response = self
            .call_model(system, &state.conversation, tool_specs, run)
            .await?;
        state.usage.add(response.usage);

        let assistant_message = Message {
            role: Role::Assistant,
            content: response.content.clone(),
        };
        self.persist_message(thread_id, user_id, &assistant_message)
            .await?;
        state.push(assistant_message);

        if response.stop_reason != StopReason::ToolUse {
            return Ok(Some(response.text()));
        }

        // Execute every tool call in the assistant turn.
        let mut result_blocks: Vec<ContentBlock> = Vec::new();
        for (tool_use_id, tool_name, tool_input) in response.tool_uses() {
            let block = self
                .execute_tool(tool_use_id, tool_name, tool_input.clone(), runtime, run)
                .await;
            result_blocks.push(block);
        }
        let results_message = Message {
            role: Role::User,
            content: result_blocks,
        };
        self.persist_message(thread_id, user_id, &results_message)
            .await?;
        state.push(results_message);
        Ok(None)
    }

    async fn call_model(
        &self,
        system: &str,
        conversation: &[Message],
        tools: &[ToolSpec],
        run: &RunHandle,
    ) -> Result<ModelResponse> {
        let span = run
            .span(
                &format!("llm call ({})", self.model.id()),
                span_kind::LLM_CALL,
                json!({ "messages": conversation.len(), "tools": tools.len() }),
            )
            .await;
        let request = ModelRequest {
            system: Some(system.to_string()),
            messages: conversation.to_vec(),
            tools: tools.to_vec(),
            max_tokens: self.options.max_tokens,
            temperature: self.options.temperature,
            stop_sequences: Vec::new(),
        };
        match self.model.generate(request).await {
            Ok(response) => {
                span.end_ok(json!({
                    "stop_reason": format!("{:?}", response.stop_reason),
                    "output_tokens": response.usage.output_tokens,
                }))
                .await;
                Ok(response)
            }
            Err(e) => {
                span.end_err(&e.to_string()).await;
                Err(e)
            }
        }
    }

    /// The fallible core of one tool call: lookup, approval, execution.
    /// Every failure is mapped to the message the model will see.
    async fn try_tool(
        &self,
        tool_name: &str,
        tool_input: Value,
        runtime: &RuntimeContext,
        run: &RunHandle,
    ) -> std::result::Result<Value, String> {
        let Some(tool) = self.tools.get(tool_name) else {
            return Err(format!("unknown tool `{tool_name}`"));
        };

        // HITL approval hook.
        match self.approver.review(tool_name, &tool_input, runtime).await {
            Ok(ApprovalDecision::Approved) => {}
            Ok(ApprovalDecision::Denied { reason }) => {
                return Err(format!("tool call denied by approval policy: {reason}"));
            }
            Err(e) => return Err(format!("approval check failed: {e}")),
        }

        let ctx = ToolContext::new(runtime.clone())
            .with_agent_id(self.id.clone())
            .with_run_id(run.run_id().to_string());
        tool.execute(tool_input, &ctx)
            .await
            .map_err(|e| e.to_string())
    }

    /// Execute one tool call, mapping every failure into a `tool_result`
    /// error block so the model can react instead of the run aborting.
    async fn execute_tool(
        &self,
        tool_use_id: &str,
        tool_name: &str,
        tool_input: Value,
        runtime: &RuntimeContext,
        run: &RunHandle,
    ) -> ContentBlock {
        let span = run
            .span(
                &format!("tool: {tool_name}"),
                span_kind::TOOL_CALL,
                tool_input.clone(),
            )
            .await;
        match self.try_tool(tool_name, tool_input, runtime, run).await {
            Ok(output) => {
                span.end_ok(output.clone()).await;
                ContentBlock::ToolResult {
                    tool_use_id: tool_use_id.to_string(),
                    content: output.to_string(),
                    is_error: false,
                }
            }
            Err(message) => {
                span.end_err(&message).await;
                ContentBlock::ToolResult {
                    tool_use_id: tool_use_id.to_string(),
                    content: message,
                    is_error: true,
                }
            }
        }
    }
}

/// Fluent construction for [`Agent`] (Mastra's `new Agent({...})`).
pub struct AgentBuilder {
    id: String,
    name: Option<String>,
    description: String,
    instructions: String,
    model: Option<SharedModel>,
    tools: Vec<Arc<dyn Tool>>,
    memory: Option<Arc<Memory>>,
    context_sources: Vec<Arc<dyn ContextSource>>,
    approver: Arc<dyn ToolApprover>,
    hub: ObservabilityHub,
    options: GenerateOptions,
}

impl AgentBuilder {
    /// Start a builder for an agent with the given stable id.
    pub fn new(id: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            name: None,
            description: String::new(),
            instructions: String::new(),
            model: None,
            tools: Vec::new(),
            memory: None,
            context_sources: Vec::new(),
            approver: Arc::new(AllowAll),
            hub: ObservabilityHub::noop(),
            options: GenerateOptions::default(),
        }
    }

    /// Human-readable name; defaults to the id when unset.
    pub fn name(mut self, name: impl Into<String>) -> Self {
        self.name = Some(name.into());
        self
    }

    /// One-line description, shown to supervisors when this agent is a
    /// sub-agent.
    pub fn description(mut self, description: impl Into<String>) -> Self {
        self.description = description.into();
        self
    }

    /// Base system instructions, before dynamic context is attached.
    pub fn instructions(mut self, instructions: impl Into<String>) -> Self {
        self.instructions = instructions.into();
        self
    }

    /// The language model that powers the agent (required).
    pub fn model(mut self, model: SharedModel) -> Self {
        self.model = Some(model);
        self
    }

    /// Attach a tool.
    pub fn tool(mut self, tool: Arc<dyn Tool>) -> Self {
        self.tools.push(tool);
        self
    }

    /// Attach several tools at once.
    pub fn tools(mut self, tools: impl IntoIterator<Item = Arc<dyn Tool>>) -> Self {
        self.tools.extend(tools);
        self
    }

    /// Enable memory. Also auto-attaches (at build time) the working-memory
    /// tool and the memory context source, matching Mastra's defaults.
    pub fn memory(mut self, memory: Arc<Memory>) -> Self {
        self.memory = Some(memory);
        self
    }

    /// Attach a dynamic context source.
    pub fn context_source(mut self, source: Arc<dyn ContextSource>) -> Self {
        self.context_sources.push(source);
        self
    }

    /// Attach several context sources at once.
    pub fn context_sources(
        mut self,
        sources: impl IntoIterator<Item = Arc<dyn ContextSource>>,
    ) -> Self {
        self.context_sources.extend(sources);
        self
    }

    /// Register a sub-agent, exposed to the model as an `ask_<id>` tool
    /// (the Mastra supervisor pattern).
    pub fn sub_agent(mut self, agent: Arc<Agent>) -> Self {
        self.tools.push(Arc::new(AgentTool::new(agent)));
        self
    }

    /// Set the tool-approval hook (defaults to [`AllowAll`]).
    pub fn approver(mut self, approver: Arc<dyn ToolApprover>) -> Self {
        self.approver = approver;
        self
    }

    /// Route runs and spans to the given hub (defaults to a no-op hub).
    pub fn observability(mut self, hub: ObservabilityHub) -> Self {
        self.hub = hub;
        self
    }

    /// Override the default [`GenerateOptions`].
    pub fn options(mut self, options: GenerateOptions) -> Self {
        self.options = options;
        self
    }

    /// Validate the configuration and build the agent.
    ///
    /// # Errors
    /// Returns [`Error::Config`] when the id is empty, no model was set, or
    /// two tools share an id.
    pub fn build(mut self) -> Result<Agent> {
        if self.id.is_empty() {
            return Err(Error::Config("agent id must not be empty".into()));
        }
        let model = self
            .model
            .take()
            .ok_or_else(|| Error::Config(format!("agent `{}` has no model", self.id)))?;
        // Memory wiring is derived here (not in `memory()`) so the builder
        // stays order-insensitive and last-write-wins.
        if let Some(memory) = &self.memory {
            self.tools.push(Arc::new(memory.working_memory_tool()));
            self.context_sources
                .push(Arc::new(rustra_memory::MemoryContextSource::new(
                    Arc::clone(memory),
                )));
        }
        let mut tools = BTreeMap::new();
        for tool in self.tools {
            let id = tool.id().to_string();
            if tools.insert(id.clone(), tool).is_some() {
                return Err(Error::Config(format!("duplicate tool id `{id}`")));
            }
        }
        Ok(Agent {
            name: self.name.unwrap_or_else(|| self.id.clone()),
            id: self.id,
            description: self.description,
            instructions: self.instructions,
            model,
            tools,
            memory: self.memory,
            context_sources: self.context_sources,
            approver: self.approver,
            hub: self.hub,
            options: self.options,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rustra_core::{FunctionTool, Principal};
    use rustra_llm::{MockModel, ScriptedTurn};
    use rustra_storage::{InMemoryStorage, InMemoryVectorStore, MockEmbedder, SharedStorage};

    fn runtime() -> RuntimeContext {
        RuntimeContext::new(Principal::user("user-1"))
    }

    #[tokio::test]
    async fn plain_text_generation() {
        let agent = Agent::builder("helper")
            .instructions("You are helpful.")
            .model(Arc::new(MockModel::text("hello!")))
            .build()
            .unwrap();
        let response = agent.generate("hi", runtime()).await.unwrap();
        assert_eq!(response.text, "hello!");
        assert_eq!(response.steps, 1);
    }

    #[tokio::test]
    async fn tool_calling_loop_roundtrips() {
        let model = Arc::new(MockModel::new(vec![
            ScriptedTurn::ToolCall {
                name: "add".into(),
                input: json!({"a": 2, "b": 3}),
            },
            ScriptedTurn::Text("the sum is 5".into()),
        ]));
        let add = FunctionTool::new(
            "add",
            "Add numbers",
            json!({"type": "object"}),
            |input, _ctx| async move {
                Ok(json!({"sum": input["a"].as_f64().unwrap() + input["b"].as_f64().unwrap()}))
            },
        );
        let agent = Agent::builder("calc")
            .model(model.clone())
            .tool(Arc::new(add))
            .build()
            .unwrap();

        let response = agent.generate("what is 2+3?", runtime()).await.unwrap();
        assert_eq!(response.text, "the sum is 5");
        assert_eq!(response.steps, 2);

        // The second model request must carry the tool result back.
        let requests = model.requests();
        let last = requests.last().unwrap();
        let has_tool_result = last.messages.iter().any(|m| {
            m.content.iter().any(|b| {
                matches!(b, ContentBlock::ToolResult { content, is_error, .. }
                    if content.contains("5") && !is_error)
            })
        });
        assert!(has_tool_result);
    }

    #[tokio::test]
    async fn unknown_tool_reports_error_to_model() {
        let model = Arc::new(MockModel::new(vec![
            ScriptedTurn::ToolCall {
                name: "nope".into(),
                input: json!({}),
            },
            ScriptedTurn::Text("recovered".into()),
        ]));
        let agent = Agent::builder("a").model(model).build().unwrap();
        let response = agent.generate("go", runtime()).await.unwrap();
        assert_eq!(response.text, "recovered");
    }

    #[tokio::test]
    async fn memory_persists_across_invocations() {
        let storage: SharedStorage = Arc::new(InMemoryStorage::new());
        let memory = Arc::new(rustra_memory::Memory::new(storage.clone()).with_vector(
            Arc::new(InMemoryVectorStore::new()),
            Arc::new(MockEmbedder::default()),
        ));
        let model = Arc::new(MockModel::new(vec![
            ScriptedTurn::Text("nice to meet you, Ada".into()),
            ScriptedTurn::EchoLast,
        ]));
        let agent = Agent::builder("rememberer")
            .model(model.clone())
            .memory(memory)
            .observability(ObservabilityHub::new(storage))
            .build()
            .unwrap();

        let first = agent.generate("my name is Ada", runtime()).await.unwrap();
        let thread_id = first.thread_id.clone().unwrap();

        // Second call in the same thread: history must be replayed, so the
        // model sees the 2 prior messages + the new one (3 total).
        agent
            .generate(
                AgentInput::new("what did I say?").in_thread(&thread_id),
                runtime(),
            )
            .await
            .unwrap();
        let requests = model.requests();
        assert_eq!(requests.last().unwrap().messages.len(), 3); // user, assistant, user
    }

    #[tokio::test]
    async fn denied_tool_is_surfaced_as_error_result() {
        struct DenyAll;
        #[async_trait::async_trait]
        impl ToolApprover for DenyAll {
            async fn review(
                &self,
                _tool: &str,
                _input: &Value,
                _runtime: &RuntimeContext,
            ) -> Result<ApprovalDecision> {
                Ok(ApprovalDecision::Denied {
                    reason: "policy says no".into(),
                })
            }
        }
        let model = Arc::new(MockModel::new(vec![
            ScriptedTurn::ToolCall {
                name: "add".into(),
                input: json!({}),
            },
            ScriptedTurn::Text("understood, cannot compute".into()),
        ]));
        let add = FunctionTool::new("add", "Add", json!({"type":"object"}), |_, _| async {
            Ok(json!(1))
        });
        let agent = Agent::builder("guarded")
            .model(model.clone())
            .tool(Arc::new(add))
            .approver(Arc::new(DenyAll))
            .build()
            .unwrap();
        let response = agent.generate("add", runtime()).await.unwrap();
        assert_eq!(response.text, "understood, cannot compute");
        let requests = model.requests();
        let denied = requests.last().unwrap().messages.iter().any(|m| {
            m.content.iter().any(|b| {
                matches!(b, ContentBlock::ToolResult { content, is_error: true, .. }
                    if content.contains("policy says no"))
            })
        });
        assert!(denied);
    }

    #[tokio::test]
    async fn sub_agent_delegation() {
        let child = Arc::new(
            Agent::builder("expert")
                .description("Knows everything about rust")
                .model(Arc::new(MockModel::text("rust is memory safe")))
                .build()
                .unwrap(),
        );
        let model = Arc::new(MockModel::new(vec![
            ScriptedTurn::ToolCall {
                name: "ask_expert".into(),
                input: json!({"message": "tell me about rust"}),
            },
            ScriptedTurn::Text("the expert says: rust is memory safe".into()),
        ]));
        let supervisor = Agent::builder("supervisor")
            .model(model)
            .sub_agent(child)
            .build()
            .unwrap();
        let response = supervisor
            .generate("ask the expert about rust", runtime())
            .await
            .unwrap();
        assert_eq!(response.text, "the expert says: rust is memory safe");
    }
}
