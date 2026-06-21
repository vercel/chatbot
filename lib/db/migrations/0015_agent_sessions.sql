-- 0015_agent_sessions: Unified V2+VPS Agent Session Tracking
-- M-N-META PRD Quality + Beautiful Handoff (2026-06-21)
--
-- Extends the session tracking pattern from library_v2_handoffs with:
--   - Multi-lane routing (v2 | vps | mcp)
--   - Pocock 7-phase discipline tracking
--   - Enhancement research findings per cardinal 6a37787b
--   - Running cost tracking
--   - Card state for UI resume
--   - Runtime/model metadata

CREATE TABLE IF NOT EXISTS agent_sessions (
  session_id          TEXT PRIMARY KEY,
  -- Core session data
  goal                TEXT,
  mode                TEXT,                    -- investigation | modify_existing | new_project
  repo_name           TEXT,
  branch              TEXT,
  status              TEXT NOT NULL DEFAULT 'routing', -- routing | spawning | running | building | deploying | complete | failed
  progress            INTEGER DEFAULT 0,
  steps               JSONB DEFAULT '[]'::jsonb,
  files_changed       JSONB DEFAULT '[]'::jsonb,
  deploy_url          TEXT,
  pr_url              TEXT,
  v2_direct_url       TEXT,
  chat_id             TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  completed_at        TIMESTAMPTZ,
  -- Multi-lane routing (M-N-META new fields)
  lane                TEXT,                    -- v2 | vps | mcp
  runtime             TEXT,                    -- claude_sdk | deepseek | opus_4_6
  model               TEXT,
  enhancement_findings JSONB,                  -- per cardinal 6a37787b
  parent_session_id   TEXT,
  conversation_id     TEXT,
  card_state          TEXT,                    -- inline | expanded | minimized
  cost_cents          INTEGER DEFAULT 0,
  user_email          TEXT,
  pocock_phase        TEXT                     -- grill | research | prototype | prd | plan | build | qa | handoff
);

-- Events table for SSE replay + audit
CREATE TABLE IF NOT EXISTS agent_session_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          TEXT NOT NULL REFERENCES agent_sessions(session_id) ON DELETE CASCADE,
  event_type          TEXT NOT NULL,
  payload             JSONB DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index: fast lookup by chat + status + lane
CREATE INDEX IF NOT EXISTS idx_agent_sessions_chat_id ON agent_sessions(chat_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON agent_sessions(status);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_lane ON agent_sessions(lane);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_parent ON agent_sessions(parent_session_id);
CREATE INDEX IF NOT EXISTS idx_agent_session_events_session ON agent_session_events(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_session_events_type ON agent_session_events(event_type);
