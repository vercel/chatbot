# @app/agent-api

Stateless Mastra backend for the Helios extension.

## Runtime

- Node.js 22.13.0+
- TypeScript + ES modules
- AI SDK v6-compatible streaming

## Endpoints

- `POST /v1/chat/stream`
- `POST /v1/tools/execute` (stub in v1)
- `GET /v1/healthz`
- `GET /v1/readyz`

## Auth

All protected routes require:

```http
Authorization: Bearer <google_access_token>
```

Token validation is performed per request against Google userinfo:

`https://openidconnect.googleapis.com/v1/userinfo`

No chat/thread persistence is stored server-side.

## Local development

```bash
pnpm install
pnpm --filter @app/agent-api dev
```

Set environment variables in `.env`:

- `OPENAI_API_KEY`

## Build

```bash
pnpm --filter @app/agent-api build
pnpm --filter @app/agent-api start
```
