/**
 * Skills Loader — Phase 19.D
 *
 * Server-side helper that maps intents to relevant cortex skills,
 * loads full skill content for V2 system prompt injection, and
 * caches results in memory for 5 minutes.
 *
 * Categories:
 *   Design, Architecture, Database, Testing, Repository, Coding
 *
 * Usage:
 *   const skills = await loadSkillsForIntent("build a skills browse page");
 *   // Returns [{ path, name, content }] with full skill markdown
 */
import { secrets } from "@/secrets";

// ─── Configuration ───────────────────────────────────────────────────────

const VPS_FS_BRIDGE_URL =
  secrets.vps.fsBridgeUrl || "https://187.127.250.171:8102/api/fs";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─── Types ───────────────────────────────────────────────────────────────

export interface SkillEntry {
  path: string;
  name: string;
  content: string;
  category: string;
}

interface CacheEntry {
  skills: SkillEntry[];
  expiresAt: number;
}

// ─── Intent → Skill Mapping ────────────────────────────────────────────

export const SKILL_CATEGORIES: Record<string, string[]> = {
  design: [
    "nextjs-shadcn-ai-elements-design-mastery",
    "agent-design-skills",
    "design-system-billing-components",
    "three-tier-ux-architecture",
  ],
  architecture: [
    "agent-architecture-master-blueprint",
    "model-orchestration-architecture-v2",
    "connector-playbook-architecture-MASTER",
    "unified-architecture-v1",
  ],
  database: [
    "neptune-repo-knowledge-base",
  ],
  testing: [
    "autonomous-test-fix-deploy",
    "testing-deep-research",
    "sandbox-api-testing-rules",
    "test-small-scale-large",
  ],
  repository: [
    "neptune-repo-knowledge-base",
    "hermes-repo-digest-protocol",
    "jarvis-os-repo-identity",
    "base44-github-sync-research",
  ],
  coding: [
    "inline-coding-skill",
    "autonomous-coding-loop-v1",
    "mvp-generation-skill",
    "mvp-planning-skill",
  ],
};

// ─── Intent Detection ────────────────────────────────────────────────────

function detectCategories(intent: string): string[] {
  const lower = intent.toLowerCase();
  const categories: Set<string> = new Set();

  if (/design|ui|ux|component|layout|style|mobile|sidebar|sheet|drawer|panel|tailwind|css|visual|look|theme|aesthetic/i.test(lower)) {
    categories.add("design");
  }
  if (/architecture|architect|system|pattern|structure|orchestrat|pipeline|flow|framework/i.test(lower)) {
    categories.add("architecture");
  }
  if (/database|db|schema|migration|sql|postgres|table|model|drizzle/i.test(lower)) {
    categories.add("database");
  }
  if (/test|validate|verify|lint|build|deploy|ci|quality|spec|acceptance/i.test(lower)) {
    categories.add("testing");
  }
  if (/repo|repository|github|git|push|commit|branch|pull|merge|clone/i.test(lower)) {
    categories.add("repository");
  }
  if (/code|coding|implement|build|create|scaffold|generate|refactor|fix|bug|feature|page|route|api|component/i.test(lower)) {
    categories.add("coding");
  }

  // Always include at minimum coding + architecture
  if (categories.size === 0) {
    categories.add("coding");
    categories.add("architecture");
  }

  return [...categories];
}

// ─── VPS Bridge File Reading ────────────────────────────────────────────

interface FsReadResult {
  success: boolean;
  content?: string;
  error?: string;
}

async function vpsFsRead(path: string): Promise<FsReadResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${VPS_FS_BRIDGE_URL}/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return { success: false, error: `Bridge returned ${res.status}` };
    }

    const data = await res.json();
    return { success: true, content: data.content };
  } catch (err) {
    return {
      success: false,
      error: `VPS bridge unavailable: ${err instanceof Error ? err.message : "Unknown"}`,
    };
  }
}

// ─── Cache ───────────────────────────────────────────────────────────────

const cache = new Map<string, CacheEntry>();

function getCached(intentKey: string): SkillEntry[] | null {
  const entry = cache.get(intentKey);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(intentKey);
    return null;
  }
  return entry.skills;
}

function setCache(intentKey: string, skills: SkillEntry[]): void {
  cache.set(intentKey, {
    skills,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

// ─── Main API ────────────────────────────────────────────────────────────

/**
 * Load skills for a given intent.
 * Returns array of { path, name, content, category } with full skill markdown.
 * Results are cached in memory for 5 minutes.
 */
export async function loadSkillsForIntent(
  intent: string,
  options?: {
    /** Limit to specific categories */
    categories?: string[];
    /** Maximum number of skills to load (default all detected) */
    maxSkills?: number;
    /** Skip cache (force fresh load) */
    forceRefresh?: boolean;
  }
): Promise<SkillEntry[]> {
  const categories = options?.categories || detectCategories(intent);
  const cacheKey = categories.sort().join("|");

  // Check cache first
  if (!options?.forceRefresh) {
    const cached = getCached(cacheKey);
    if (cached) return cached;
  }

  // Collect skill names from selected categories
  const skillNames: Set<string> = new Set();
  for (const cat of categories) {
    const names = SKILL_CATEGORIES[cat];
    if (names) {
      names.forEach((n) => skillNames.add(n));
    }
  }

  // Load each skill in parallel
  const results: SkillEntry[] = [];
  const maxSkills = options?.maxSkills ?? skillNames.size;

  const loadPromises = [...skillNames].slice(0, maxSkills).map(async (name) => {
    // Determine which category this skill belongs to
    let category = "coding";
    for (const [cat, names] of Object.entries(SKILL_CATEGORIES)) {
      if (names.includes(name)) {
        category = cat;
        break;
      }
    }

    const skillPath = `jarvis/cortex/skills/${name}.md`;

    try {
      const result = await vpsFsRead(skillPath);
      if (result.success && result.content) {
        return {
          path: skillPath,
          name,
          content: result.content,
          category,
        } as SkillEntry;
      }
    } catch {
      // Skill not available — skip
    }
    return null;
  });

  const loaded = await Promise.all(loadPromises);
  const valid = loaded.filter((s): s is SkillEntry => s !== null);
  results.push(...valid);

  // Cache the results
  setCache(cacheKey, results);

  return results;
}

/**
 * Load specific skills by name (used for explicit skill lists from planSession).
 */
export async function loadSkillsByName(
  skillNames: string[],
  options?: { forceRefresh?: boolean }
): Promise<SkillEntry[]> {
  const cacheKey = `explicit:${skillNames.sort().join(",")}`;

  if (!options?.forceRefresh) {
    const cached = getCached(cacheKey);
    if (cached) return cached;
  }

  const results = await Promise.all(
    skillNames.map(async (name) => {
      let category = "coding";
      for (const [cat, names] of Object.entries(SKILL_CATEGORIES)) {
        if (names.includes(name)) { category = cat; break; }
      }

      const skillPath = `jarvis/cortex/skills/${name}.md`;
      try {
        const result = await vpsFsRead(skillPath);
        if (result.success && result.content) {
          return { path: skillPath, name, content: result.content, category } as SkillEntry;
        }
      } catch { /* skip */ }
      return null;
    })
  );

  const valid = results.filter((s): s is SkillEntry => s !== null);
  setCache(cacheKey, valid);
  return valid;
}

/**
 * Format loaded skills as a V2 system prompt injection block.
 */
export function formatSkillsForSystemPrompt(skills: SkillEntry[]): string {
  if (skills.length === 0) return "";

  const sections = skills.map((s) => {
    // Truncate very long skills to prevent token explosion
    const truncated = s.content.length > 8000
      ? s.content.slice(0, 8000) + `\n\n[... truncated ${s.content.length - 8000} chars]`
      : s.content;

    return `## Skill: ${s.name} (${s.category})\n\n${truncated}`;
  });

  return `\n\n---\n## LOADED SKILLS (${skills.length} skills from ${new Set(skills.map(s => s.category)).size} categories)\n\n${sections.join("\n\n---\n\n")}`;
}

/**
 * Clear the skills cache (for testing or forced refresh).
 */
export function clearSkillsCache(): void {
  cache.clear();
}

/**
 * Get cache stats.
 */
export function getSkillsCacheStats(): { size: number; keys: string[] } {
  return {
    size: cache.size,
    keys: [...cache.keys()],
  };
}
