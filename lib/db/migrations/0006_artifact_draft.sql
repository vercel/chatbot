-- Phase 11: Refresh Recovery + Mobile Fix — Artifact Draft Persistence
-- Migration 0006 extends Message_v2 with artifact draft columns for stream recovery.
--
-- Schema changes:
--   1. Message_v2: ADD artifact_draft, stream_position
--   2. New index: idx_message_v2_chat_stream for fast stream lookups
--
-- US-1: On refresh, any partial artifact content is recoverable from artifact_draft.
-- The chat route persists chunk-by-chunk during artifact streaming. On page load,
-- the client checks the last message's artifact_draft to offer Resume/Discard CTAs.

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. Message_v2 — Artifact draft and stream position
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE "Message_v2"
  ADD COLUMN IF NOT EXISTS "artifact_draft" text,
  ADD COLUMN IF NOT EXISTS "stream_position" integer DEFAULT 0;

COMMENT ON COLUMN "Message_v2"."artifact_draft" IS 'Partial artifact content persisted chunk-by-chunk during streaming. Used for refresh recovery.';
COMMENT ON COLUMN "Message_v2"."stream_position" IS 'Last stream position (character offset) written to artifact_draft. Used to resume interrupted streams.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. Index for fast stream lookups by chat
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_message_v2_chat_stream
  ON "Message_v2"("chatId", "createdAt" DESC);

COMMENT ON INDEX idx_message_v2_chat_stream IS 'Supports fast lookups for active stream recovery on chat page load (Phase 11)';
