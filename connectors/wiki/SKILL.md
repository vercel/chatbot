---
name: wiki-connector
description: Karpathy-style second brain — ingest, query, lint, and manage knowledge
version: 1.0.0
domain: reporting
mcp: false
custom_client: true
---
# Wiki Integration Pack

## File Capabilities & Paths
- **Custom API Client:** `connectors/wiki/index.ts`
- **Manifest:** `connectors/wiki/manifest.ts`
- **Schema:** `connectors/wiki/schema.ts`

## Available Actions
| Tool | Description |
|------|-------------|
| ingestPage | Ingest a new page into the knowledge base |
| queryWiki | Search the wiki by semantic query |
| lintPage | Run linting rules against a wiki page |
| writePage | Create or update a wiki page |
| updateIndex | Rebuild the knowledge base index |
| listPages | List all wiki pages with metadata |
