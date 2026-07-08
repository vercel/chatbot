//! # Rustra
//!
//! A Mastra-inspired agent framework in Rust. This crate is the analogue of
//! Mastra's central `Mastra` class: the registry that wires storage, models,
//! memory, agents, workflows, skills, knowledge, workspaces, tasks,
//! schedules, signals, MCP, messaging channels, generative UI, browser
//! sessions, RBAC, and observability into one runtime.
//!
//! ```no_run
//! use std::sync::Arc;
//! use rustra::{Rustra, Principal, RuntimeContext};
//! use rustra_llm::MockModel;
//!
//! # async fn demo() -> rustra_core::Result<()> {
//! let rustra = Rustra::builder()
//!     .sqlite("rustra.db")?
//!     .model("mock/mock-1", Arc::new(MockModel::text("hello!")))
//!     .default_model("mock/mock-1")
//!     .build()
//!     .await?;
//!
//! let runtime = RuntimeContext::new(Principal::user("ada"));
//! let agent = rustra.main_agent_for("ada").await?;
//! let reply = agent.generate("hi there", runtime).await?;
//! println!("{}", reply.text);
//! # Ok(())
//! # }
//! ```

mod executor;
mod hydrate;
mod registry;

pub use registry::{Rustra, RustraBuilder};

// The whole public surface, re-exported for one-import ergonomics.
pub use rustra_agent::{
    Agent, AgentBuilder, AgentDefinition, AgentInput, AgentResponse, GenerateOptions,
};
pub use rustra_core::{
    Action, Error, Event, Principal, RequestContext, ResourceKind, Result, Role, RuntimeContext,
    Tool, ToolContext, Visibility,
};
pub use rustra_llm::{AnthropicModel, LanguageModel, MockModel, SharedModel};
pub use rustra_memory::{Memory, MemoryConfig, RecallScope};
pub use rustra_observability::ObservabilityHub;
pub use rustra_rbac::{AccessControl, AuthProvider, Governed, TokenAuthProvider};
pub use rustra_storage::{Page, SharedStorage, Storage};
pub use rustra_tasks::{
    HitlToolApprover, InterruptController, Scheduler, SignalBus, TaskManager, TaskOptions,
};
pub use rustra_workflow::{
    approval_step, cond, FlowDefinition, FlowOutcome, FunctionStep, StepOutcome, Workflow,
};
