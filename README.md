# Helios Sidebar Platform

Monorepo for a Chrome-first AI sidepanel experience and stateless Mastra backend.

## Stack

- WXT + React + TypeScript (extension)
- assistant-ui runtime/UI primitives
- Mastra backend with AI SDK v6-compatible streaming
- Cloud Run deployment target (stateless execution)

## Workspace

```txt
apps/
  extension/
  agent-api/
packages/
  shared-types/
  shared-prompts/
  shared-ui/
```

## Prerequisites

- Node.js 22.13.0+
- pnpm 10+

## Commands

```bash
pnpm install
pnpm dev
pnpm build
pnpm typecheck
pnpm test
```
