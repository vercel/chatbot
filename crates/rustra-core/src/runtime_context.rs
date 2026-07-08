use serde_json::Value;
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

use crate::principal::Principal;

/// Per-invocation dependency container, modelled on Mastra's
/// `RequestContext` (formerly `RuntimeContext`; the [`RequestContext`] alias
/// is provided for name parity with current Mastra docs).
///
/// A `RuntimeContext` is created at each entry point (HTTP request, task
/// firing, signal, webhook) and flows through the agent loop, tools,
/// workflow steps, and context sources. It carries:
///
/// * the resolved [`Principal`],
/// * arbitrary request-scoped variables (feature flags, tenant ids, model
///   overrides, tool configuration) as JSON values,
/// * correlation ids used by observability (`run_id`, `trace_id`).
///
/// It is cheap to clone (`Arc` inside) and safe to share across the async
/// call graph of a single invocation.
#[derive(Debug, Clone)]
pub struct RuntimeContext {
    inner: Arc<Inner>,
}

/// Name-parity alias: Mastra renamed `RuntimeContext` to `RequestContext`.
pub type RequestContext = RuntimeContext;

#[derive(Debug)]
struct Inner {
    principal: Principal,
    values: RwLock<HashMap<String, Value>>,
}

impl RuntimeContext {
    pub fn new(principal: Principal) -> Self {
        Self { inner: Arc::new(Inner { principal, values: RwLock::new(HashMap::new()) }) }
    }

    /// A context for the internal system principal (schedulers, supervisors).
    pub fn system() -> Self {
        Self::new(Principal::system())
    }

    pub fn principal(&self) -> &Principal {
        &self.inner.principal
    }

    /// The user id this invocation is scoped to. Used everywhere per-user
    /// isolation applies (memory resource ids, workspace roots, discovery).
    pub fn user_id(&self) -> &str {
        &self.inner.principal.user_id
    }

    pub fn set(&self, key: impl Into<String>, value: Value) {
        self.inner.values.write().expect("runtime context poisoned").insert(key.into(), value);
    }

    pub fn get(&self, key: &str) -> Option<Value> {
        self.inner.values.read().expect("runtime context poisoned").get(key).cloned()
    }

    pub fn get_str(&self, key: &str) -> Option<String> {
        self.get(key).and_then(|v| v.as_str().map(str::to_owned))
    }

    /// Derive a new context for a different principal while keeping the
    /// request-scoped variables. Used when the runtime deliberately crosses a
    /// user boundary (e.g. executing an explicitly shared flow); never done
    /// implicitly.
    pub fn with_principal(&self, principal: Principal) -> Self {
        let values = self.inner.values.read().expect("runtime context poisoned").clone();
        Self { inner: Arc::new(Inner { principal, values: RwLock::new(values) }) }
    }

    /// Well-known key: current observability run id.
    pub const RUN_ID: &'static str = "rustra.run_id";
    /// Well-known key: current trace id.
    pub const TRACE_ID: &'static str = "rustra.trace_id";
    /// Well-known key: current memory thread id.
    pub const THREAD_ID: &'static str = "rustra.thread_id";
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn set_get_roundtrip() {
        let ctx = RuntimeContext::new(Principal::user("u1"));
        ctx.set("flag", json!(true));
        assert_eq!(ctx.get("flag"), Some(json!(true)));
        assert_eq!(ctx.user_id(), "u1");
    }
}
