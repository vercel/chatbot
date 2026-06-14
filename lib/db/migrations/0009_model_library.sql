-- Phase 14: Model Library — library_models + library_model_usage_logs
-- Description: Central model registry sourced from Vercel AI Gateway with scoring,
--              per-session usage audit trail, and pricing metadata for UI display.

-- =============================================================================
-- library_models — canonical model catalog (source of truth)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "library_models" (
  "identifier"           text PRIMARY KEY NOT NULL,             -- e.g. "deepseek/deepseek-v4-pro"
  "display_name"         text NOT NULL DEFAULT '',              -- human-readable name
  "provider"             text NOT NULL DEFAULT '',              -- e.g. deepseek, anthropic, openai
  "family"               text,                                  -- model family grouping (e.g. "deepseek-v4")
  "version"              text NOT NULL DEFAULT '1.0.0',
  "release_date"         timestamp with time zone,              -- when the model was publicly released
  "context_window_tokens" integer NOT NULL DEFAULT 0,           -- max input tokens
  "max_output_tokens"    integer NOT NULL DEFAULT 0,            -- max generation tokens
  "input_price_per_million"  numeric(12,6) NOT NULL DEFAULT 0, -- USD per 1M input tokens
  "output_price_per_million" numeric(12,6) NOT NULL DEFAULT 0, -- USD per 1M output tokens
  "cached_input_price"   numeric(12,6),                         -- USD per 1M cached input tokens (optional)
  "capabilities"         jsonb NOT NULL DEFAULT '[]',           -- ["tools","vision","reasoning","streaming","json_output"]
  "modalities"           jsonb NOT NULL DEFAULT '[]',           -- ["text","image","audio","video"]
  "reasoning_score"      integer DEFAULT 0,                     -- 0-100 composite benchmark score
  "coding_score"         integer DEFAULT 0,                     -- 0-100
  "vision_score"         integer DEFAULT 0,                     -- 0-100
  "speed_score"          integer DEFAULT 0,                     -- 0-100 (higher = faster)
  "cost_score"           integer DEFAULT 0,                     -- 0-100 (higher = cheaper)
  "benchmark_scores"     jsonb,                                 -- { "mmlu": 88.5, "humaneval": 92.1, ... }
  "best_for"             jsonb NOT NULL DEFAULT '[]',           -- ["reasoning","coding","fast iterations"]
  "not_good_for"         jsonb NOT NULL DEFAULT '[]',           -- ["long-form writing","creative tasks"]
  "status"               text NOT NULL DEFAULT 'active',        -- active | deprecated | beta | experimental
  "source_url"           text,                                  -- docs / announcement URL
  "created_at"           timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"           timestamp with time zone NOT NULL DEFAULT now()
);

COMMENT ON TABLE "library_models" IS 'Phase 14: Canonical model catalog seeded from Vercel AI Gateway. DB is source of truth for model metadata, scores, and pricing.';

-- Indexes for common model lookups
CREATE INDEX IF NOT EXISTS "idx_library_models_provider" ON "library_models" ("provider");
CREATE INDEX IF NOT EXISTS "idx_library_models_status" ON "library_models" ("status");
CREATE INDEX IF NOT EXISTS "idx_library_models_provider_family" ON "library_models" ("provider", "family");

-- =============================================================================
-- library_model_usage_logs — per-session model usage audit trail
-- =============================================================================
CREATE TABLE IF NOT EXISTS "library_model_usage_logs" (
  "id"                   uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "session_id"           text,                                  -- linked session / conversation
  "model_used"           text NOT NULL,                         -- model identifier (FK ref to library_models.identifier)
  "playbook_routed_from" text,                                  -- which playbook routed this call
  "skill_routed_to"      text,                                  -- which skill used the model
  "tokens_in"            integer,                               -- prompt tokens consumed
  "tokens_out"           integer,                               -- completion tokens consumed
  "latency_ms"           integer,                               -- round-trip latency in ms
  "cost_usd"             numeric(14,8),                         -- computed cost in USD
  "success_marker"       boolean NOT NULL DEFAULT true,         -- false if the call errored or was aborted
  "user_rating"          integer DEFAULT 0,                     -- 0-5 thumbs rating (optional)
  "timestamp"            timestamp with time zone NOT NULL DEFAULT now()
);

COMMENT ON TABLE "library_model_usage_logs" IS 'Phase 14: Immutable per-call model usage audit trail. Tied to sessions, playbooks, and skills. Used for cost attribution and model selection analytics.';

-- Indexes for usage analysis
CREATE INDEX IF NOT EXISTS "idx_model_usage_session" ON "library_model_usage_logs" ("session_id");
CREATE INDEX IF NOT EXISTS "idx_model_usage_model" ON "library_model_usage_logs" ("model_used");
CREATE INDEX IF NOT EXISTS "idx_model_usage_timestamp" ON "library_model_usage_logs" ("timestamp" DESC);
CREATE INDEX IF NOT EXISTS "idx_model_usage_playbook" ON "library_model_usage_logs" ("playbook_routed_from");
CREATE INDEX IF NOT EXISTS "idx_model_usage_success" ON "library_model_usage_logs" ("success_marker", "timestamp" DESC);
