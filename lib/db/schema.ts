import type { InferSelectModel } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  integer,
  json,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const user = pgTable("User", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  email: varchar("email", { length: 64 }).notNull(),
  password: varchar("password", { length: 64 }),
  name: text("name"),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  isAnonymous: boolean("isAnonymous").notNull().default(false),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type User = InferSelectModel<typeof user>;

export const chat = pgTable("Chat", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  createdAt: timestamp("createdAt").notNull(),
  title: text("title").notNull(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  visibility: varchar("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("private"),
  // Phase 10: Chat resilience — parent chain and checkpoint linkage
  parentChatId: uuid("parent_chat_id"),
  checkpointId: uuid("checkpoint_id"),
});

export type Chat = InferSelectModel<typeof chat>;

export const message = pgTable("Message_v2", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  role: varchar("role").notNull(),
  parts: json("parts").notNull(),
  attachments: json("attachments").notNull(),
  createdAt: timestamp("createdAt").notNull(),
  // Phase 10: Token tracking + artifact metadata
  tokenCount: integer("token_count"),
  artifactSpec: text("artifact_spec"),
  artifactModel: varchar("artifact_model", { length: 64 }),
  // Phase 11: Artifact draft persistence for refresh recovery
  artifactDraft: text("artifact_draft"),
  streamPosition: integer("stream_position").default(0),
});

export type DBMessage = InferSelectModel<typeof message>;

export const vote = pgTable(
  "Vote_v2",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
    messageId: uuid("messageId")
      .notNull()
      .references(() => message.id),
    isUpvoted: boolean("isUpvoted").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.chatId, table.messageId] }),
  })
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
  "Document",
  {
    id: uuid("id").notNull().defaultRandom(),
    createdAt: timestamp("createdAt").notNull(),
    title: text("title").notNull(),
    content: text("content"),
    kind: varchar("text", { enum: ["text", "code", "image", "sheet"] })
      .notNull()
      .default("text"),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id, table.createdAt] }),
  })
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
  "Suggestion",
  {
    id: uuid("id").notNull().defaultRandom(),
    documentId: uuid("documentId").notNull(),
    documentCreatedAt: timestamp("documentCreatedAt").notNull(),
    originalText: text("originalText").notNull(),
    suggestedText: text("suggestedText").notNull(),
    description: text("description"),
    isResolved: boolean("isResolved").notNull().default(false),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
  })
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = pgTable(
  "Stream",
  {
    id: uuid("id").notNull().defaultRandom(),
    chatId: uuid("chatId").notNull(),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
    }),
  })
);

export type Stream = InferSelectModel<typeof stream>;

export const sandboxRun = pgTable("SandboxRun", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  sandboxId: text("sandboxId").notNull(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  toolName: text("toolName").notNull(),
  runtime: text("runtime").notNull().default("node24"),
  status: text("status").notNull().default("created"),
  stdout: text("stdout"),
  stderr: text("stderr"),
  durationMs: text("durationMs"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  destroyedAt: timestamp("destroyedAt"),
});

export type SandboxRun = InferSelectModel<typeof sandboxRun>;

// Phase 9: Handoff sessions table for V2 coding agent session tracking
export const handoffSession = pgTable("handoff_sessions", {
  id: text("id").primaryKey().notNull(),
  chatMessageId: text("chat_message_id"),
  userId: uuid("user_id").references(() => user.id),
  repo: text("repo"),
  goal: text("goal"),
  v2SessionId: text("v2_session_id"),
  v2SandboxId: text("v2_sandbox_id"),
  status: text("status").notNull().default("spawning"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  prUrl: text("pr_url"),
  deployUrl: text("deploy_url"),
  resultSummary: text("result_summary"),
});

export type HandoffSession = InferSelectModel<typeof handoffSession>;

// Phase 10: Chat checkpoints — auto-saved when conversation approaches context limit
export const chatCheckpoint = pgTable("chat_checkpoints", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chat_id")
    .notNull()
    .references(() => chat.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  reason: varchar("reason", { length: 32 }).notNull().default("manual"),
  tokenCount: integer("token_count").notNull().default(0),
  usagePercent: integer("usage_percent").notNull().default(0),
  conversationSummary: text("conversation_summary"),
  messageIds: jsonb("message_ids").default([]),
  modelId: varchar("model_id", { length: 64 }),
  contextWindow: integer("context_window"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ChatCheckpoint = InferSelectModel<typeof chatCheckpoint>;

// ── Phase 12: Library Graph Tables (0007_library_graph.sql) ──────────────────

export const libraryConnector = pgTable("library_connectors", {
  name: text("name").primaryKey().notNull(),
  domain: text("domain").notNull().default(""),
  mcpEnabled: boolean("mcp_enabled").notNull().default(false),
  description: text("description").notNull().default(""),
  primaryDomain: text("primary_domain"),
  alsoIn: jsonb("also_in").default([]),
  dependencies: jsonb("dependencies").default([]),
  tools: integer("tools").notNull().default(0),
  toolNames: jsonb("tool_names").default([]),
  version: text("version").notNull().default("1.0.0"),
  filePath: text("file_path"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LibraryConnector = InferSelectModel<typeof libraryConnector>;

export const librarySkill = pgTable(
  "library_skills",
  {
    name: text("name").notNull(),
    type: text("type").notNull().default("connector"),
    connectorName: text("connector_name"),
    description: text("description").notNull().default(""),
    filePath: text("file_path"),
    content: text("content"),
    version: text("version").notNull().default("1.0.0"),
    // Phase 13.A: Constraint-aware columns
    contextTokensEstimated: integer("context_tokens_estimated"),
    typicalLatencyMs: integer("typical_latency_ms"),
    costPerInvocationUsd: jsonb("cost_per_invocation_usd"),
    dependencies: jsonb("dependencies").default([]),
    incompatibleWith: jsonb("incompatible_with").default([]),
    optimalFor: jsonb("optimal_for").default([]),
    suboptimalFor: jsonb("suboptimal_for").default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.name, table.type] }),
  })
);

export type LibrarySkill = InferSelectModel<typeof librarySkill>;

export const libraryFunction = pgTable("library_functions", {
  name: text("name").primaryKey().notNull(),
  signature: text("signature"),
  skillName: text("skill_name"),
  description: text("description").notNull().default(""),
  domain: text("domain"),
  alsoIn: jsonb("also_in").default([]),
  dependencies: jsonb("dependencies").default([]),
  // Phase 13.A: Constraint-aware columns
  contextTokensEstimated: integer("context_tokens_estimated"),
  typicalLatencyMs: integer("typical_latency_ms"),
  costPerInvocationUsd: jsonb("cost_per_invocation_usd"),
  incompatibleWith: jsonb("incompatible_with").default([]),
  optimalFor: jsonb("optimal_for").default([]),
  suboptimalFor: jsonb("suboptimal_for").default([]),
  filePath: text("file_path"),
  version: text("version").notNull().default("1.0.0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LibraryFunction = InferSelectModel<typeof libraryFunction>;

export const libraryPlaybook = pgTable("library_playbooks", {
  name: text("name").primaryKey().notNull(),
  type: text("type").notNull().default("domain"),
  scopeConnectors: jsonb("scope_connectors").default([]),
  triggers: jsonb("triggers").default([]),
  workflows: jsonb("workflows").default([]),
  description: text("description").notNull().default(""),
  filePath: text("file_path"),
  content: text("content"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LibraryPlaybook = InferSelectModel<typeof libraryPlaybook>;

export const libraryWorkflow = pgTable("library_workflows", {
  name: text("name").primaryKey().notNull(),
  playbookName: text("playbook_name"),
  durable: boolean("durable").notNull().default(false),
  description: text("description").notNull().default(""),
  filePath: text("file_path"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LibraryWorkflow = InferSelectModel<typeof libraryWorkflow>;

export const libraryEdge = pgTable("library_edges", {
  id: uuid("id").primaryKey().defaultRandom(),
  fromNode: text("from_node").notNull(),
  fromType: text("from_type").notNull(),
  toNode: text("to_node").notNull(),
  toType: text("to_type").notNull(),
  edgeType: text("edge_type").notNull(),
  weight: integer("weight").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LibraryEdge = InferSelectModel<typeof libraryEdge>;

// ── Phase 13.B: Usage Logs ──────────────────────────────────────────────────

export const libraryUsageLog = pgTable("library_usage_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: text("session_id"),
  skillLoaded: text("skill_loaded").notNull(),
  skillType: text("skill_type").notNull().default("connector"),
  playbookRoutedFrom: text("playbook_routed_from"),
  successMarker: boolean("success_marker").notNull().default(true),
  tokensActual: integer("tokens_actual"),
  latencyActualMs: integer("latency_actual_ms"),
  costActualUsd: jsonb("cost_actual_usd"),
  coLoadedWith: jsonb("co_loaded_with").default([]),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
});

export type LibraryUsageLog = InferSelectModel<typeof libraryUsageLog>;

// ── Phase 14: Model Library (0009_model_library.sql) ─────────────────────────

export const libraryModel = pgTable("library_models", {
  identifier: text("identifier").primaryKey().notNull(),
  displayName: text("display_name").notNull().default(""),
  provider: text("provider").notNull().default(""),
  family: text("family"),
  version: text("version").notNull().default("1.0.0"),
  releaseDate: timestamp("release_date", { withTimezone: true }),
  contextWindowTokens: integer("context_window_tokens").notNull().default(0),
  maxOutputTokens: integer("max_output_tokens").notNull().default(0),
  inputPricePerMillion: numeric("input_price_per_million").notNull().default("0"),
  outputPricePerMillion: numeric("output_price_per_million").notNull().default("0"),
  cachedInputPrice: numeric("cached_input_price"),
  capabilities: jsonb("capabilities").notNull().default([]),
  modalities: jsonb("modalities").notNull().default([]),
  reasoningScore: integer("reasoning_score").default(0),
  codingScore: integer("coding_score").default(0),
  visionScore: integer("vision_score").default(0),
  speedScore: integer("speed_score").default(0),
  costScore: integer("cost_score").default(0),
  benchmarkScores: jsonb("benchmark_scores"),
  bestFor: jsonb("best_for").notNull().default([]),
  notGoodFor: jsonb("not_good_for").notNull().default([]),
  status: text("status").notNull().default("active"),
  sourceUrl: text("source_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LibraryModel = InferSelectModel<typeof libraryModel>;

export const libraryModelUsageLog = pgTable("library_model_usage_logs", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  sessionId: text("session_id"),
  modelUsed: text("model_used").notNull(),
  playbookRoutedFrom: text("playbook_routed_from"),
  skillRoutedTo: text("skill_routed_to"),
  tokensIn: integer("tokens_in"),
  tokensOut: integer("tokens_out"),
  latencyMs: integer("latency_ms"),
  costUsd: numeric("cost_usd", { precision: 14, scale: 8 }),
  successMarker: boolean("success_marker").notNull().default(true),
  userRating: integer("user_rating").default(0),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
});

export type LibraryModelUsageLog = InferSelectModel<typeof libraryModelUsageLog>;

// ── Phase 15: Evals (0010_library_evals.sql) ──────────────────────────────────

export const libraryEval = pgTable("library_evals", {
  id: uuid("id").primaryKey().defaultRandom(),
  evalName: text("eval_name").notNull(),
  domain: text("domain").notNull().default("general"),
  query: text("query").notNull(),
  expectedSkills: jsonb("expected_skills").notNull().default([]),
  expectedConnectors: jsonb("expected_connectors").notNull().default([]),
  expectedModel: text("expected_model"),
  successCriteria: jsonb("success_criteria").notNull().default({}),
  severity: text("severity").notNull().default("normal"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LibraryEval = InferSelectModel<typeof libraryEval>;

export const libraryEvalRun = pgTable("library_eval_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  evalId: uuid("eval_id").notNull().references(() => libraryEval.id, { onDelete: "cascade" }),
  sessionId: text("session_id"),
  runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("pending"),
  skillsLoaded: jsonb("skills_loaded").default([]),
  connectorsUsed: jsonb("connectors_used").default([]),
  modelUsed: text("model_used"),
  qualityGrade: text("quality_grade"),
  qualityScore: integer("quality_score"),
  subScores: jsonb("sub_scores"),
  latencyMs: integer("latency_ms"),
  costUsd: numeric("cost_usd", { precision: 14, scale: 8 }),
  tokensIn: integer("tokens_in"),
  tokensOut: integer("tokens_out"),
  errorMessage: text("error_message"),
  rawResponse: text("raw_response"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LibraryEvalRun = InferSelectModel<typeof libraryEvalRun>;

// ── Phase 19: Planning Sessions + Multi-V2 Handoff ────────────────────────

export const libraryPlan = pgTable("library_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  phases: jsonb("phases").default([]),
  acceptanceCriteria: jsonb("acceptance_criteria").default([]),
  filesAffected: jsonb("files_affected").default([]),
  skillsLoaded: jsonb("skills_loaded").default([]),
  status: text("status").notNull().default("draft"),
  contextGoal: text("context_goal"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LibraryPlan = InferSelectModel<typeof libraryPlan>;

export const libraryV2Session = pgTable("library_v2_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  planId: uuid("plan_id").references(() => libraryPlan.id, { onDelete: "set null" }),
  sessionId: text("session_id").notNull(),
  status: text("status").notNull().default("spawning"),
  progress: integer("progress").default(0),
  skillsLoaded: jsonb("skills_loaded").default([]),
  parallelGroup: text("parallel_group"),
  validationResults: jsonb("validation_results"),
  errorMessage: text("error_message"),
  prUrl: text("pr_url"),
  deployUrl: text("deploy_url"),
  streamUrl: text("stream_url"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LibraryV2Session = InferSelectModel<typeof libraryV2Session>;

// ── Phase 23A: Fusion Panel Containers (0011_fusion_panels.sql) ──────────────

export const libraryPanelPreset = pgTable("library_panel_presets", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description").notNull().default(""),
  agents: jsonb("agents").notNull().default([]),
  judge: jsonb("judge").notNull().default({}),
  capabilities: jsonb("capabilities").notNull().default(["council"]),
  domainHint: text("domain_hint").notNull().default("general"),
  defaultMode: text("default_mode").notNull().default("council"),
  estCostMin: numeric("est_cost_min", { precision: 10, scale: 6 }).notNull().default("0"),
  estCostMax: numeric("est_cost_max", { precision: 10, scale: 6 }).notNull().default("0"),
  isSystem: boolean("is_system").notNull().default(false),
  isDefault: boolean("is_default").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LibraryPanelPreset = InferSelectModel<typeof libraryPanelPreset>;

export const libraryPanelRun = pgTable("library_panel_runs", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  presetId: uuid("preset_id").references(() => libraryPanelPreset.id, { onDelete: "set null" }),
  presetName: text("preset_name").notNull(),
  sessionId: text("session_id"),
  userId: text("user_id"),
  executionMode: text("execution_mode").notNull().default("council"),
  modeDecision: text("mode_decision").notNull().default("auto"),
  modeOverride: text("mode_override"),
  taskAnalysis: jsonb("task_analysis").default({}),
  agentResponses: jsonb("agent_responses").default([]),
  judgeResponse: text("judge_response"),
  subTaskDecomposition: jsonb("sub_task_decomposition"),
  subModeBreakdown: jsonb("sub_mode_breakdown"),
  agentContributionScores: jsonb("agent_contribution_scores"),
  totalCost: numeric("total_cost", { precision: 10, scale: 8 }).default("0"),
  totalLatencyMs: integer("total_latency_ms").default(0),
  totalTokensIn: integer("total_tokens_in").default(0),
  totalTokensOut: integer("total_tokens_out").default(0),
  status: text("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  userRating: integer("user_rating"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LibraryPanelRun = InferSelectModel<typeof libraryPanelRun>;

export const libraryPanelTelemetry = pgTable("library_panel_telemetry", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  panelRunId: uuid("panel_run_id").notNull().references(() => libraryPanelRun.id, { onDelete: "cascade" }),
  agentModelId: text("agent_model_id").notNull(),
  agentRole: text("agent_role").notNull().default("agent"),
  latencyMs: integer("latency_ms").default(0),
  tokensIn: integer("tokens_in").default(0),
  tokensOut: integer("tokens_out").default(0),
  costUsd: numeric("cost_usd", { precision: 10, scale: 8 }).default("0"),
  success: boolean("success").notNull().default(true),
  errorMessage: text("error_message"),
  responsePreview: text("response_preview"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LibraryPanelTelemetry = InferSelectModel<typeof libraryPanelTelemetry>;

// ── Phase 23B: V2 Handoffs + Swarm Decompositions (0012) ─────────────────────

export const libraryV2Handoff = pgTable("library_v2_handoffs", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("user_id").references(() => user.id, { onDelete: "set null" }),
  chatId: uuid("chat_id").references(() => chat.id, { onDelete: "set null" }),
  v2SessionId: text("v2_session_id").notNull().unique(),
  handoffMode: text("handoff_mode").notNull(),
  targetRepo: text("target_repo"),
  goal: text("goal").notNull(),
  status: text("status").notNull().default("pending"),
  streamUrl: text("stream_url"),
  resultUrl: text("result_url"),
  errorMessage: text("error_message"),
  eventCount: integer("event_count").default(0),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  metadata: jsonb("metadata"),
});

export type LibraryV2Handoff = InferSelectModel<typeof libraryV2Handoff>;

export const librarySwarmDecomposition = pgTable("library_swarm_decompositions", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  panelRunId: uuid("panel_run_id").references(() => libraryPanelRun.id, { onDelete: "cascade" }),
  coordinatorModel: text("coordinator_model").notNull(),
  strategyText: text("strategy_text"),
  subTasks: jsonb("sub_tasks").notNull().default([]),
  coordinatorLatencyMs: integer("coordinator_latency_ms"),
  coordinatorCostUsd: numeric("coordinator_cost_usd", { precision: 10, scale: 4 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type LibrarySwarmDecomposition = InferSelectModel<typeof librarySwarmDecomposition>;

// ── Phase 25: Mission Cards + Generative UI (0015) ───────────────────────

export const libraryMission = pgTable("library_missions", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("user_id").references(() => user.id, { onDelete: "set null" }),
  chatId: uuid("chat_id").references(() => chat.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  status: text("status").notNull().default("pending"),
  steps: jsonb("steps").notNull().default([]),
  estimatedCost: numeric("estimated_cost", { precision: 10, scale: 4 }),
  estimatedTimeMin: integer("estimated_time_min"),
  actualCost: numeric("actual_cost", { precision: 10, scale: 4 }),
  actualTimeSec: integer("actual_time_sec"),
  v2SessionId: text("v2_session_id"),
  panelRunId: uuid("panel_run_id"),
  result: jsonb("result"),
  currentState: text("current_state").notNull().default("inline"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export type LibraryMission = InferSelectModel<typeof libraryMission>;

export const libraryMissionEvent = pgTable("library_mission_events", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  missionId: uuid("mission_id").notNull().references(() => libraryMission.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").default({}),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LibraryMissionEvent = InferSelectModel<typeof libraryMissionEvent>;

// ── Phase 25: Workflow Library (0016) ────────────────────────────────────

export const libraryWorkflowTemplate = pgTable("library_workflow_templates", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("user_id").references(() => user.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  steps: jsonb("steps").notNull().default([]),
  parameters: jsonb("parameters").default({}),
  schedule: text("schedule"),
  isShared: boolean("is_shared").notNull().default(false),
  tags: jsonb("tags").default([]),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LibraryWorkflowTemplate = InferSelectModel<typeof libraryWorkflowTemplate>;

export const libraryWorkflowRun = pgTable("library_workflow_runs", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  workflowId: uuid("workflow_id").references(() => libraryWorkflowTemplate.id, { onDelete: "cascade" }),
  missionId: uuid("mission_id").references(() => libraryMission.id, { onDelete: "set null" }),
  userId: uuid("user_id").references(() => user.id, { onDelete: "set null" }),
  status: text("status").notNull().default("pending"),
  stepResults: jsonb("step_results").default([]),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LibraryWorkflowRun = InferSelectModel<typeof libraryWorkflowRun>;
