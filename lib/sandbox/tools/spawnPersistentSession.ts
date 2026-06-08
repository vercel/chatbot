/**
 * spawnPersistentSession tool — Create a long-lived sandbox session for interactive coding.
 * Pattern: Persistent sandbox with LRU pool.
 */
import { tool } from 'ai';
import { z } from 'zod';
import { sandboxManager } from '../manager';

export const spawnPersistentSessionTool = tool({
  description: 'Create a persistent sandbox session for interactive coding. Session auto-destroys after 5min idle.',
  inputSchema: z.object({
    sessionKey: z.string().describe('Unique key for this session'),
    userId: z.string().describe('User ID for audit trail'),
    runtime: z.enum(['node', 'python']).default('node').describe('Runtime for the session'),
  }),
  execute: async ({ sessionKey, userId, runtime }) => {
    const sandbox = await sandboxManager.getOrCreatePersistent({
      sessionKey,
      userId,
      runtime: runtime === 'python' ? 'python3.13' : 'node24',
    });

    return {
      sessionKey,
      sandboxId: sandbox.name,
      status: 'ready',
      message: `Persistent session ${sessionKey} ready. Idle timeout: 5 min.`,
    };
  },
});
