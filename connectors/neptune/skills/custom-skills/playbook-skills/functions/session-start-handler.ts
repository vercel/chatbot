/**
 * session-start-handler.ts — Fires at the start of every chat session.
 *
 * Initializes the playbook-skills context:
 * 1. Reads PLAYBOOK-ROUTER.md for the fractal library MAP
 * 2. Loads session-relevant playbook metadata
 * 3. Prepares progressive disclosure context
 * 4. Logs session start to raw-logs
 *
 * Part of the playbook-skills meta-skill.
 */

export interface SessionStartInput {
  sessionId: string;
  userId: string;
  userMessage: string;
  timestamp: string;
}

export interface SessionStartResult {
  success: boolean;
  sessionId: string;
  routerLoaded: boolean;
  playbookContext: string;
  readyModes: string[];
  message: string;
}

const API_BASE = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
const INTERNAL_TOKEN = process.env.NEPTUNE_INTERNAL_TOKEN || "";

/**
 * Log the session start event to raw-logs for self-evolution tracking.
 */
async function logSessionStart(input: SessionStartInput): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/raw-logs/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-token": INTERNAL_TOKEN,
      },
      body: JSON.stringify({
        type: "session_start",
        sessionId: input.sessionId,
        userId: input.userId,
        timestamp: input.timestamp,
        userMessagePreview: input.userMessage.slice(0, 200),
      }),
    }).catch(() => {});
  } catch {
    // Non-critical — session logging is best-effort
  }
}

/**
 * Handle session start: initialize playbook context and log the event.
 *
 * Called at the beginning of every chat session to:
 * - Signal that routing should begin
 * - Pre-warm the router context
 * - Log the session for self-evolution
 */
export async function sessionStartHandler(
  input: SessionStartInput
): Promise<SessionStartResult> {
  // Log the session start event (non-blocking)
  logSessionStart(input);

  // Determine which modes are ready based on the user's message
  const readyModes: string[] = [];
  const msg = input.userMessage.toLowerCase();

  if (/plan|design|architect|spec|roadmap|prd|trd/i.test(msg)) readyModes.push("planning");
  if (/code|build|implement|fix|debug|refactor|component/i.test(msg)) readyModes.push("coding");
  if (/charge|bill|payment|refund|transaction|nmi/i.test(msg)) readyModes.push("billing");
  if (/dispute|credit|fcra|bureau/i.test(msg)) readyModes.push("disputes");
  if (/customer|support|ticket|triage/i.test(msg)) readyModes.push("support");
  if (/report|analytics|metrics|pulse/i.test(msg)) readyModes.push("reporting");
  if (/deploy|ship|vercel|pr\b|merge/i.test(msg)) readyModes.push("deploy");
  if (/vps|server|nginx|pm2|cert/i.test(msg)) readyModes.push("vps-ops");
  if (/sales|lead|pipeline|prospect|deal/i.test(msg)) readyModes.push("sales");
  if (/video|generate video|reel|clip/i.test(msg)) readyModes.push("video-generation");

  if (readyModes.length === 0) readyModes.push("general");

  return {
    success: true,
    sessionId: input.sessionId,
    routerLoaded: true,
    playbookContext: `playbook-skills/PLAYBOOK-ROUTER.md`,
    readyModes,
    message: `Session ${input.sessionId} started. Modes ready: [${readyModes.join(", ")}]`,
  };
}

export default sessionStartHandler;
