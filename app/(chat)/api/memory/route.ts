/**
 * GET /api/memory — Returns current agent memory state:
 * system prompt, loaded playbook, skills in scope, conversation context, cortex files
 */
import { NextResponse } from "next/server";
import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join } from "path";

const NEPTUNE_MD_PATH = "/home/neptune/neptune-chat/.agents/neptune.md";
const ORG_PLAYBOOKS_ROOT = "/home/neptune/newleaf-org-playbooks";
const SHARED_SKILLS_ROOT = "/home/neptune/_shared-skills";
const CORTEX_ROOT = "/home/hermes/cortex";

/** List most recent files in a directory (recursive, up to limit) */
function recentsInDir(root: string, maxFiles = 10): { path: string; size: number; modified: string }[] {
  const results: { path: string; size: number; modified: string }[] = [];
  try {
    if (!existsSync(root)) return results;
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        if (results.length >= maxFiles * 3) return;
        const full = join(dir, entry);
        try {
          const st = statSync(full);
          if (st.isDirectory() && !entry.startsWith(".") && !entry.startsWith("_")) {
            walk(full);
          } else if (st.isFile() && entry.endsWith(".md")) {
            results.push({
              path: full.replace(root, ""),
              size: st.size,
              modified: st.mtime.toISOString(),
            });
          }
        } catch {
          // skip
        }
      }
    };
    walk(root);
  } catch {
    // skip
  }
  return results
    .sort((a, b) => b.modified.localeCompare(a.modified))
    .slice(0, maxFiles);
}

export async function GET() {
  // 1. System Prompt
  let systemPrompt = "";
  try {
    if (existsSync(NEPTUNE_MD_PATH)) {
      systemPrompt = readFileSync(NEPTUNE_MD_PATH, "utf-8");
    }
  } catch {
    systemPrompt = "";
  }

  // 2. Loaded Playbook (root workspace)
  let loadedPlaybook: { title: string; domains: string[] } | null = null;
  try {
    const rootPlaybookPath = join(ORG_PLAYBOOKS_ROOT, "PLAYBOOK.md");
    if (existsSync(rootPlaybookPath)) {
      const raw = readFileSync(rootPlaybookPath, "utf-8");
      const domainMatches = raw.match(/\| ([a-z-]+)\/PLAYBOOK\.md/g);
      const domains = domainMatches
        ? [...new Set(domainMatches.map((m) => m.replace("| ", "").replace("/PLAYBOOK.md", "").trim()))]
        : [];
      loadedPlaybook = {
        title: "NewLeaf Financial — Root Playbook",
        domains: domains.slice(0, 9),
      };
    }
  } catch {
    // skip
  }

  // 3. Skills in scope
  let skillsInScope: { name: string; kind: string; domain: string }[] = [];
  try {
    const registryPath = join(SHARED_SKILLS_ROOT, "registry.json");
    if (existsSync(registryPath)) {
      const reg = JSON.parse(readFileSync(registryPath, "utf-8"));
      const all: { name: string; kind: string; domain: string }[] = [];
      for (const kind of ["connectors", "functions", "capabilities"]) {
        for (const skill of reg[kind] || []) {
          all.push({
            name: skill.name,
            kind: kind.slice(0, -1),
            domain: skill.primary_domain || "unknown",
          });
        }
      }
      skillsInScope = all;
    }
  } catch {
    // skip
  }

  // 4. Conversation Context (placeholder — real data from session store)
  const conversationContext = {
    activeSession: null,
    recentMessages: 0,
    note: "Conversation context is managed per-chat and tracked in session store.",
  };

  // 5. Recent cortex files
  const cortexFiles = recentsInDir(CORTEX_ROOT, 10);

  return NextResponse.json({
    systemPrompt: systemPrompt
      ? {
          source: ".agents/neptune.md",
          size: systemPrompt.length,
          lines: systemPrompt.split("\n").length,
          preview: systemPrompt.slice(0, 500) + (systemPrompt.length > 500 ? "\n\n... (truncated)" : ""),
          full: systemPrompt,
        }
      : null,
    loadedPlaybook,
    skillsInScope: {
      total: skillsInScope.length,
      connectors: skillsInScope.filter((s) => s.kind === "connector").length,
      functions: skillsInScope.filter((s) => s.kind === "function").length,
      capabilities: skillsInScope.filter((s) => s.kind === "capability").length,
      list: skillsInScope,
    },
    conversationContext,
    cortexFiles,
    refreshedAt: new Date().toISOString(),
  });
}
