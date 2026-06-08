/**
 * coding-agent-run artifact (server) — subscribes to v2 SSE, persists events.
 */
import { getV2Session, listV2Sessions } from "@/lib/v2/bridge";

export async function getCodingAgentRunData(runId: string) {
  const session = await getV2Session(runId);
  return {
    runId,
    status: session?.status || "unknown",
    prompt: session?.prompt || "",
    createdAt:
      session?.createdAt || session?.created_at || new Date().toISOString(),
    streamUrl: session?.streamUrl || session?.sseUrl || "",
  };
}

export async function listActiveCodingRuns() {
  const sessions = await listV2Sessions();
  return Array.isArray(sessions) ? sessions : [];
}
