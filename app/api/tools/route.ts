import { NextResponse } from "next/server";
import { requireAllowlist } from "@/lib/auth/require-allowlist";

/**
 * U2.1.C — Gatekeeper Tools Endpoint
 * Reduced from 21 tools to 7 gatekeeper tools per Pattern A
 * (Documentation-Driven Runtime architecture).
 *
 * The 6 tools form a progressive disclosure chain:
 *   DISCOVER → LOAD → EXECUTE → BUILD
 *
 * All other capabilities (connectors, data, sandbox) are accessed
 * through load_skill and execute_skill — the agent loads detailed
 * playbooks on demand rather than having 400+ tools in the array.
 */
export const GET = requireAllowlist(async () => {
  const tools = [
    {
      name: "view_file",
      category: "gatekeeper",
      description:
        "Read any file from the knowledge base or codebase. Use for playbooks, skills, PRDs, configuration, or source code. Paths: playbooks/<domain>/playbook-*.md, connectors/<name>/PLAYBOOK.md, jarvis/cortex/skills/<name>.md, lib/, app/.",
    },
    {
      name: "view_github_file",
      category: "gatekeeper",
      description:
        "Read any file from a GitHub repository using the GitHub Contents API. Provide repo (owner/name), path, and optional ref (branch/sha). Alias for view_file on remote repos.",
    },
    {
      name: "query_knowledge",
      category: "gatekeeper",
      description:
        "Query the Knowledge Graph (Postgres library_* tables) for connectors, playbooks, skills, functions, workflows. Returns structured results with relevance. Use BEFORE describing system capabilities to avoid hallucination.",
    },
    {
      name: "load_skill",
      category: "gatekeeper",
      description:
        "Load detailed skill content on-demand. Categories: connectors/ (NMI, Slack, GitHub, Vercel), capabilities/ (self-coding, sandbox), playbooks/<domain>/ (domain-specific playbooks). Keeps context efficient — only load what you need, when you need it. Alias: listPlaybookSkill.",
    },
    {
      name: "execute_skill",
      category: "gatekeeper",
      description:
        "Execute a named skill from the knowledge base. Loads SKILL.md, parses YAML frontmatter (Anthropic Agent Skills Spec), resolves from playbook-skills/playbooks/{domain}/skills/{name}.md or jarvis/cortex/skills/{name}.md, and returns the full execution contract with step-by-step traces. Use for domain-specific operations that have documented procedures.",
    },
    {
      name: "list_playbooks",
      category: "gatekeeper",
      description:
        "List all available domain playbooks from playbooks/. Returns each playbook's path, domain, title, routine count, and safeguard count. Use to discover what operational procedures are documented before loading a specific playbook.",
    },
    {
      name: "self_code",
      category: "gatekeeper",
      description:
        "Make SMALL changes to Neptune Chat's own codebase (typos, color tweaks, copy changes, prop additions). Uses Vercel Sandbox SDK to clone, edit, build, push, and deploy. For anything bigger than 50 lines or 3 files, use spawn_v2 instead.",
    },
    {
      name: "spawn_v2",
      category: "gatekeeper",
      description:
        "Hand off complex multi-step coding tasks to Neptune V2. Modes: 'modify_existing' (clone repo, fix, commit, PR, deploy) and 'new_project' (create GitHub repo, scaffold Next.js 16 + shadcn, push, deploy to Vercel). Use for any task too large for self_code.",
    },
    {
      name: "run_workflow",
      category: "gatekeeper",
      description:
        "Execute a predefined workflow by name (e.g., 'discover-customers', 'audit-billing'). Posts to /api/workflow/{workflow_name}/run with inputs. Returns workflowRunId + sseUrl for live progress tracking. Fallbacks to legacy /api/workflow/run. Workflows chain multiple steps: research, PRD generation, gap analysis, implementation planning, mission dispatch.",
    },
    {
      name: "execute_skill_v2",
      category: "gatekeeper",
      description:
        "Execute a skill with step-level tracing. Same as execute_skill but with additional step-by-step execution traces showing per-step status (pending/running/completed/failed), timing, and tool references. Use when you need detailed visibility into skill execution.",
    },
    {
      name: "run_workflow_named",
      category: "gatekeeper",
      description:
        "Run a named workflow with workflow_name + inputs. Enhanced workflow runner with SSE URL, report URL, and structured error handling. Supports async execution with live progress streaming. Falls back gracefully to legacy workflow endpoint.",
    },
  ];

  return NextResponse.json({
    tools,
    count: tools.length,
    architecture: "U2-Progressive-Disclosure",
    pattern: "Documentation-Driven Runtime (Pattern A)",
    version: "2.1.0",
  });
});
