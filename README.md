# Chatbot UI

Next.js chat UI built around the Vercel AI SDK client state, currently running in UI-only mode.

## Current Mode

- Chat streaming is served by a local AI SDK-compatible stub in `/api/chat`.
- Chat history, votes, persisted messages, artifact persistence, suggestions, uploads, and model listing are not implemented in this UI layer.
- Authentication shell is handled with Auth.js / NextAuth and Microsoft Entra ID. Chat routes stay open while `AUTH_REQUIRED=false`; set `AUTH_REQUIRED=true` when login should be enforced.
- PostgreSQL, Drizzle, Redis, Vercel Blob, Vercel BotID, Vercel OTel, and Vercel AI Gateway are not part of the active app runtime.

## Running Locally

```bash
pnpm install
pnpm dev
```

The app runs on [localhost:3000](http://localhost:3000) by default.

## Backend Integration

When the production backend contract is ready, wire `/api/chat` to the backend streaming endpoint and add explicit frontend fetch clients for the backend-owned resources:

- chat list/history
- persisted messages
- feedback/votes
- artifact documents and suggestions
- uploads/attachments
