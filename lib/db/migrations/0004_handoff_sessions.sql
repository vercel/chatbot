-- Phase 9: Handoff sessions table for V2 coding agent session tracking
CREATE TABLE IF NOT EXISTS "handoff_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "chat_message_id" text,
  "user_id" uuid REFERENCES "User"("id"),
  "repo" text,
  "goal" text,
  "v2_session_id" text,
  "v2_sandbox_id" text,
  "status" text NOT NULL DEFAULT 'spawning',
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "completed_at" timestamptz,
  "pr_url" text,
  "deploy_url" text,
  "result_summary" text
);

CREATE INDEX IF NOT EXISTS idx_handoff_sessions_user ON handoff_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_handoff_sessions_status ON handoff_sessions(status);
CREATE INDEX IF NOT EXISTS idx_handoff_sessions_v2 ON handoff_sessions(v2_session_id);
