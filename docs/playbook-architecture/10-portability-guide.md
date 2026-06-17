---
title: "10 — Portability Guide"
version: "1.0.0"
last_updated: "2026-06-15"
owner: "playbook-skills meta-skill"
status: ACTIVE
kb_index: 10
type: "concept"
access: internal
---

# 10 — Portability Guide

How to migrate playbooks, skills, and workflows between organizations.

## The Fractal Advantage

Because every skill follows the same fractal shape, porting between orgs is straightforward:
1. Copy the skill directory (it's self-contained)
2. Update connector references (different orgs have different APIs)
3. Update playbook frontmatter (org-specific model routing)

## Portability Checklist

### Porting a Single Playbook

```
[ ] Copy playbook-skills/playbooks/playbook-<domain>.md to new org
[ ] Update YAML frontmatter:
    [ ] domain field → new org's domain name
    [ ] model_routing → new org's model preferences
[ ] Update connector references:
    [ ] connectors/<name>/ → new org's connector paths
[ ] Add to new org's PLAYBOOK-ROUTER.md intent table
[ ] Ingest into new org's knowledge graph (POST /api/wiki/ingest)
[ ] Test: run route-intent with sample trigger keywords
```

### Porting a Skill (with functions + playbooks + workflows)

```
[ ] Copy entire skill directory: connectors/neptune/skills/custom-skills/<skill>/
    [ ] functions/ → all .ts files
    [ ] playbooks/ → all .md files
    [ ] workflows/ → all .ts files
    [ ] SKILL.md → skill definition
[ ] Update imports in functions to point to new org's libs
[ ] Update connector paths in playbooks
[ ] Register tool in new org's chat route
[ ] Test: load_skill with skill name
```

### Porting the Entire playbook-skills Meta-Skill

```
[ ] Copy connectors/neptune/skills/custom-skills/playbook-skills/
[ ] Update all connector paths in PLAYBOOK-ROUTER.md
[ ] Update NEPTUNE.md to point to new router path
[ ] Run bootstrap-new-org workflow (see 11-bootstrap-new-org.md)
[ ] Copy /docs/playbook-architecture/ KB docs
[ ] Triple-mirror KB in new org (repo + cortex + Chat page)
[ ] Git commit with crossover reference to source org
```

## Connector Abstraction

Connectors are the main org-specific dependency. Each org should:
1. Map their external services to the connector interface
2. Create a `connectors/<name>/PLAYBOOK.md` for each
3. Register in `getAvailableTools()` or MCP hub

## Model Routing Portability

Model routing is configurable per-org via:
- `lib/ai/models.ts` — Register org's available models
- `lib/ai/model-router.ts` — Customize task-type → model mapping
- Playbook frontmatter `model_routing:` — Per-playbook overrides

## Knowledge Graph Portability

Knowledge graph entities can be exported/imported:
- Export: `GET /api/wiki/search?q=playbook` → JSON
- Import: `POST /api/wiki/ingest` for each entity
- Cross-references are rebuilt by `organize-knowledge-graph.ts`

---

*Phase 21 V3 — Fractal Library + Router-as-Map*
