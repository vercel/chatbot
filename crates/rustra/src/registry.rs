//! The central [`Rustra`] registry — the analogue of Mastra's `Mastra`
//! class — and its builder.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, OnceLock, RwLock};

use rustra_agent::{Agent, AgentBuilder, AgentDefinition, GenerateOptions, ToolApprover};
use rustra_browser::BrowserSessionManager;
use rustra_core::{Error, Principal, ResourceKind, Result, Tool, Visibility};
use rustra_knowledge::{KnowledgeContextSource, KnowledgeLibrary, KnowledgeRoot};
use rustra_llm::{LanguageModel, SharedModel};
use rustra_mcp::McpRegistry;
use rustra_memory::{Memory, MemoryConfig};
use rustra_messages::{ChannelRegistry, InAppChannel};
use rustra_observability::ObservabilityHub;
use rustra_rbac::{AccessControl, TokenAuthProvider};
use rustra_skills::{SkillContextSource, SkillLibrary, SkillRoot};
use rustra_storage::types::{DefinitionRecord, RunRecord};
use rustra_storage::{
    Embedder, InMemoryStorage, InMemoryVectorStore, MockEmbedder, SharedStorage, SharedVectorStore,
};
use rustra_storage_sqlite::{SqliteStorage, SqliteVectorStore};
use rustra_tasks::{InterruptController, Scheduler, SignalBus, TaskManager};
use rustra_ui::UiService;
use rustra_workflow::Workflow;
use rustra_workspace::{ShellPolicy, Workspace, WorkspaceManager};

use crate::executor::RustraExecutor;
use crate::hydrate;

/// Default instructions for the main coding agent.
const MAIN_AGENT_INSTRUCTIONS: &str = "\
You are the user's primary coding agent. You run the show: understand the \
request, locate relevant skills and knowledge, choose the right tools and \
flows, manage context, delegate to specialist agents when useful, and \
produce the final result yourself.

Working method:
1. Check whether an existing skill covers the task (`search_skills`); if one \
does, read it (`read_skill`) and follow its instructions.
2. Check knowledge collections for relevant information (`search_knowledge`).
3. Use your workspace tools (`workspace_read_file`, `workspace_write_file`, \
`workspace_list_files`, `workspace_search_files`, `workspace_grep`, \
`workspace_shell`; paths are relative to your workspace root, user files \
live under `files/`) to inspect and change code; keep changes minimal and \
verify them.
4. Persist durable facts about the user with `update_working_memory`.
5. Delegate narrowly-scoped subtasks to `ask_*` agents when one clearly \
fits; otherwise do the work yourself.
6. Use `send_message` to notify the user on other channels and `create_ui` \
when a visual artifact communicates better than text.";

/// A named, lock-guarded id → item map. Every registry on [`Rustra`]
/// (models, agents, workflows, tools) is one of these, so the lock
/// discipline and the not-found error live in exactly one place.
struct Registry<T: ?Sized> {
    kind: &'static str,
    items: RwLock<HashMap<String, Arc<T>>>,
}

impl<T: ?Sized> Registry<T> {
    fn new(kind: &'static str) -> Self {
        Self::with_items(kind, HashMap::new())
    }

    fn with_items(kind: &'static str, items: HashMap<String, Arc<T>>) -> Self {
        Self {
            kind,
            items: RwLock::new(items),
        }
    }

    fn insert(&self, id: String, item: Arc<T>) {
        self.items
            .write()
            .expect("registry poisoned")
            .insert(id, item);
    }

    fn get(&self, id: &str) -> Result<Arc<T>> {
        self.find(id).ok_or_else(|| Error::not_found(self.kind, id))
    }

    fn find(&self, id: &str) -> Option<Arc<T>> {
        self.items
            .read()
            .expect("registry poisoned")
            .get(id)
            .cloned()
    }

    fn values(&self) -> Vec<Arc<T>> {
        self.items
            .read()
            .expect("registry poisoned")
            .values()
            .cloned()
            .collect()
    }

    fn ids(&self) -> Vec<String> {
        self.items
            .read()
            .expect("registry poisoned")
            .keys()
            .cloned()
            .collect()
    }

    fn remove(&self, id: &str) {
        self.items.write().expect("registry poisoned").remove(id);
    }

    fn clear(&self) {
        self.items.write().expect("registry poisoned").clear();
    }
}

/// The wired runtime. Construct via [`Rustra::builder`]; most hosts keep one
/// `Arc<Rustra>` for the process lifetime.
pub struct Rustra {
    storage: SharedStorage,
    vector: SharedVectorStore,
    embedder: Arc<dyn Embedder>,
    hub: ObservabilityHub,
    acl: Arc<AccessControl>,
    auth: Arc<TokenAuthProvider>,
    memory: Arc<Memory>,

    models: Registry<dyn LanguageModel>,
    default_model: Option<String>,
    agents: Registry<Agent>,
    main_agents: Registry<Agent>,
    /// Bumped by every main-agent cache invalidation; guards against caching
    /// an agent whose build raced a registry mutation (see `main_agent_for`).
    main_agents_gen: AtomicU64,
    workflows: Registry<Workflow>,
    tools: Registry<dyn Tool>,

    shared_skill_roots: Vec<PathBuf>,
    shared_knowledge_roots: Vec<PathBuf>,
    shell_policy: ShellPolicy,
    approver: Option<Arc<dyn ToolApprover>>,
    generate_options: GenerateOptions,

    workspaces: Arc<WorkspaceManager>,
    mcp: Arc<McpRegistry>,
    channels: Arc<ChannelRegistry>,
    in_app: Arc<InAppChannel>,
    ui: Arc<UiService>,
    browser: Arc<BrowserSessionManager>,

    // Set once during build (they need an Arc<Rustra> back-reference).
    tasks: OnceLock<Arc<TaskManager>>,
    scheduler: OnceLock<Arc<Scheduler>>,
    signals: OnceLock<Arc<SignalBus>>,
    interrupts: Arc<InterruptController>,

    /// Weak self-reference (set via `Arc::new_cyclic`) so long-lived
    /// closures (hydrated flows, executors) never keep the runtime alive.
    weak_self: std::sync::Weak<Rustra>,
}

impl Rustra {
    /// Start building a runtime; finish with [`RustraBuilder::build`].
    pub fn builder() -> RustraBuilder {
        RustraBuilder::default()
    }

    pub(crate) fn weak_self(&self) -> std::sync::Weak<Rustra> {
        self.weak_self.clone()
    }

    // -- Subsystem accessors -------------------------------------------------

    /// The storage backend everything persists through.
    pub fn storage(&self) -> &SharedStorage {
        &self.storage
    }
    /// The vector store backing semantic recall.
    pub fn vector(&self) -> &SharedVectorStore {
        &self.vector
    }
    /// The embedder powering semantic recall (and available to hosts for
    /// their own indexing).
    pub fn embedder(&self) -> &Arc<dyn Embedder> {
        &self.embedder
    }
    /// Hub recording runs, spans, and scores.
    pub fn observability(&self) -> &ObservabilityHub {
        &self.hub
    }
    /// Access control used for definition and resource checks.
    pub fn acl(&self) -> &Arc<AccessControl> {
        &self.acl
    }
    /// Token-based auth provider for host integrations.
    pub fn auth(&self) -> &Arc<TokenAuthProvider> {
        &self.auth
    }
    /// Shared conversation/working memory.
    pub fn memory(&self) -> &Arc<Memory> {
        &self.memory
    }
    /// Per-user workspace manager (files, skills, knowledge dirs).
    pub fn workspaces(&self) -> &Arc<WorkspaceManager> {
        &self.workspaces
    }
    /// Registry of per-user MCP server records and connections.
    pub fn mcp(&self) -> &Arc<McpRegistry> {
        &self.mcp
    }
    /// Outbound message channel registry.
    pub fn channels(&self) -> &Arc<ChannelRegistry> {
        &self.channels
    }
    /// The built-in in-app channel (always registered).
    pub fn in_app(&self) -> &Arc<InAppChannel> {
        &self.in_app
    }
    /// Generative-UI artifact service.
    pub fn ui(&self) -> &Arc<UiService> {
        &self.ui
    }
    /// Browser session manager backing the browser tool.
    pub fn browser(&self) -> &Arc<BrowserSessionManager> {
        &self.browser
    }
    /// Pending human-in-the-loop decisions (approvals).
    pub fn interrupts(&self) -> &Arc<InterruptController> {
        &self.interrupts
    }
    /// Background task manager. Panics only if called during `build`.
    pub fn tasks(&self) -> &Arc<TaskManager> {
        self.tasks
            .get()
            .expect("Rustra::build wires the task manager")
    }
    /// Cron schedule runner. Panics only if called during `build`.
    pub fn scheduler(&self) -> &Arc<Scheduler> {
        self.scheduler
            .get()
            .expect("Rustra::build wires the scheduler")
    }
    /// Webhook/event signal bus. Panics only if called during `build`.
    pub fn signals(&self) -> &Arc<SignalBus> {
        self.signals
            .get()
            .expect("Rustra::build wires the signal bus")
    }

    // -- Model / agent / workflow / tool registries ---------------------------

    /// Register a model under `id`; referenced by agents and definitions.
    pub fn register_model(&self, id: impl Into<String>, model: SharedModel) {
        self.models.insert(id.into(), model);
        // Main agents embed the default model instance; rebuild them lazily.
        self.invalidate_main_agents();
    }

    /// Look up a registered model by id.
    pub fn model(&self, id: &str) -> Result<SharedModel> {
        self.models.get(id)
    }

    /// The model registered under the configured default id;
    /// [`Error::Config`] if no default was configured.
    pub fn default_model(&self) -> Result<SharedModel> {
        let id = self
            .default_model
            .as_deref()
            .ok_or_else(|| Error::Config("no default model configured".into()))?;
        self.model(id)
    }

    /// Ids of all registered models.
    pub fn model_ids(&self) -> Vec<String> {
        self.models.ids()
    }

    /// Register a globally available (system-defined) agent. It becomes a
    /// delegation target of every user's main agent.
    pub fn register_agent(&self, agent: Arc<Agent>) {
        self.agents.insert(agent.id().to_string(), agent);
        // Main agents embed the delegation list; rebuild them lazily.
        self.invalidate_main_agents();
    }

    /// Look up a registered system agent by id.
    pub fn agent(&self, id: &str) -> Result<Arc<Agent>> {
        self.agents.get(id)
    }

    /// All registered system agents.
    pub fn agents(&self) -> Vec<Arc<Agent>> {
        self.agents.values()
    }

    /// Register a code-defined workflow as a task/signal target.
    pub fn register_workflow(&self, workflow: Arc<Workflow>) {
        self.workflows.insert(workflow.id().to_string(), workflow);
    }

    /// Look up a registered workflow by id.
    pub fn workflow(&self, id: &str) -> Result<Arc<Workflow>> {
        self.workflows.get(id)
    }

    /// All registered workflows.
    pub fn workflows(&self) -> Vec<Arc<Workflow>> {
        self.workflows.values()
    }

    /// Fetch a run, enforcing owner-or-admin scope: any principal may read
    /// their own runs, admins may read anyone's.
    pub async fn run_scoped(&self, principal: &Principal, run_id: &str) -> Result<RunRecord> {
        let run = self
            .storage()
            .get_run(run_id)
            .await?
            .ok_or_else(|| Error::not_found("run", run_id))?;
        if run.user_id != principal.user_id && !principal.is_admin() {
            return Err(Error::PermissionDenied(format!(
                "run `{run_id}` belongs to another user"
            )));
        }
        Ok(run)
    }

    /// Resolve an agent by id: the in-process registry first, then a stored
    /// agent definition instantiated on the caller's behalf.
    pub async fn resolve_agent(&self, principal: &Principal, id: &str) -> Result<Arc<Agent>> {
        match self.agent(id) {
            Ok(agent) => Ok(agent),
            Err(Error::NotFound { .. }) => self.instantiate_agent(principal, id).await,
            Err(error) => Err(error),
        }
    }

    /// Resolve a workflow by id: the in-process registry first, then a stored
    /// flow definition instantiated on the caller's behalf.
    pub async fn resolve_workflow(&self, principal: &Principal, id: &str) -> Result<Arc<Workflow>> {
        match self.workflow(id) {
            Ok(workflow) => Ok(workflow),
            Err(Error::NotFound { .. }) => self.instantiate_flow(principal, id).await,
            Err(error) => Err(error),
        }
    }

    /// Register a tool; it joins every user's main-agent toolbelt.
    pub fn register_tool(&self, tool: Arc<dyn Tool>) {
        self.tools.insert(tool.id().to_string(), tool);
        // Main agents embed the registered toolbelt; rebuild them lazily.
        self.invalidate_main_agents();
    }

    /// Look up a registered tool by id.
    pub fn tool(&self, id: &str) -> Result<Arc<dyn Tool>> {
        self.tools.get(id)
    }

    /// All registered tools.
    pub fn tools(&self) -> Vec<Arc<dyn Tool>> {
        self.tools.values()
    }

    // -- Main-agent cache invalidation -----------------------------------------

    /// Drop `user_id`'s cached main agent; it is rebuilt on the next request
    /// (e.g. after changing that user's MCP servers or workspace layout).
    pub fn invalidate_main_agent(&self, user_id: &str) {
        self.main_agents_gen.fetch_add(1, Ordering::SeqCst);
        self.main_agents.remove(user_id);
    }

    /// Drop every cached main agent; they are rebuilt lazily on the next
    /// request. Called automatically when registries the agents embed
    /// (models, tools, delegation targets) change.
    pub fn invalidate_main_agents(&self) {
        self.main_agents_gen.fetch_add(1, Ordering::SeqCst);
        self.main_agents.clear();
    }

    // -- The main agent --------------------------------------------------------

    /// The primary coding agent for a user: memory on, dynamic context from
    /// skills/knowledge/memory/workspace, the full workspace toolbelt,
    /// messaging/UI/browser tools, and delegation to every registered agent.
    /// Built once per user and cached.
    pub async fn main_agent_for(&self, user_id: &str) -> Result<Arc<Agent>> {
        // Generation guard: if any invalidation lands while we build (say a
        // concurrent `register_agent`), the freshly built agent may already
        // be stale — return it, but do not cache it; the next call rebuilds.
        let generation = self.main_agents_gen.load(Ordering::SeqCst);
        if let Some(agent) = self.main_agents.find(user_id) {
            return Ok(agent);
        }

        let agent = self.build_main_agent(user_id).await?;
        if self.main_agents_gen.load(Ordering::SeqCst) == generation {
            self.main_agents
                .insert(user_id.to_string(), Arc::clone(&agent));
        }
        Ok(agent)
    }

    /// Assemble a user's main agent — the cache-miss path of
    /// [`Rustra::main_agent_for`].
    async fn build_main_agent(&self, user_id: &str) -> Result<Arc<Agent>> {
        let workspace = Arc::new(self.workspaces.workspace_for_user(user_id).await?);
        let skills = self.skill_library_for(&workspace, user_id);
        let knowledge = self.knowledge_library_for(&workspace, user_id);

        let mut builder = Agent::builder("main")
            .name("Main agent")
            .description("The user's primary coding agent")
            .instructions(MAIN_AGENT_INSTRUCTIONS)
            .model(self.default_model()?)
            .memory(Arc::clone(&self.memory))
            .observability(self.hub.clone())
            .options(self.generate_options.clone())
            .context_source(Arc::new(SkillContextSource::new(Arc::clone(&skills))))
            .context_source(Arc::new(KnowledgeContextSource::new(Arc::clone(
                &knowledge,
            ))))
            .context_source(Arc::new(rustra_workspace::WorkspaceContextSource::new(
                Arc::clone(&workspace),
            )))
            .context_source(Arc::new(crate::context::UserProfileContextSource::new(
                self.storage.clone(),
            )))
            .context_source(Arc::new(crate::context::PriorRunsContextSource::new(
                self.storage.clone(),
            )))
            // Skills & knowledge discovery.
            .tool(Arc::new(rustra_skills::search_skills_tool(Arc::clone(
                &skills,
            ))))
            .tool(Arc::new(rustra_skills::read_skill_tool(skills)))
            .tool(Arc::new(rustra_knowledge::search_knowledge_tool(
                Arc::clone(&knowledge),
            )))
            .tool(Arc::new(rustra_knowledge::read_knowledge_tool(knowledge)));

        // Workspace.
        for tool in
            rustra_workspace::workspace_tools(Arc::clone(&workspace), self.shell_policy.clone())
        {
            builder = builder.tool(Arc::new(tool));
        }

        builder = builder
            // Channels, UI, browser.
            .tool(Arc::new(rustra_messages::send_message_tool(Arc::clone(
                &self.channels,
            ))))
            .tool(Arc::new(rustra_ui::create_ui_tool(Arc::clone(&self.ui))))
            .tool(Arc::new(rustra_browser::browser_tool(Arc::clone(
                &self.browser,
            ))));

        // Registered tools.
        for tool in self.tools.values() {
            builder = builder.tool(tool);
        }
        builder = self.attach_mcp_toolsets(builder, user_id).await?;
        // Delegation targets.
        for agent in self.agents() {
            builder = builder.sub_agent(agent);
        }
        if let Some(approver) = &self.approver {
            builder = builder.approver(Arc::clone(approver));
        }

        Ok(Arc::new(builder.build()?))
    }

    /// The user's skill roots (workspace-local plus shared) as one library.
    fn skill_library_for(&self, workspace: &Workspace, user_id: &str) -> Arc<SkillLibrary> {
        let mut skill_roots = vec![SkillRoot::user(workspace.skills_dir(), user_id)];
        skill_roots.extend(self.shared_skill_roots.iter().map(SkillRoot::shared));
        Arc::new(SkillLibrary::new(skill_roots))
    }

    /// The user's knowledge roots (workspace-local plus shared) as one
    /// library.
    fn knowledge_library_for(&self, workspace: &Workspace, user_id: &str) -> Arc<KnowledgeLibrary> {
        let mut knowledge_roots = vec![KnowledgeRoot::user(workspace.knowledge_dir(), user_id)];
        knowledge_roots.extend(
            self.shared_knowledge_roots
                .iter()
                .map(KnowledgeRoot::shared),
        );
        Arc::new(KnowledgeLibrary::new(knowledge_roots))
    }

    /// Attach MCP toolsets from the user's enabled server-side servers. A
    /// server that fails to connect is skipped with a warning — MCP
    /// availability must never take the main agent down.
    async fn attach_mcp_toolsets(
        &self,
        mut builder: AgentBuilder,
        user_id: &str,
    ) -> Result<AgentBuilder> {
        for record in self
            .mcp
            .list_for_user(user_id, /* include_shared = */ true)
            .await?
        {
            if !record.enabled {
                continue;
            }
            match self.mcp.connect(&record).await {
                Ok(client) => {
                    let definition = rustra_mcp::McpServerDefinition::from_record(&record)?;
                    let toolset = rustra_mcp::McpToolset::new(Arc::new(client), definition);
                    match toolset.tools().await {
                        Ok(tools) => {
                            for tool in tools {
                                builder = builder.tool(tool);
                            }
                        }
                        Err(e) => {
                            tracing::warn!(server = %record.name, error = %e, "mcp tools/list failed; skipping server");
                        }
                    }
                }
                // Client-side/disabled servers surface as Config errors —
                // expected, skip quietly; real failures get a warning.
                Err(Error::Config(_)) => {}
                Err(e) => {
                    tracing::warn!(server = %record.name, error = %e, "mcp connect failed; skipping server");
                }
            }
        }
        Ok(builder)
    }

    // -- User-created definitions ----------------------------------------------

    /// Persist a user-created agent definition (versioned, private by
    /// default) and return the stored record.
    pub async fn save_agent_definition(
        &self,
        principal: &Principal,
        definition: AgentDefinition,
    ) -> Result<DefinitionRecord> {
        definition.validate()?;
        // Referenced models/tools/agents must resolve at save time so broken
        // definitions are rejected early.
        self.model(&definition.model)?;
        for tool_id in &definition.tools {
            self.tool(tool_id)?;
        }
        for agent_id in &definition.agents {
            self.agent(agent_id)?;
        }
        self.put_definition(principal, ResourceKind::Agent, &definition.id, &definition)
            .await
    }

    /// Persist a user-created flow definition (versioned, private by
    /// default) and return the stored record.
    pub async fn save_flow_definition(
        &self,
        principal: &Principal,
        definition: rustra_workflow::FlowDefinition,
    ) -> Result<DefinitionRecord> {
        definition.validate()?;
        self.put_definition(principal, ResourceKind::Flow, &definition.id, &definition)
            .await
    }

    async fn put_definition<T: serde::Serialize>(
        &self,
        principal: &Principal,
        kind: ResourceKind,
        id: &str,
        definition: &T,
    ) -> Result<DefinitionRecord> {
        let record = DefinitionRecord {
            id: id.to_string(),
            kind,
            owner_id: principal.user_id.clone(),
            name: id.to_string(),
            version: 0,
            spec: serde_json::to_value(definition)?,
            visibility: Visibility::Private,
            latest: false,
            created_at: chrono::Utc::now(),
        };
        // Updating someone else's definition requires ownership/admin.
        if let Some(existing) = self.storage.get_definition(kind, id).await? {
            if existing.owner_id != principal.user_id && !principal.is_admin() {
                return Err(Error::PermissionDenied(format!(
                    "{kind} `{id}` belongs to another user"
                )));
            }
        }
        self.storage.put_definition(record).await
    }

    /// Instantiate a stored agent definition into a live agent, enforcing
    /// execute access (owner, granted, or public — shared visibility alone
    /// does not grant execution).
    pub async fn instantiate_agent(
        &self,
        principal: &Principal,
        definition_id: &str,
    ) -> Result<Arc<Agent>> {
        let record = self
            .storage
            .get_definition(ResourceKind::Agent, definition_id)
            .await?
            .ok_or_else(|| Error::not_found("agent definition", definition_id))?;
        self.require_definition_access(principal, &record).await?;
        let definition: AgentDefinition = serde_json::from_value(record.spec)?;
        hydrate::agent_from_definition(self, &definition).map(Arc::new)
    }

    /// Instantiate a stored flow definition into a runnable workflow,
    /// enforcing execute access (owner, granted, or public — shared
    /// visibility alone does not grant execution).
    pub async fn instantiate_flow(
        &self,
        principal: &Principal,
        definition_id: &str,
    ) -> Result<Arc<Workflow>> {
        let record = self
            .storage
            .get_definition(ResourceKind::Flow, definition_id)
            .await?
            .ok_or_else(|| Error::not_found("flow definition", definition_id))?;
        self.require_definition_access(principal, &record).await?;
        let definition: rustra_workflow::FlowDefinition = serde_json::from_value(record.spec)?;
        hydrate::flow_from_definition(self, &definition).map(Arc::new)
    }

    async fn require_definition_access(
        &self,
        principal: &Principal,
        record: &DefinitionRecord,
    ) -> Result<()> {
        let governed = rustra_rbac::Governed::from(record);
        self.acl
            .require(principal, rustra_core::Action::Execute, &governed)
            .await
    }
}

/// Builder for [`Rustra`]. Storage defaults to in-memory; call
/// [`RustraBuilder::sqlite`] for the persistent default.
pub struct RustraBuilder {
    storage: Option<SharedStorage>,
    vector: Option<SharedVectorStore>,
    embedder: Arc<dyn Embedder>,
    models: HashMap<String, SharedModel>,
    default_model: Option<String>,
    memory_config: MemoryConfig,
    workspace_dir: PathBuf,
    shared_skill_roots: Vec<PathBuf>,
    shared_knowledge_roots: Vec<PathBuf>,
    shell_policy: ShellPolicy,
    approver: Option<Arc<dyn ToolApprover>>,
    generate_options: GenerateOptions,
    scheduler_tick: std::time::Duration,
}

impl Default for RustraBuilder {
    fn default() -> Self {
        Self {
            storage: None,
            vector: None,
            embedder: Arc::new(MockEmbedder::default()),
            models: HashMap::new(),
            default_model: None,
            memory_config: MemoryConfig::default(),
            workspace_dir: PathBuf::from("./rustra-workspaces"),
            shared_skill_roots: Vec::new(),
            shared_knowledge_roots: Vec::new(),
            shell_policy: ShellPolicy::default(),
            approver: None,
            generate_options: GenerateOptions::default(),
            scheduler_tick: std::time::Duration::from_secs(5),
        }
    }
}

impl RustraBuilder {
    /// Use SQLite persistence (the default backend) rooted at `path`.
    /// Vectors live beside it in `<path>.vectors`.
    pub fn sqlite(mut self, path: impl AsRef<std::path::Path>) -> Result<Self> {
        let path = path.as_ref();
        self.storage = Some(Arc::new(SqliteStorage::open(path)?));
        let mut vector_path = path.as_os_str().to_owned();
        vector_path.push(".vectors");
        self.vector = Some(Arc::new(SqliteVectorStore::open(vector_path)?));
        Ok(self)
    }

    /// Use any storage backend (Postgres, Firebase, custom).
    pub fn storage(mut self, storage: SharedStorage) -> Self {
        self.storage = Some(storage);
        self
    }

    /// Override the vector store (defaults to in-memory, or SQLite via
    /// [`RustraBuilder::sqlite`]).
    pub fn vector(mut self, vector: SharedVectorStore) -> Self {
        self.vector = Some(vector);
        self
    }

    /// The embedder powering semantic recall. Defaults to the deterministic
    /// [`MockEmbedder`] — swap in a real embeddings API for production.
    pub fn embedder(mut self, embedder: Arc<dyn Embedder>) -> Self {
        self.embedder = embedder;
        self
    }

    /// Register a model under `id` at build time.
    pub fn model(mut self, id: impl Into<String>, model: SharedModel) -> Self {
        self.models.insert(id.into(), model);
        self
    }

    /// The id of the model the main agent and definitions use by default.
    pub fn default_model(mut self, id: impl Into<String>) -> Self {
        self.default_model = Some(id.into());
        self
    }

    /// Tune memory (recall scope, working-memory template, limits).
    pub fn memory_config(mut self, config: MemoryConfig) -> Self {
        self.memory_config = config;
        self
    }

    /// Root directory under which per-user workspaces are created.
    pub fn workspace_dir(mut self, dir: impl Into<PathBuf>) -> Self {
        self.workspace_dir = dir.into();
        self
    }

    /// A skills directory visible to every user (deployment-provided
    /// skills). Per-user skills always live in each user's workspace.
    pub fn shared_skills(mut self, dir: impl Into<PathBuf>) -> Self {
        self.shared_skill_roots.push(dir.into());
        self
    }

    /// A knowledge directory visible to every user; per-user knowledge
    /// lives in each user's workspace.
    pub fn shared_knowledge(mut self, dir: impl Into<PathBuf>) -> Self {
        self.shared_knowledge_roots.push(dir.into());
        self
    }

    /// Policy applied to `workspace_shell` executions.
    pub fn shell_policy(mut self, policy: ShellPolicy) -> Self {
        self.shell_policy = policy;
        self
    }

    /// Tool approver applied to the main agent (e.g.
    /// [`rustra_tasks::HitlToolApprover`] for human approval of selected
    /// tools).
    pub fn approver(mut self, approver: Arc<dyn ToolApprover>) -> Self {
        self.approver = Some(approver);
        self
    }

    /// Default generation options for the main agent.
    pub fn generate_options(mut self, options: GenerateOptions) -> Self {
        self.generate_options = options;
        self
    }

    /// How often the scheduler polls for due schedules (default 5s).
    pub fn scheduler_tick(mut self, tick: std::time::Duration) -> Self {
        self.scheduler_tick = tick;
        self
    }

    /// Wire and return the runtime. Storage/vector default to in-memory
    /// when unset.
    pub async fn build(self) -> Result<Arc<Rustra>> {
        let storage = self
            .storage
            .unwrap_or_else(|| Arc::new(InMemoryStorage::new()));
        let vector = self
            .vector
            .unwrap_or_else(|| Arc::new(InMemoryVectorStore::new()));
        let hub = ObservabilityHub::new(storage.clone());
        let memory = Arc::new(
            Memory::new(storage.clone())
                .with_config(self.memory_config)
                .with_vector(vector.clone(), Arc::clone(&self.embedder)),
        );
        let in_app = Arc::new(InAppChannel::new(storage.clone()));
        let channels =
            Arc::new(ChannelRegistry::new(storage.clone()).with_adapter(in_app.clone() as Arc<_>));

        let rustra = Arc::new_cyclic(|weak| Rustra {
            weak_self: weak.clone(),
            embedder: self.embedder,
            acl: Arc::new(AccessControl::new(storage.clone())),
            auth: Arc::new(TokenAuthProvider::new(storage.clone())),
            memory,
            models: Registry::with_items("model", self.models),
            default_model: self.default_model,
            agents: Registry::new("agent"),
            main_agents: Registry::new("main agent"),
            main_agents_gen: AtomicU64::new(0),
            workflows: Registry::new("workflow"),
            tools: Registry::new("tool"),
            shared_skill_roots: self.shared_skill_roots,
            shared_knowledge_roots: self.shared_knowledge_roots,
            shell_policy: self.shell_policy,
            approver: self.approver,
            generate_options: self.generate_options,
            workspaces: Arc::new(WorkspaceManager::new(self.workspace_dir, storage.clone())),
            mcp: Arc::new(McpRegistry::new(storage.clone())),
            channels,
            in_app,
            ui: Arc::new(UiService::new(storage.clone())),
            browser: Arc::new(BrowserSessionManager::new()),
            tasks: OnceLock::new(),
            scheduler: OnceLock::new(),
            signals: OnceLock::new(),
            interrupts: InterruptController::new(storage.clone()),
            hub,
            vector,
            storage,
        });

        // Task runtime holds a weak back-reference so `Rustra` can be
        // dropped cleanly.
        let executor = Arc::new(RustraExecutor::new(hydrate::WeakRustra::downgrade(&rustra)));
        let tasks = TaskManager::new(rustra.storage.clone(), executor);
        let scheduler = Scheduler::with_tick(
            rustra.storage.clone(),
            Arc::clone(&tasks),
            self.scheduler_tick,
        );
        let signals = SignalBus::new(rustra.storage.clone(), Arc::clone(&tasks));
        rustra.tasks.set(tasks).ok();
        rustra.scheduler.set(scheduler).ok();
        rustra.signals.set(signals).ok();
        Ok(rustra)
    }
}
