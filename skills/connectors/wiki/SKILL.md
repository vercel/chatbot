---
name: wiki-connector
version: 1.0.0
kind: connector
primary_domain: reporting
also_in: [mcp-edits]
tools: [searchWiki, getPage, createPage, updatePage]
dependencies: []
headline: |
  Internal wiki connector for NewLeaf documentation and SOPs.
type: "skill"
access: internal
---

# Wiki Connector Skill

## Operational Knowledge
Internal wiki for NewLeaf Financial standard operating procedures, training docs, and reference material.

## Tools
| Tool | Description |
|------|-------------|
| searchWiki | Full-text search |
| getPage | Retrieve wiki page |
| createPage | Create new page |
| updatePage | Update existing page |

## Safeguards
- Verify page exists before updating
- Include edit summary on all modifications
