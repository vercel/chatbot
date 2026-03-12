import { tool } from 'ai';
import { z } from 'zod';
import { readFile } from 'fs/promises';
import { resolve, normalize, join } from 'path';

const SKILLS_DIR = normalize(join(process.cwd(), 'lib/ai/skills'));

export const readSkillFile = tool({
  description:
    'Read a reference file from a skill directory. Use the skillDirectory returned by loadSkill to construct the absolute path. Load reference files when a skill instructs you to.',
  inputSchema: z.object({
    path: z
      .string()
      .describe(
        'Absolute path to the reference file (skillDirectory + relative path)',
      ),
  }),
  execute: async ({ path: filePath }) => {
    const resolved = resolve(filePath);
    if (!resolved.startsWith(SKILLS_DIR)) {
      return { error: 'Access denied: path must be within the skills directory' };
    }
    try {
      const content = await readFile(resolved, 'utf-8');
      return { content };
    } catch {
      return { error: `File not found: ${filePath}` };
    }
  },
});
