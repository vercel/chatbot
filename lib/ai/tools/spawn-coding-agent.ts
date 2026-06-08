/**
 * spawn-coding-agent tool — Handoff complex coding tasks to neptune-v2 /api/runs.
 * This is Layer 5 of the sandbox orchestrator.
 *
 * Calls POST /api/sandbox on neptune-v2 (open-agents sandbox route)
 * and streams back results via SSE.
 */
import { tool } from 'ai';
import { z } from 'zod';

const OPEN_AGENTS_URL = process.env.OPEN_AGENTS_URL || 'https://neptune-v2.vercel.app';
const OPEN_AGENTS_API_KEY = process.env.OPEN_AGENTS_API_KEY || '';

interface V2SandboxResponse {
  sandboxId: string;
  status: string;
  streamUrl?: string;
  sessionId?: string;
}

export const spawnCodingAgent = tool({
  description:
    'Hand off a complex multi-step coding task to the neptune-v2 coding agent. ' +
    'The v2 agent has full sandbox access, file system, git, and browser tools. ' +
    'Use this for tasks that require multiple sandbox runs, git operations, or browser automation.',
  inputSchema: z.object({
    code: z.string().describe('The code or instructions to execute in v2 sandbox'),
    runtime: z.enum(['node', 'python']).default('node').describe('Runtime to use'),
    context: z.record(z.unknown()).optional().describe('Additional context for the coding agent'),
    sessionId: z.string().optional().describe('Existing v2 session ID to resume'),
  }),
  execute: async ({ code, runtime, context, sessionId }) => {
    const body: Record<string, unknown> = {
      code,
      runtime,
      context: context || {},
    };

    if (sessionId) {
      body.sessionId = sessionId;
    }

    const res = await fetch(`${OPEN_AGENTS_URL}/api/sandbox`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPEN_AGENTS_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`V2 coding agent handoff failed: ${res.status} ${errorText}`);
    }

    const data: V2SandboxResponse = await res.json();

    return {
      sandboxId: data.sandboxId,
      sessionId: data.sessionId || data.sandboxId,
      status: data.status,
      streamUrl: data.streamUrl || `${OPEN_AGENTS_URL}/api/sandbox/status?sandboxId=${data.sandboxId}`,
      message: `Coding agent spawned in neptune-v2. Track progress via the stream URL.`,
    };
  },
});
