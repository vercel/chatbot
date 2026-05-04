import { tool } from 'ai';
import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import { resolve, normalize, join } from 'node:path';

const REFERENCES_DIR = normalize(join(process.cwd(), 'lib/ai/prompts/references'));

export const readReference = tool({
  description:
    'Load a reference document. Use the path the system prompt instructs you to load (e.g. "field-patterns.md", "custom-dropdowns.md", "form-submission.md", "browser-commands.md").',
  inputSchema: z.object({
    path: z
      .string()
      .describe('Filename within lib/ai/prompts/references (e.g. "field-patterns.md")'),
  }),
  execute: async ({ path: filePath }) => {
    const cleaned = filePath.replace(/^references\//, '');
    const resolved = resolve(REFERENCES_DIR, cleaned);
    if (!resolved.startsWith(`${REFERENCES_DIR}/`) && resolved !== REFERENCES_DIR) {
      return { error: 'Access denied: path must be within references' };
    }
    try {
      const content = await readFile(resolved, 'utf-8');
      return { content };
    } catch {
      return { error: `File not found: ${filePath}` };
    }
  },
});
