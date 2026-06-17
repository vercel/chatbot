-- Phase 25: Mission Cards + Workflow Library
-- Migration 0014 (combined 0015+0016 from mission doc)

CREATE TABLE IF NOT EXISTS library_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES "User"(id) ON DELETE SET NULL,
  chat_id UUID REFERENCES "Chat"(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  steps JSONB NOT NULL DEFAULT '[]',
  estimated_cost NUMERIC(10,4),
  estimated_time_min INT,
  actual_cost NUMERIC(10,4),
  actual_time_sec INT,
  v2_session_id TEXT,
  panel_run_id UUID,
  result JSONB,
  current_state TEXT NOT NULL DEFAULT 'inline',
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS library_mission_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES library_missions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS library_workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES "User"(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  steps JSONB NOT NULL DEFAULT '[]',
  parameters JSONB DEFAULT '{}',
  schedule TEXT,
  is_shared BOOLEAN NOT NULL DEFAULT FALSE,
  tags JSONB DEFAULT '[]',
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS library_workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES library_workflow_templates(id) ON DELETE CASCADE,
  mission_id UUID REFERENCES library_missions(id) ON DELETE SET NULL,
  user_id UUID REFERENCES "User"(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  step_results JSONB DEFAULT '[]',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_missions_user ON library_missions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_missions_chat ON library_missions(chat_id);
CREATE INDEX IF NOT EXISTS idx_missions_status ON library_missions(status);
CREATE INDEX IF NOT EXISTS idx_mission_events_mission ON library_mission_events(mission_id, created_at);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_user ON library_workflow_templates(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON library_workflow_runs(workflow_id, created_at DESC);

COMMENT ON TABLE library_missions IS 'Phase 25: Multi-step mission tracker with 4-state card pattern (inline/expanded/canvas/sandbox-linked).';
COMMENT ON TABLE library_mission_events IS 'Phase 25: Event log for mission state transitions and step updates.';
COMMENT ON TABLE library_workflow_templates IS 'Phase 25: Saved workflow templates from mission "Save as Workflow" action.';
COMMENT ON TABLE library_workflow_runs IS 'Phase 25: Execution history of workflow templates.';
