-- Phase 24: Migration 0013
-- KG Edge Enrichment + Playbook Usage Telemetry

ALTER TABLE library_edges
  ADD COLUMN IF NOT EXISTS success_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failure_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(3,2) DEFAULT 0.50,
  ADD COLUMN IF NOT EXISTS cost_per_use NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS latency_ms_avg INT;

CREATE TABLE IF NOT EXISTS library_playbook_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_slug TEXT NOT NULL,
  intent_text TEXT,
  session_id TEXT,
  success BOOLEAN DEFAULT true,
  duration_ms INT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_playbook_usage_slug ON library_playbook_usage(playbook_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_playbook_usage_intent ON library_playbook_usage USING gin(to_tsvector('english', coalesce(intent_text, '')));
CREATE INDEX IF NOT EXISTS idx_edges_confidence ON library_edges(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_edges_last_used ON library_edges(last_used_at DESC NULLS LAST);

COMMENT ON TABLE library_playbook_usage IS 'Tracks every playbook load with intent, session, success, and duration. Feeds KG edge weights.';
COMMENT ON COLUMN library_playbook_usage.intent_text IS 'The user intent text that triggered this playbook. Used for similarity matching.';
COMMENT ON COLUMN library_edges.confidence_score IS '0.00-1.00 computed from success_count / (success_count + failure_count) with recency decay.';

-- Phase 24: Self-Healing Pipeline Tables

CREATE TABLE IF NOT EXISTS library_log_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  raw_log TEXT NOT NULL,
  extracted JSONB DEFAULT '{}',
  kg_matches JSONB DEFAULT '[]',
  needs_fix BOOLEAN DEFAULT FALSE,
  v2_mission_id UUID,
  hypothesis TEXT,
  severity TEXT DEFAULT 'low',
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_log_analyses_source ON library_log_analyses(source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_log_analyses_needs_fix ON library_log_analyses(needs_fix) WHERE needs_fix = TRUE;

CREATE TABLE IF NOT EXISTS library_wiki_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_slug TEXT NOT NULL,
  reason TEXT,
  before_content TEXT,
  after_content TEXT,
  triggered_by TEXT DEFAULT 'log_analysis',
  dry_run BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wiki_updates_slug ON library_wiki_updates(page_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wiki_updates_trigger ON library_wiki_updates(triggered_by, created_at DESC);

COMMENT ON TABLE library_log_analyses IS 'Self-healing pipeline: structured analysis of raw logs with KG pattern matching.';
COMMENT ON TABLE library_wiki_updates IS 'Wiki auto-update events: tracks every auto-generated wiki change with before/after diffs.';
COMMENT ON COLUMN library_wiki_updates.dry_run IS 'TRUE means the update was logged but NOT written to disk — manual approval needed.';
