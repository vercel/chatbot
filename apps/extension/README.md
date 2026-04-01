# @app/extension

Chrome-first sidepanel extension built with WXT + React + TypeScript.

## Features

- Sidepanel UI with Chat / Artifact / Trace / Context tabs
- assistant-ui ExternalStoreRuntime integration
- Chrome Identity auth + typed background messaging
- Local-first persistence with Dexie + session storage + extension config storage

## Environment

Create `apps/extension/.env` from `.env.example`:

- `WXT_API_BASE_URL` (e.g. `http://localhost:4111`)
- `WXT_GOOGLE_CLIENT_ID`
- `WXT_EXTENSION_KEY` (optional but recommended for stable extension id)

## Development

From the repo root:

```bash
pnpm install
pnpm --filter @app/extension dev
```

Then load the generated extension build in Chrome (Developer Mode).

## Scripts

```bash
pnpm --filter @app/extension typecheck
pnpm --filter @app/extension lint
pnpm --filter @app/extension test
pnpm --filter @app/extension build
```
