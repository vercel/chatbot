-- Phase 15.A: Library Evals — structured eval harness for skill/model quality
-- Description: Stores eval test cases and results for automated quality grading.
-- Each eval defines a query, expected outputs, and success criteria for batch execution.

-- =============================================================================
-- library_evals — eval test case definitions
-- =============================================================================
CREATE TABLE IF NOT EXISTS "library_evals" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "eval_name"      text NOT NULL,                              -- human-readable name, e.g. "billing-flow-dispute-lookup"
  "domain"         text NOT NULL DEFAULT 'general',            -- domain classifier (billing, disputes, support, etc.)
  "query"          text NOT NULL,                              -- the user query to feed to the eval
  "expected_skills"  jsonb NOT NULL DEFAULT '[]',              -- list of skill names expected to be loaded
  "expected_connectors" jsonb NOT NULL DEFAULT '[]',           -- list of connector names expected
  "expected_model" text,                                       -- expected model identifier (optional)
  "success_criteria" jsonb NOT NULL DEFAULT '{}',              -- {"min_correctness":80,"max_latency_ms":5000,"require_cortex":true}
  "severity"       text NOT NULL DEFAULT 'normal',             -- critical | high | normal | low
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"     timestamp with time zone NOT NULL DEFAULT now()
);

-- =============================================================================
-- library_eval_runs — individual eval execution results
-- =============================================================================
CREATE TABLE IF NOT EXISTS "library_eval_runs" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "eval_id"        uuid NOT NULL REFERENCES library_evals(id) ON DELETE CASCADE,
  "session_id"     text,                                       -- the VPS session that executed this eval
  "run_at"         timestamp with time zone NOT NULL DEFAULT now(),
  "status"         text NOT NULL DEFAULT 'pending',            -- pending | running | passed | failed | error
  "skills_loaded"  jsonb DEFAULT '[]',                         -- actual skills loaded during execution
  "connectors_used" jsonb DEFAULT '[]',                        -- actual connectors used
  "model_used"     text,                                       -- actual model identifier used
  "quality_grade"  text,                                       -- LLM-graded quality: A+/A/A-/B+/B/B-/C+/C/D/F
  "quality_score"  integer,                                    -- 0-100 composite from sub-scores
  "sub_scores"     jsonb,                                      -- {efficiency,correctness,cortex,validation,reporting,resilience}
  "latency_ms"     integer,                                    -- total execution latency
  "cost_usd"       numeric(14,8),                              -- estimated USD cost
  "tokens_in"      integer,                                    -- input tokens used
  "tokens_out"     integer,                                    -- output tokens used
  "error_message"  text,                                       -- error details if status=error
  "raw_response"   text,                                       -- raw LLM response for analysis
  "created_at"     timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_eval_runs_eval_id ON library_eval_runs(eval_id);
CREATE INDEX IF NOT EXISTS idx_eval_runs_run_at ON library_eval_runs(run_at);
CREATE INDEX IF NOT EXISTS idx_eval_runs_status ON library_eval_runs(status);
CREATE INDEX IF NOT EXISTS idx_evals_domain ON library_evals(domain);
