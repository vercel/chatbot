import { tool } from 'ai';
import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import { readdirSync, readFileSync } from 'node:fs';
import { join, normalize } from 'node:path';

const SKILLS_DIR = normalize(join(process.cwd(), 'lib/ai/skills'));

interface SkillMeta {
  name: string;
  description: string;
  path: string;
}

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const result: Record<string, string> = {};
  let currentKey: string | null = null;
  let currentVal = '';
  for (const line of match[1].split(/\r?\n/)) {
    const keyMatch = line.match(/^([a-zA-Z_-]+):\s*(.*)$/);
    if (keyMatch) {
      if (currentKey) result[currentKey] = currentVal.trim();
      currentKey = keyMatch[1];
      currentVal = keyMatch[2] === '>' ? '' : keyMatch[2];
    } else if (currentKey && line.trim()) {
      currentVal += ` ${line.trim()}`;
    }
  }
  if (currentKey) result[currentKey] = currentVal.trim();
  return result;
}

function discoverSkills(): SkillMeta[] {
  const entries = readdirSync(SKILLS_DIR, { withFileTypes: true });
  const skills: SkillMeta[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const content = readFileSync(join(SKILLS_DIR, entry.name, 'SKILL.md'), 'utf-8');
      const fm = parseFrontmatter(content);
      if (fm.name && fm.description) {
        skills.push({ name: fm.name, description: fm.description, path: entry.name });
      }
    } catch {
      // no SKILL.md in this directory — not a skill
    }
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

const SKILLS = discoverSkills();

export function getSkillCatalog(): string {
  const list = SKILLS.map((s) => `- **${s.name}**: ${s.description}`).join('\n');
  return `## Skills

Use \`loadSkill\` when starting a task that matches a skill. Use \`readSkillFile\` for detailed reference files from a skill's directory.

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
    name: z.string().describe('Skill name (e.g. "browser-and-forms")'),
  }),
  execute: async ({ name }) => {
    const skill = SKILLS.find((s) => s.name.toLowerCase() === name.toLowerCase());
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
      const result = {
        skillDirectory: join(SKILLS_DIR, skill.path),
        content: stripFrontmatter(content),
      };
      skillCache.set(skill.name, result);
      return result;
    } catch {
      return { error: `Failed to read skill file: ${skillPath}` };
    }
  },
});
