import { tool } from 'ai';
import { z } from 'zod';

export const actionLabel = tool({
  description:
    'Label the upcoming group of browser actions with a human-readable title. Call this ONCE before starting a sequence of related browser actions so the UI can show a meaningful group heading. Do NOT call it before every individual action — only at the start of a logical group. Examples: "Filling in personal information", "Navigating to WIC portal", "Selecting household members", "Reviewing application before submission".',
  inputSchema: z.object({
    category: z
      .enum(['fill', 'navigate', 'interact', 'read', 'search', 'misc'])
      .describe('Type of action group, used to select the UI icon and label.'),
  }),
  execute: async (input) => input,
});
