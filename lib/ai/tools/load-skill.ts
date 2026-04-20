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
    name: 'browser-and-forms',
    description:
      'Use this skill before your first browser action. Covers snapshot workflow, selectors, masked fields, field type patterns, multi-page forms, form submission protocol, forbidden actions, and error recovery. Has reference files for the full command reference and advanced submit-button debugging.',
    path: 'browser-and-forms',
  },
  {
    name: 'custom-dropdowns',
    description:
      'Use this skill when a native select action fails or has no effect, or when the snapshot shows select2-container or chosen-container classes. Covers Select2, Chosen, and Drupal custom dropdown patterns.',
    path: 'custom-dropdowns',
  },
  {
    name: 'modal-handling',
    description:
      'Use this skill when you encounter empty/minimal snapshots or elements blocked by overlays. Covers modal detection, React event workarounds, county/location selection modals, and Google Translate bar removal.',
    path: 'modal-handling',
  },
  {
    name: 'application-protocol',
    description:
      'Use this skill when starting a benefits application with participant data. Covers participant data retrieval, field mapping rules, applicant identity, autonomous progression, review screen protocol, caseworker communication, gap analysis, and form summary.',
    path: 'application-protocol',
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
