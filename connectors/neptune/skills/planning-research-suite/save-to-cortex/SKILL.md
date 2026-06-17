---
name: save-to-cortex
version: 1.0.0
domain: planning-research
connector: neptune
scope: planning-research-suite
priority: P0
intent_tags:
  - save this
  - persist
  - store
  - archive
  - keep this
  - remember this
  - save for later
associated_skills:
  - draft-prd
  - draft-trd
  - draft-impl-plan
  - deep-research
headline: |
  Persist any planning artifact to the Jarvis file system.
  Classifies content type, applies YAML frontmatter, resolves target paths,
  and writes via VPS FS bridge. The canonical save mechanism for all PRDs,
  TRDs, plans, research, and missions.
type: "skill"
access: internal
---

# Save to Cortex — Artifact Persistence

## Core Intent

The single, canonical mechanism for persisting planning artifacts to the
Jarvis file system (VPS FS bridge). Handles content type classification,
path resolution, YAML frontmatter formatting, write verification, and
annotation recording. Every PRD, TRD, plan, research output, and mission
is saved through this skill.

## Target Paths

| Content Type | Path Pattern | Example |
|-------------|-------------|---------|
| PRD | `jarvis/prd/{title}-{date}.md` | `jarvis/prd/my-feature-prd-2026-06-13.md` |
| TRD | `jarvis/prd/{title}-TRD-{date}.md` | `jarvis/prd/my-feature-TRD-2026-06-13.md` |
| Implementation Plan | `jarvis/prd/{title}-IMPL-PLAN-{date}.md` | `jarvis/prd/my-feature-IMPL-PLAN-2026-06-13.md` |
| Gap Analysis | `jarvis/prd/{title}-GAP-ANALYSIS-{date}.md` | `jarvis/prd/my-feature-GAP-ANALYSIS-2026-06-13.md` |
| Research | `jarvis/cortex/research/{slug}-{date}.md` | `jarvis/cortex/research/ai-sdk-comparison-2026-06-13.md` |
| Synthesis | `jarvis/cortex/{title}-{date}.md` | `jarvis/cortex/synthesis-ai-frameworks-2026-06-13.md` |
| Mission | `jarvis/cortex/missions/{name}-{date}.yaml` | `jarvis/cortex/missions/deploy-auth-2026-06-13.yaml` |
| Decision | `jarvis/cortex/decisions/{id}-{date}.json` | `jarvis/cortex/decisions/plan-abc123-2026-06-13.json` |
| General | `jarvis/cortex/{title}-{date}.md` | `jarvis/cortex/my-notes-2026-06-13.md` |

## YAML Frontmatter Template

All .md files get YAML frontmatter:

```yaml
---
title: "Human-readable title"
type: prd | trd | plan | research | synthesis | general
version: "1.0.0"
status: draft | review | approved | archived
created: "2026-06-13T00:00:00Z"
updated: "2026-06-13T00:00:00Z"
author: "Neptune Chat / planning-research domain"
tags: [tag1, tag2]
related_prds: []
related_trds: []
cardinal_rules_applied: [rule_ids]
---
```

## Action Catalog

### Classification (3 actions)

| # | Action | Description |
|---|--------|-------------|
| 1 | `save.classify` | Classify content as PRD/TRD/plan/research/mission/general |
| 2 | `save.resolve_path` | Resolve target path based on content type + title + date |
| 3 | `save.generate_slug` | Generate filesystem-safe slug from title |

### Formatting (3 actions)

| 4 | `save.format_frontmatter` | Generate YAML frontmatter for the content type |
| 5 | `save.format_markdown` | Format content as proper markdown |
| 6 | `save.format_yaml` | Format mission/workflow as YAML |

### Write & Verify (3 actions)

| 7 | `save.write` | Write file via VPS FS bridge |
| 8 | `save.verify` | Confirm file was written and is readable |
| 9 | `save.annotate` | Record save operation in annotation loop |

## Procedure

1. Classify content: analyze structure to determine type (PRD, TRD, plan, etc.)
2. Resolve target path: apply path pattern based on type
3. Generate slug: convert title to filesystem-safe string (lowercase, hyphens)
4. Generate date string: YYYY-MM-DD format
5. Format YAML frontmatter: title, type, version, status, date, author, tags, references
6. Format content: ensure valid markdown or YAML structure
7. Prepend frontmatter to content
8. Write file via VPS FS bridge (`jarvis/fs/write`)
9. Verify write: read back to confirm content integrity
10. Record annotation: path, file size, content type, duration
11. Return save confirmation with path and file ID

## Error Handling

- VPS bridge unavailable → return error with diagnostic info
- Path collision → append counter suffix (e.g., `-2` for second save)
- Write permission denied → return error, suggest checking FS permissions
- File too large (>500KB) → warn, still attempt save
- Invalid characters in slug → sanitize automatically

## Output Structure

```typescript
interface SaveOutput {
  success: boolean;
  path: string;
  content_type: string;
  file_size_bytes: number;
  verified: boolean;
  frontmatter: object;
  timestamp: string;
  annotation_id: string;
  warning?: string;
  error?: string;
}
```

## Anti-Patterns

- DON'T save without frontmatter — all .md files must have YAML frontmatter
- DON'T save to wrong path — use the path resolution map
- DON'T skip verification — always confirm the write succeeded
- DON'T save duplicate content — check for existing files first (optional)
- DON'T hardcode paths — always use the path resolver
- DON'T skip annotation — every save must be recorded

## Related Skills

- All planning-research skills use save-to-cortex as their final step
- `cardinal-rules-extract` — provides rules to include in frontmatter references
