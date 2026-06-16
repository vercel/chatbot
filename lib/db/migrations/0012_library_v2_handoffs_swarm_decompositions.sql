-- Phase 23B: Migration 0012
-- V2 handoff sessions + swarm decomposition tracking

CREATE TABLE IF NOT EXISTS library_v2_handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES "User"(id),
  chat_id UUID REFERENCES "Chat"(id),
  v2_session_id TEXT NOT NULL UNIQUE,
  handoff_mode TEXT NOT NULL,
  target_repo TEXT,
  goal TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  stream_url TEXT,
  result_url TEXT,
  error_message TEXT,
  event_count INT DEFAULT 0,
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_v2_handoffs_user ON library_v2_handoffs(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_v2_handoffs_status ON library_v2_handoffs(status);
CREATE INDEX IF NOT EXISTS idx_v2_handoffs_chat ON library_v2_handoffs(chat_id);

CREATE TABLE IF NOT EXISTS library_swarm_decompositions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_run_id UUID REFERENCES library_panel_runs(id),
  coordinator_model TEXT NOT NULL,
  strategy_text TEXT,
  sub_tasks JSONB NOT NULL,
  coordinator_latency_ms INT,
  coordinator_cost_usd NUMERIC(10,4),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_swarm_decomp_run ON library_swarm_decompositions(panel_run_id);
