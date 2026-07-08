//! The builder DSL — fluent, Mastra-shaped workflow construction over the
//! engine's node graph.

use serde_json::Value;
use std::sync::Arc;
use std::time::Duration;

use rustra_observability::ObservabilityHub;
use rustra_storage::SharedStorage;

use crate::engine::{Node, Workflow};
use crate::step::Step;
use crate::{Condition, MapContext};

/// Fluent workflow construction; finish with
/// [`commit`](WorkflowBuilder::commit) (Mastra's `.commit()`).
pub struct WorkflowBuilder {
    id: String,
    nodes: Vec<Node>,
    storage: Option<SharedStorage>,
    hub: ObservabilityHub,
}

impl WorkflowBuilder {
    pub(crate) fn new(id: String) -> Self {
        Self {
            id,
            nodes: Vec::new(),
            storage: None,
            hub: ObservabilityHub::noop(),
        }
    }

    /// Attach storage: enables the per-node checkpoints and makes
    /// [`Workflow::resume`] / [`Workflow::cancel`] available. Without it,
    /// runs are in-memory only and cannot survive restarts.
    pub fn storage(mut self, storage: SharedStorage) -> Self {
        self.storage = Some(storage);
        self
    }

    /// Attach an observability hub; runs, step spans, and retries are
    /// recorded there. Defaults to noop.
    pub fn observability(mut self, hub: ObservabilityHub) -> Self {
        self.hub = hub;
        self
    }

    /// Append a sequential step; its output becomes the next node's input.
    pub fn then(mut self, step: impl Step + 'static) -> Self {
        self.nodes.push(Node::Step(Arc::new(step)));
        self
    }

    /// [`then`](Self::then) for a step that is already shared as an `Arc`.
    pub fn then_arc(mut self, step: Arc<dyn Step>) -> Self {
        self.nodes.push(Node::Step(step));
        self
    }

    /// Run all steps concurrently on the node input; the output is an
    /// object keyed by step id.
    pub fn parallel(mut self, steps: Vec<Arc<dyn Step>>) -> Self {
        self.nodes.push(Node::Parallel(steps));
        self
    }

    /// `branch(vec![(cond, step), ...])` — first matching arm runs. The
    /// condition receives the node input.
    pub fn branch(mut self, arms: Vec<(Condition, Arc<dyn Step>)>) -> Self {
        self.nodes.push(Node::Branch(arms));
        self
    }

    /// Run the step once per element of the (array) node input, at most
    /// `concurrency` at a time; the output is the array of results in
    /// input order.
    pub fn foreach(mut self, step: impl Step + 'static, concurrency: usize) -> Self {
        self.nodes.push(Node::ForEach {
            step: Arc::new(step),
            concurrency,
        });
        self
    }

    /// Repeat the step while the condition (over its output and the
    /// iteration count) is true.
    pub fn dowhile(mut self, step: impl Step + 'static, condition: Condition) -> Self {
        self.nodes.push(Node::Loop {
            step: Arc::new(step),
            condition,
            negate: false,
        });
        self
    }

    /// Repeat the step until the condition becomes true.
    pub fn dountil(mut self, step: impl Step + 'static, condition: Condition) -> Self {
        self.nodes.push(Node::Loop {
            step: Arc::new(step),
            condition,
            negate: true,
        });
        self
    }

    /// Pure data transform between steps.
    pub fn map(
        mut self,
        f: impl for<'a> Fn(MapContext<'a>) -> Value + Send + Sync + 'static,
    ) -> Self {
        self.nodes.push(Node::Map(Arc::new(f)));
        self
    }

    /// Pause in-process for `duration` before the next node.
    pub fn sleep(mut self, duration: Duration) -> Self {
        self.nodes.push(Node::Sleep(duration));
        self
    }

    /// Pause until the named event is delivered via [`Workflow::resume`].
    pub fn wait_for_event(mut self, event: impl Into<String>) -> Self {
        self.nodes.push(Node::WaitForEvent(event.into()));
        self
    }

    /// Finalize the builder into an executable [`Workflow`].
    pub fn commit(self) -> Workflow {
        Workflow::from_parts(self.id, self.nodes, self.storage, self.hub)
    }
}

/// Helper to build a [`Condition`] from a plain closure over the value.
pub fn cond(f: impl Fn(&Value) -> bool + Send + Sync + 'static) -> Condition {
    Arc::new(move |v, _| f(v))
}

/// Erase a concrete step to an `Arc<dyn Step>` for
/// [`WorkflowBuilder::parallel`] and [`WorkflowBuilder::branch`] arms.
pub fn arc_step(step: impl Step + 'static) -> Arc<dyn Step> {
    Arc::new(step)
}
