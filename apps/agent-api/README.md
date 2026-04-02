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

## Cloud Run deployment checklist

1. Build and push image:

   ```bash
   docker build -t gcr.io/<project-id>/helios-agent-api:latest -f apps/agent-api/Dockerfile .
   docker push gcr.io/<project-id>/helios-agent-api:latest
   ```

2. Deploy with required env vars:

   ```bash
   gcloud run deploy helios-agent-api \
     --image gcr.io/<project-id>/helios-agent-api:latest \
     --region <region> \
     --platform managed \
     --allow-unauthenticated \
     --set-env-vars OPENAI_API_KEY=<value>
   ```

3. Validate health endpoints:

   - `GET /v1/healthz`
   - `GET /v1/readyz`
