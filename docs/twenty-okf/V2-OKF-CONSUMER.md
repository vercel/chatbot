---
type: spec
name: "V2 Coding Agent as OKF Consumer"
description: "How Neptune V2 reads OKF bundles for context, finds playbooks, generates code, and updates skills"
version: "1.0.0"
updated: "2026-06-17"
domain: mcp-edits
priority: P0
access: internal
---

# V2 Coding Agent as OKF Consumer — Phase 37 Stream 1

## Overview

Neptune V2 (the full coding agent) consumes OKF/NKS bundles to:
1. Understand project architecture before coding
2. Find relevant playbooks for the task domain
3. Generate code following established patterns
4. Update skill files after successful builds
5. Cross-reference existing skills to avoid duplication

## V2 → OKF Flow

```
User: "Build me a X feature"
       │
       ▼
┌──────────────────────────────┐
│ V2: Query Knowledge Graph    │
│ GET /api/knowledge/search?q=X│
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ V2: Load Relevant Playbook   │
│ GET /api/knowledge/file/...  │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ V2: Find Patterns + Skills   │
│ Parse playbook → connectors  │
│ Check for existing skills    │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ V2: Generate Code            │
│ Following playbook patterns  │
│ Using identified skills      │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ V2: Build + Test             │
│ pnpm build must pass         │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ V2: Update Skill Files       │
│ Auto-add via skill-author    │
│ Update index.md + log.md     │
└──────────────────────────────┘
```

## V2 Context Assembly

When V2 starts a task, it assembles context from:

1. **Domain Playbook** — The main playbook for the task domain
2. **Connector Skills** — All skills linked in the playbook
3. **Patterns** — Established code patterns from the domain
4. **Anti-Patterns** — Known pitfalls to avoid
5. **Memory References** — Persistent context (e.g., NMI vault ID)
6. **Existing Skills** — Cross-reference to avoid duplication

```typescript
// V2 context assembly
async function assembleV2Context(task: string): Promise<V2Context> {
  const searchResults = await fetch(`/api/knowledge/search?q=${encodeURIComponent(task)}`);
  const { results } = await searchResults.json();

  const playbook = results.find(r => r.type === "playbook");
  const skills = results.filter(r => r.type === "skill" || r.type === "connector");

  // Load playbook content
  const playbookContent = playbook
    ? await fetch(`/api/knowledge/file/${playbook.path}`).then(r => r.text())
    : null;

  return {
    playbook: playbookContent,
    skills: skills.map(s => s.path),
    domain: playbook?.domain || "unknown",
    patterns: extractPatterns(playbookContent),
    antiPatterns: extractAntiPatterns(playbookContent),
    existingSkills: await getExistingSkills(playbook?.domain),
  };
}
```

## Skill Deduplication

V2 checks for existing skills before creating new ones:

```typescript
async function findExistingSkill(name: string, domain: string): Promise<boolean> {
  const res = await fetch(`/api/knowledge/search?q=${name}&type=skill&domain=${domain}`);
  const { results } = await res.json();
  return results.length > 0;
}
```

## Code Generation Patterns

V2 follows patterns defined in playbooks:

1. **Connector Pattern:** Create client.ts, schema.ts, manifest.ts, tools/, docs/
2. **Function Pattern:** Create SKILL.md with function signature + tests
3. **UI Component Pattern:** Create component in components/ with result-renderers/
4. **Workflow Pattern:** Create YAML with steps, conditions, dependencies

## Post-Build Updates

After successful build, V2:
1. Updates the skill's `updated` field to today
2. Appends to log.md: "V2 updated <skill>: <description>"
3. Regenerates index.md if files were added/removed
4. Runs OKF validator to ensure compliance
5. Commits with Co-Authored-By trailer

## Integration Status

- ✅ V2 context assembly from knowledge graph
- ✅ Playbook-based code generation pattern
- ✅ Skill deduplication logic
- ✅ Post-build skill update flow
- ⏳ Live V2 integration testing
- ⏳ Automatic skill update on deploy
