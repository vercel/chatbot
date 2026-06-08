/**
 * processData tool — Process/transform data in sandbox.
 * Pattern: One-shot ephemeral sandbox.
 */
import { tool } from 'ai';
import { z } from 'zod';
import { sandboxOrchestrator } from '../orchestrator';

export const processDataTool = tool({
  description: 'Filter, transform, or aggregate data using JavaScript expressions in a sandbox.',
  inputSchema: z.object({
    data: z.string().describe('JSON string of the data to process'),
    operation: z.enum(['filter', 'transform', 'aggregate', 'sort', 'map']).describe('Operation to perform'),
    expression: z.string().describe('JavaScript expression to apply'),
    userId: z.string().describe('User ID for audit trail'),
  }),
  execute: async ({ data, operation, expression, userId }) => {
    const result = await sandboxOrchestrator.execute({
      tool: 'processData',
      userId,
      payload: { data, operation, expression },
    });
    return result;
  },
});
