<p align="center">
  <img alt="Nava PBC" src="public/images/logo.png" width="200">
</p>

<h1 align="center">ASP Form-Filling Assistant</h1>

<p align="center">
  An AI-powered chatbot that helps users complete forms through intelligent conversation and browser automation.
</p>

<p align="center">
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#architecture"><strong>Architecture</strong></a> ·
  <a href="#getting-started"><strong>Getting Started</strong></a> ·
  <a href="#connecting-to-neon-database"><strong>Database Setup</strong></a> ·
  <a href="#connecting-to-an-external-api"><strong>API Integration</strong></a> ·
  <a href="#browser-automation-with-kernel"><strong>Kernel</strong></a>
</p>

---

## Features

- **[Next.js](https://nextjs.org) App Router** — Server components, server actions, and advanced routing
- **[AI SDK](https://sdk.vercel.ai/docs)** — Unified API for generating text, structured objects, and tool calls with LLMs
- **Multi-Model Support** — OpenAI, Anthropic, Google, and xAI model providers
- **Browser Automation** — AI-driven form filling via remote browser control
- **[shadcn/ui](https://ui.shadcn.com)** — Accessible component primitives from [Radix UI](https://radix-ui.com) styled with [Tailwind CSS](https://tailwindcss.com)
- **[Auth.js](https://authjs.dev)** — Authentication with Google OAuth, Microsoft Entra ID, and credentials
- **[Neon Serverless Postgres](https://neon.tech)** — Chat history, user data, and document persistence via [Drizzle ORM](https://orm.drizzle.team)
- **Shared Links** — Share chat sessions publicly via [Upstash Redis](https://upstash.com)-backed tokens

## Architecture

```
+-----------------------------------------------------------+
|                         Client                            |
|                      (Next.js App)                        |
|                                                           |
|  +--------------+  +--------------+  +----------------+  |
|  | Landing      |  | Auth         |  | Chat           |  |
|  | Page         |  | (Login/      |  | Interface      |  |
|  |              |  |  Register)   |  | & Documents    |  |
|  +--------------+  +--------------+  +-------+--------+  |
|                                              |            |
|  +-------------------------------------------+--------+  |
|  |              API Routes (Next.js)                   |  |
|  |  /api/chat  /api/link  /api/browser-stream  ...     |  |
|  +------+-----------+--------------+-------------------+  |
|         |           |              |                      |
+---------+-----------+--------------+----------------------+
          |           |              |
   +------+---+ +-----+----+ +------+------+
   | AI       | | Neon     | | External    |
   | Providers| | Postgres | | APIs        |
   | (LLMs)   | | (DB)     | |             |
   +-----+----+ +----------+ +------+------+
         |                           |
   +-----+--------+          +------+------+
   | Browser      |          | Upstash     |
   | Automation   |          | Redis       |
   | (Kernel.sh / |          | (Shared     |
   |  Mastra)     |          |  Links)     |
   +--------- ----+          +-------------+
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) 18+
- [pnpm](https://pnpm.io) package manager
- A [Neon](https://neon.tech) database (or any PostgreSQL instance)

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env.local
```

See the sections below for details on [database](#connecting-to-neon-database) and [API](#connecting-to-an-external-api) configuration.

### 3. Run database migrations

```bash
pnpm drizzle-kit migrate
```

### 4. Start the development server

```bash
pnpm dev
```

The app will be running at [localhost:3000](http://localhost:3000).

---

## Connecting to Neon Database

This application uses [Neon](https://neon.tech) serverless Postgres as its primary database, managed through [Drizzle ORM](https://orm.drizzle.team).

### Setting up a Neon database

1. Create a free account at [neon.tech](https://neon.tech)
2. Create a new project and note your connection string
3. In your `.env.local`, set the `DATABASE_URL`:

```env
DATABASE_URL="postgresql://<user>:<password>@<host>.neon.tech/<dbname>?sslmode=require"
```

### Running migrations

Drizzle handles schema migrations. After setting your `DATABASE_URL`:

```bash
# Generate a new migration after schema changes
pnpm drizzle-kit generate

# Apply pending migrations
pnpm drizzle-kit migrate
```

### Database schema overview

The database stores the following entities:

| Table | Purpose |
|-------|---------|
| `User` | User accounts (email, name, image) |
| `Chat` | Chat sessions (title, owner, visibility) |
| `Message_v2` | Chat messages with multi-part content |
| `Document` | Artifacts (code, text, images, sheets) |
| `Vote` | User feedback on messages |
| `Suggestion` | Suggested edits for documents |

---

## Connecting to an External API

The application supports integrating with external APIs to extend its capabilities (e.g., form services, document management systems, or other backend services). Below is the general pattern for adding a new API integration.

### 1. Add environment variables

Define the API credentials in your `.env.local`:

```env
# External API configuration
MY_API_BASE_URL=https://api.example.com
MY_API_CLIENT_ID=your-client-id
MY_API_CLIENT_SECRET=your-client-secret
```

And add matching entries in `.env.example` for documentation:

```env
MY_API_BASE_URL=https://api.example.com
MY_API_CLIENT_ID=****
MY_API_CLIENT_SECRET=****
```

### 2. Create an API client module

Add a new file under `lib/models/` for your API integration:

```typescript
// lib/models/my-api.ts

const BASE_URL = process.env.MY_API_BASE_URL;
const CLIENT_ID = process.env.MY_API_CLIENT_ID;
const CLIENT_SECRET = process.env.MY_API_CLIENT_SECRET;

async function getAccessToken(): Promise<string> {
  const response = await fetch(`${BASE_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "client_credentials",
    }),
  });

  const data = await response.json();
  return data.access_token;
}

export async function fetchResource(resourceId: string) {
  const token = await getAccessToken();

  const response = await fetch(`${BASE_URL}/resources/${resourceId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json();
}
```

### 3. Expose as an AI tool (optional)

If you want the AI assistant to be able to call your API during conversations, register it as a tool in `lib/ai/tools/`:

```typescript
// lib/ai/tools/my-api-tool.ts
import { tool } from "ai";
import { z } from "zod";
import { fetchResource } from "@/lib/models/my-api";

export const myApiTool = tool({
  description: "Fetch a resource from the external service",
  parameters: z.object({
    resourceId: z.string().describe("The ID of the resource to fetch"),
  }),
  execute: async ({ resourceId }) => {
    const result = await fetchResource(resourceId);
    return result;
  },
});
```

### 4. Use in API routes

You can also call your API directly from Next.js API routes or server actions:

```typescript
// app/api/my-resource/route.ts
import { fetchResource } from "@/lib/models/my-api";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  const data = await fetchResource(id);
  return Response.json(data);
}
```

---

## Browser Automation with Kernel

[Kernel.sh](https://onkernel.com) provides remote browser instances that power the application's web automation features. When a user selects the web automation model, the AI agent can control a cloud-hosted Chromium browser to navigate websites, fill out forms, click buttons, and more.

### How it works

1. **Session creation** — When a user starts a web automation chat, the app requests a remote browser from Kernel via the `@onkernel/sdk`
2. **Browser control** — The AI agent sends commands (navigate, click, fill, type, screenshot, etc.) through the [`agent-browser`](https://www.npmjs.com/package/agent-browser) library, which uses Playwright under the hood
3. **Live streaming** — Users can watch the browser in real-time via a WebSocket stream proxied through the `/api/browser-stream-proxy` route
4. **Session replay** — Kernel records browser sessions for debugging and auditing
5. **Cleanup** — Sessions are automatically destroyed when no longer needed, with a 10-minute idle timeout as a safety net

### Architecture

```
+----------------+    commands     +----------------+    CDP/WS     +----------------+
| AI Agent       | -------------> | agent-browser  | -----------> | Kernel.sh      |
| (LLM +        |                 | (Playwright)   |              | (Remote        |
|  browser       | <------------- |                | <----------- |  Chromium)     |
|  tool)         |    snapshots    +----------------+  page state  +-------+--------+
+----------------+                                                        |
                                                                          | stream
                                                                          v
                                                                 +----------------+
                                                                 | User's         |
                                                                 | Browser        |
                                                                 | (Live View)    |
                                                                 +----------------+
```

### Configuration

Set the following in your `.env.local`:

```env
# Enable AI SDK agent mode (required for Kernel)
USE_AI_SDK_AGENT=true
NEXT_PUBLIC_USE_AI_SDK_AGENT=true

# Kernel.sh API key — get one at https://onkernel.com
KERNEL_API_KEY=your-kernel-api-key
```

### Key files

| File | Purpose |
|------|---------|
| `lib/kernel/browser.ts` | Session management — create, cache, and destroy remote browsers |
| `lib/ai/tools/browser.ts` | AI tool definition — exposes browser commands to the LLM |
| `app/api/kernel-browser/route.ts` | API route for browser CRUD operations |
| `app/api/browser-stream-proxy/route.ts` | WebSocket proxy for live browser streaming |


---

## Key Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (Neon or local) |
| `AUTH_SECRET` | Yes | NextAuth.js session secret |
| `OPENAI_API_KEY` | Yes | Primary AI model provider |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | For OAuth | Google sign-in credentials |
| `AUTH_MICROSOFT_ENTRA_ID_*` | For OAuth | Microsoft sign-in credentials |
| `ANTHROPIC_API_KEY` | Optional | Anthropic Claude models |
| `XAI_API_KEY` | Optional | xAI Grok models |
| `KERNEL_API_KEY` | For web automation | Kernel.sh remote browser API key |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | For shared links | Redis-backed link sharing |
| `ENVIRONMENT` | Optional | `dev`, `prod`, or `preview-*` |

See [`.env.example`](.env.example) for the full list of configurable variables.
