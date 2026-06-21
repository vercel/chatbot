# Twenty CRM — Overview

## What is Twenty?
Twenty is an open-source, self-hosted CRM platform built with NestJS (backend) and React (frontend). It combines a modern CRM workspace with an extensible app framework that lets developers define custom objects, fields, serverless functions, and AI agents — all in TypeScript.

## Why Twenty for NewLeaf?
Twenty replaces Base44's internal data management with a production-grade CRM that:
- **Is self-hosted** — data lives on our VPS, not a third-party
- **Is extensible** — custom objects, logic functions, skills, agents via TypeScript SDK
- **Has built-in workflows** — visual automation for SLA alerts, lead routing, payment tracking
- **Has GraphQL + REST APIs** — programmatic access for n8n, GHL, Hyperswitch integrations
- **Has AI agents** — Claude-powered assistants for credit disputes, billing analysis
- **Is open source** — MIT license, 25K+ GitHub stars, active community

## Production State
- **Server:** Port 3002 (docker: twenty-newleaf-server)
- **Workspace:** "NewLeaf Financial" (`cebc5a0a-e707-409e-bed6-4373a675704e`)
- **Subdomain:** `newleaf` → https://newleaf.crm.newleaf.financial
- **Database:** PostgreSQL 16, Redis 7, BullMQ worker
- **Admin users:** aswa0617@gmail.com, jerry.b.yirenkyi@gmail.com
- **Status:** HEALTHY — all 4 Docker containers running

## Key Concepts
| Concept | Description |
|---------|-------------|
| **Workspace** | Isolated tenant with its own schema, users, and objects |
| **Object** | Custom or standard record type (like a database table) |
| **Field** | Column on an object (TEXT, NUMBER, CURRENCY, RELATION, etc.) |
| **View** | Saved filter + column config for browsing records |
| **Workflow** | Visual automation — triggers → actions |
| **Logic Function** | Server-side TypeScript with 6 trigger types |
| **Skill** | AI agent instruction set (reusable prompt + tools) |
| **Agent** | Custom AI assistant with prompt + model + structured output |
| **App** | Packaged extension (objects + functions + UI + roles) |
| **Webhook** | Outbound event delivery + inbound Workflow triggers |

## Navigation
- [Architecture](02-architecture.md) — Stack, topology, repo structure
- [Data Model](03-data-model.md) — Objects, fields, relations, custom objects
- [API Reference](04-api-reference.md) — GraphQL + REST + MCP
- [Workflows](05-workflows.md) — Automation engine
- [Functions](06-functions.md) — Serverless TypeScript
- [Apps Marketplace](07-apps-marketplace.md) — Extension packaging
- [Self-Hosting](08-self-hosting.md) — Docker, env vars, backup
- [Customization Guide](09-customization-guide.md) — End-to-end extension walkthrough
- [NewLeaf Integration](10-newleaf-integration.md) — How Twenty fits our stack
