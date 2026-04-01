# Helios Sidebar Platform

Monorepo for a Chrome-first AI sidepanel extension and stateless Mastra backend.

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
```

## Prerequisites

- Node.js 22.13.0+
- pnpm 10+

## Commands

```bash
pnpm install
pnpm -r typecheck
pnpm -r lint
pnpm -r test
pnpm -r build
```

## Local Development

Run extension dev server:

```bash
pnpm --filter @app/extension dev
```

Run backend dev server:

```bash
pnpm --filter @app/agent-api dev
```
