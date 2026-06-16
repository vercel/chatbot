-- Phase 23A: Fusion Panel Containers — Council Mode + Toggle-In-Input UI
-- Migration 0011: library_panel_presets + library_panel_runs + library_panel_telemetry
-- Panel is a SMART CONTAINER: holds agents + judge + capabilities
-- Modes: council (accuracy) | swarm (efficiency) | hybrid (complex)

-- ═══════════════════════════════════════════════════════════════════════════════
-- library_panel_presets — Preconfigured agent panels for multi-model execution
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "library_panel_presets" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"            text NOT NULL UNIQUE,
  "description"     text NOT NULL DEFAULT '',
  "agents"          jsonb NOT NULL DEFAULT '[]'::jsonb,
  "judge"           jsonb NOT NULL DEFAULT '{}'::jsonb,
  "capabilities"    jsonb NOT NULL DEFAULT '["council"]'::jsonb,
  "domain_hint"     text NOT NULL DEFAULT 'general',
  "default_mode"    text NOT NULL DEFAULT 'council',
  "est_cost_min"    numeric(10,6) NOT NULL DEFAULT 0,
  "est_cost_max"    numeric(10,6) NOT NULL DEFAULT 0,
  "is_system"       boolean NOT NULL DEFAULT false,
  "is_default"      boolean NOT NULL DEFAULT false,
  "sort_order"      integer NOT NULL DEFAULT 0,
  "created_by"      text,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"      timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT "chk_panel_presets_default_mode" CHECK ("default_mode" IN ('council', 'swarm', 'hybrid')),
  CONSTRAINT "chk_panel_presets_domain_hint" CHECK ("domain_hint" IN ('general', 'coding', 'research', 'reasoning'))
);

COMMENT ON TABLE "library_panel_presets" IS 'Preconfigured agent panels: agents[] + judge + capabilities[] + domain hint. Panel is a container — mode decided at runtime.';
COMMENT ON COLUMN "library_panel_presets"."agents" IS 'JSON array of agent model configs [{modelId, provider, name, role}]';
COMMENT ON COLUMN "library_panel_presets"."judge" IS 'JSON object {modelId, provider, name, role: "judge"}';
COMMENT ON COLUMN "library_panel_presets"."capabilities" IS 'JSON array of supported execution modes ["council","swarm","hybrid"]. All presets support all three.';
COMMENT ON COLUMN "library_panel_presets"."domain_hint" IS 'general | coding | research | reasoning — helps task analyzer narrow selection';
COMMENT ON COLUMN "library_panel_presets"."default_mode" IS 'Preferred mode for this panel: council | swarm | hybrid';
COMMENT ON COLUMN "library_panel_presets"."is_system" IS 'System preset (true) vs user-created (false). System presets are read-only.';
COMMENT ON COLUMN "library_panel_presets"."is_default" IS 'Only one preset can be the default for new users.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- library_panel_runs — Execution history for each panel invocation
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "library_panel_runs" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "preset_id"           uuid REFERENCES "library_panel_presets"("id") ON DELETE SET NULL,
  "preset_name"         text NOT NULL,
  "session_id"          text,
  "user_id"             text,
  "execution_mode"      text NOT NULL DEFAULT 'council',
  "mode_decision"       text NOT NULL DEFAULT 'auto',
  "mode_override"       text,
  "task_analysis"       jsonb DEFAULT '{}'::jsonb,
  "agent_responses"     jsonb DEFAULT '[]'::jsonb,
  "judge_response"      text,
  "sub_task_decomposition" jsonb,
  "sub_mode_breakdown"  jsonb,
  "agent_contribution_scores" jsonb,
  "total_cost"          numeric(10,8) DEFAULT 0,
  "total_latency_ms"    integer DEFAULT 0,
  "total_tokens_in"     integer DEFAULT 0,
  "total_tokens_out"    integer DEFAULT 0,
  "status"              text NOT NULL DEFAULT 'pending',
  "error_message"       text,
  "user_rating"         integer,
  "started_at"          timestamp with time zone,
  "completed_at"        timestamp with time zone,
  "created_at"          timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT "chk_panel_runs_execution_mode" CHECK ("execution_mode" IN ('council', 'swarm', 'hybrid')),
  CONSTRAINT "chk_panel_runs_mode_decision" CHECK ("mode_decision" IN ('auto', 'user-forced')),
  CONSTRAINT "chk_panel_runs_status" CHECK ("status" IN ('pending', 'running', 'completed', 'failed', 'cancelled'))
);

COMMENT ON TABLE "library_panel_runs" IS 'Execution history for each panel invocation. Records mode, task analysis, agent responses, cost, and latency.';
COMMENT ON COLUMN "library_panel_runs"."execution_mode" IS 'council | swarm | hybrid — the mode actually used for this run';
COMMENT ON COLUMN "library_panel_runs"."mode_decision" IS 'auto (task analyzer picked) | user-forced (user overrode)';
COMMENT ON COLUMN "library_panel_runs"."mode_override" IS 'If user forced, which mode they selected';
COMMENT ON COLUMN "library_panel_runs"."task_analysis" IS 'JSONB: {type, scope, requiresAccuracy, requiresDecomposition, estimatedSubTasks, recommendedMode} — why we picked this mode';
COMMENT ON COLUMN "library_panel_runs"."agent_responses" IS 'JSON array of [{modelId, latency, tokens, response, success}]';
COMMENT ON COLUMN "library_panel_runs"."judge_response" IS 'Final synthesized response from the judge model';
COMMENT ON COLUMN "library_panel_runs"."sub_task_decomposition" IS 'For swarm mode: coordinator sub-task list';
COMMENT ON COLUMN "library_panel_runs"."sub_mode_breakdown" IS 'For hybrid mode: which sub-tasks used which mode';
COMMENT ON COLUMN "library_panel_runs"."agent_contribution_scores" IS '{modelId: score} — for self-evolution analytics';

CREATE INDEX IF NOT EXISTS idx_panel_runs_preset ON "library_panel_runs"("preset_id", "created_at");
CREATE INDEX IF NOT EXISTS idx_panel_runs_mode ON "library_panel_runs"("execution_mode", "created_at");
CREATE INDEX IF NOT EXISTS idx_panel_runs_session ON "library_panel_runs"("session_id");
CREATE INDEX IF NOT EXISTS idx_panel_runs_user ON "library_panel_runs"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS idx_panel_runs_status ON "library_panel_runs"("status", "created_at");

COMMENT ON INDEX idx_panel_runs_preset IS 'Query panel runs by preset for analytics';
COMMENT ON INDEX idx_panel_runs_mode IS 'Query panel runs by execution mode for mode performance analysis';
COMMENT ON INDEX idx_panel_runs_session IS 'Link panel runs to chat sessions';
COMMENT ON INDEX idx_panel_runs_user IS 'Per-user panel run history';
COMMENT ON INDEX idx_panel_runs_status IS 'Filter by run status for monitoring';

-- ═══════════════════════════════════════════════════════════════════════════════
-- library_panel_telemetry — Per-agent telemetry for each panel run
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "library_panel_telemetry" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "panel_run_id"    uuid NOT NULL REFERENCES "library_panel_runs"("id") ON DELETE CASCADE,
  "agent_model_id"  text NOT NULL,
  "agent_role"      text NOT NULL DEFAULT 'agent',
  "latency_ms"      integer DEFAULT 0,
  "tokens_in"       integer DEFAULT 0,
  "tokens_out"      integer DEFAULT 0,
  "cost_usd"        numeric(10,8) DEFAULT 0,
  "success"         boolean NOT NULL DEFAULT true,
  "error_message"   text,
  "response_preview" text,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT "chk_panel_telemetry_role" CHECK ("agent_role" IN ('agent', 'judge'))
);

COMMENT ON TABLE "library_panel_telemetry" IS 'Per-agent telemetry for each panel run. One row per agent per run.';
COMMENT ON COLUMN "library_panel_telemetry"."agent_role" IS 'agent (worker model) | judge (synthesizer model)';
COMMENT ON COLUMN "library_panel_telemetry"."response_preview" IS 'First 500 chars of agent response for quick inspection';

CREATE INDEX IF NOT EXISTS idx_panel_telemetry_run ON "library_panel_telemetry"("panel_run_id");
CREATE INDEX IF NOT EXISTS idx_panel_telemetry_model ON "library_panel_telemetry"("agent_model_id", "created_at");
CREATE INDEX IF NOT EXISTS idx_panel_telemetry_role ON "library_panel_telemetry"("agent_role", "success");

COMMENT ON INDEX idx_panel_telemetry_run IS 'Link telemetry records to panel runs';
COMMENT ON INDEX idx_panel_telemetry_model IS 'Per-model performance analysis';
COMMENT ON INDEX idx_panel_telemetry_role IS 'Query by agent vs judge success rates for model selection optimization';

-- ═══════════════════════════════════════════════════════════════════════════════
-- Seed 7 System Presets (inserted in seed-fusion-presets.ts for idempotency)
-- Chinese Frontier (DEFAULT), Speed Trio, Sonnet Synth, Deep Reasoning,
-- Code Specialist, Research Specialist, Dual Frontier
-- ═══════════════════════════════════════════════════════════════════════════════
