---
connector: wiki
version: 0.2.0
scope: connector
auto_load: true
trigger_tools:
  - wiki:ingestSource
  - wiki:queryWiki
  - wiki:lintWiki
  - wiki:writeWikiPage
  - wiki:updateIndex
headline: |
  Karpathy Wiki long-term memory. Never store PII or credentials in wiki pages.
  All pages need title, category, tags. Deprecate with [DEPRECATED] — never delete.
type: "playbook"
---

# Wiki (Karpathy Wiki) Connector Playbook

## Operational Knowledge

### Architecture
Wiki tools proxy through the Hermès API at `HERMES_API/api/wiki/{action}`. The Karpathy Wiki is a persistent knowledge base stored on the Hermès VPS under `/home/hermes/knowledge-base/wiki/`. Pages are markdown files indexed in a catalog.

### Auth
- Hermès API: internal auth
- Wiki filesystem: local VPS access
- No separate API keys for wiki operations

### Wiki Structure
```
/home/hermes/knowledge-base/wiki/
├── concepts/      # Technical concepts and patterns
├── connectors/    # Integration documentation per connector
├── entities/      # Business entities (customers, transactions)
├── projects/      # Project documentation (Neptune, Base44, etc.)
└── operations/    # Operational runbooks and procedures
```

### Tools
- `ingestSource` — Ingest URL, text, or file into the wiki
- `queryWiki` — Semantic search across wiki pages
- `lintWiki` — Check for contradictions, stale pages, orphans
- `writeWikiPage` — Create or update a wiki page
- `updateIndex` — Rebuild the wiki catalog index

## Business Context

### Why Karpathy Wiki
The Karpathy Wiki is Neptune's long-term memory. It stores everything the agents learn — connector documentation, operational procedures, customer patterns, and technical decisions. Unlike the chat context (which is ephemeral), the wiki persists across sessions and agents.

### Use Cases
1. **Knowledge storage**: Agent learns something → writes to wiki → future agents benefit
2. **Documentation drafting**: Agent drafts connector docs → stored in wiki → reviewed by humans
3. **Pattern detection**: Agent notices recurring issue → documents pattern → future agents recognize it
4. **Onboarding**: New agents query wiki for context → faster ramp-up

## Anti-Patterns

### ❌ NEVER:
1. Write PII to the wiki — it's a knowledge base, not a data store
2. Create pages without categories — unorganized pages become unsearchable
3. Delete pages instead of archiving with `[DEPRECATED]` prefix
4. Write raw HTML — use markdown only
5. Store credentials or secrets in wiki pages
6. Skip the lint step — contradictions compound over time

### ⚠️ DANGEROUS:
- Writing to wiki without checking for existing pages on the topic
- Auto-ingesting external content without verification
- Modifying the index without understanding the catalog schema

## Safeguards

### Content Validation
- All pages must have: title, category, content (markdown)
- Tags help with searchability — always include relevant tags
- Path must be relative to wiki root (no absolute paths, no traversal)

### Lint Rules
- Contradictions: pages that claim opposite facts
- Stale pages: not updated in 90+ days without `[STABLE]` tag
- Orphan pages: no incoming links from other pages
- Schema compliance: required frontmatter fields present

### Error Handling
- Page exists → offer to update, don't silently overwrite
- Invalid category → suggest valid categories
- Index rebuild failed → check filesystem permissions
- Source ingest failed → return the specific reason (URL unreachable, file not found, text empty)

## Common Workflows

### Ingest a Documentation URL
```
ingestSource({
  source: "https://api.slack.com/docs",
  sourceType: "url",
  title: "Slack API Documentation",
  category: "connectors"
})
→ ingests and indexes the content
```

### Search the Wiki
```
queryWiki({ query: "NMI CIT vs MIT", maxResults: 5 })
→ returns relevant pages with snippets
```

### Create an Operational Runbook
```
writeWikiPage({
  path: "operations/deploy-rollback",
  title: "Deploy Rollback Procedure",
  content: "# Deploy Rollback\n\n1. Check Vercel dashboard...\n2. Run redeploy...",
  category: "operations",
  tags: ["deploy", "vercel", "rollback", "runbook"]
})
```

### Audit Wiki Health
```
lintWiki({ fix: false })
→ returns contradictions, stale pages, orphans
```

## Refinement Notes

- **Version:** 1.0.0
- **Created:** 2026-06-09
- **Last Reviewed:** 2026-06-09
- **Source:** Hermès Wiki API, Karpathy Wiki architecture
- **Related:** jarvis/cortex/skills/neptune-project-hierarchy-LOCKED.md
