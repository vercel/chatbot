---
name: wiki-skills
version: 1.0.0
connector: wiki
scope: neptune-custom
total_actions: 20
priority: P1
intent_tags:
  - wiki
  - knowledge-base
  - documentation
  - memory
  - search
associated_connectors:
  - base44
headline: |
  20 Karpathy Wiki actions: pages, search, ingest, lint, index, categories,
  tags, cross-references, and knowledge management. Long-term agent memory.
type: "skill"
---

# Karpathy Wiki Skills — 20 Actions

## Core Intent
Complete Karpathy Wiki knowledge management: create and manage pages, semantic search, content ingestion, linting and health checks, category management, cross-referencing, and index maintenance. The wiki is Neptune's long-term memory.

## Action Catalog

### Page Management (5 actions)
| # | Action | Description |
|---|--------|-------------|
| 1 | `page.create` | Create a new wiki page with title, category, tags |
| 2 | `page.get` | Get page content by path or ID |
| 3 | `page.update` | Update page content with version tracking |
| 4 | `page.deprecate` | Mark a page as [DEPRECATED] (never delete) |
| 5 | `page.restore` | Restore a deprecated page to active |

### Search & Discovery (4 actions)
| 6 | `search.semantic` | Semantic search across all wiki pages |
| 7 | `search.by_tag` | Find pages by tag with relevance scoring |
| 8 | `search.by_category` | List all pages in a category |
| 9 | `search.related` | Find pages related to a given page |

### Content Ingestion (3 actions)
| 10 | `ingest.url` | Ingest content from a URL into the wiki |
| 11 | `ingest.text` | Ingest plain text or markdown content |
| 12 | `ingest.file` | Ingest content from a file upload |

### Index Management (3 actions)
| 13 | `index.rebuild` | Rebuild the wiki catalog index |
| 14 | `index.status` | Get index health and statistics |
| 15 | `index.optimize` | Optimize index for search performance |

### Linting & Health (3 actions)
| 16 | `lint.check` | Run lint rules: contradictions, stale, orphans |
| 17 | `lint.stale` | List pages not updated in 90+ days |
| 18 | `lint.orphans` | List pages with no incoming links |

### Category & Tag Management (2 actions)
| 19 | `category.list` | List all categories with page counts |
| 20 | `tag.cloud` | Get tag cloud with frequency distribution |

## Operational Context
- Wiki stored at `/home/hermes/knowledge-base/wiki/`
- Pages are markdown files indexed in catalog
- Categories: concepts, connectors, entities, projects, operations
- NEVER store PII or credentials in wiki pages
- NEVER delete pages — use [DEPRECATED] instead
- All pages need: title, category, content (markdown)

## Anti-Patterns
- NEVER write PII to the wiki
- NEVER create pages without categories
- NEVER delete pages instead of deprecating
- NEVER write raw HTML — markdown only
- NEVER store credentials or secrets
- NEVER skip the lint step before major changes

## Workflow Examples

### Document a New Pattern
```
1. search.semantic({ query: "pattern description" }) → check for existing
2. page.create({ path, title, content, category: "concepts", tags })
3. index.rebuild() → update search index
```

### Audit Wiki Health
```
1. lint.check() → full audit
2. lint.stale() → pages needing updates
3. lint.orphans() → unlinked pages to connect
4. index.status() → index health metrics
```

### Research a Topic
```
1. search.semantic({ query, maxResults: 5 })
2. search.related({ pageId }) → find connected knowledge
3. search.by_tag({ tag: "billing" }) → domain-specific pages
```
