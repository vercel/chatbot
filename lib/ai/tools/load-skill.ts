import { tool } from 'ai';
import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import { join, normalize } from 'node:path';

const SKILLS_DIR = normalize(join(process.cwd(), 'lib/ai/skills'));

interface SkillMeta {
  name: string;
  description: string;
  path: string;
}

const SKILLS: SkillMeta[] = [
  {
    name: 'agent-browser',
    description:
      'Use this skill before your first browser action. Covers snapshot workflow, selectors, masked fields, modals, Cloudflare Turnstile, form submission protocol, and forbidden actions. Has reference files for specific situations like disabled submit buttons, custom dropdowns, and CAPTCHA handling.',
    path: 'agent-browser',
  },
  {
    name: 'caseworker-communication',
    description:
      'Use this skill when interacting with a caseworker. Covers plain-language communication rules, gap analysis protocol (when to call gapAnalysis tool and how), form summary protocol (when to call formSummary tool and how), and step-limit handling.',
    path: 'caseworker-communication',
  },
];

export function getSkillCatalog(): string {
  const list = SKILLS.map((s) => `- **${s.name}**: ${s.description}`).join('\n');
  return `## Skills

Use the \`loadSkill\` tool when starting a task that matches a skill. Use \`readSkillFile\` to load detailed reference files from a skill's directory when you need guidance on a specific topic.

Available skills:
${list}`;
}

function stripFrontmatter(content: string): string {
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  return match ? content.slice(match[0].length).trim() : content.trim();
}

const skillCache = new Map<string, { skillDirectory: string; content: string }>();

export const loadSkill = tool({
  description:
    'Load a skill to get specialized instructions. Returns the skill content and its directory path for use with readSkillFile.',
  inputSchema: z.object({
    name: z.string().describe('Skill name (e.g. "agent-browser")'),
  }),
  execute: async ({ name }) => {
    const skill = SKILLS.find(
      (s) => s.name.toLowerCase() === name.toLowerCase(),
    );
    if (!skill) {
      return {
        error: `Skill '${name}' not found. Available: ${SKILLS.map((s) => s.name).join(', ')}`,
      };
    }
    const cached = skillCache.get(skill.name);
    if (cached) return cached;

    const skillPath = join(SKILLS_DIR, skill.path, 'SKILL.md');
    try {
      const content = await readFile(skillPath, 'utf-8');
      const body = stripFrontmatter(content);
      const result = {
        skillDirectory: join(SKILLS_DIR, skill.path),
        content: body,
      };
      skillCache.set(skill.name, result);
      return result;
    } catch {
      return { error: `Failed to read skill file: ${skillPath}` };
    }
  },
});
