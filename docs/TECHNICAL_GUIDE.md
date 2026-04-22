# ASP Form-Filling Assistant — Technical Guide

A guide for developers and technical contributors working with the ASP Form-Filling Assistant. This covers architecture, configuration, extending the application, and troubleshooting.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Authentication](#authentication)
- [Browser Automation](#browser-automation)
- [AI Tools](#ai-tools)
- [Database & Schema](#database--schema)
- [Shared Links & Redis](#shared-links--redis)
- [Feature Flags](#feature-flags)
- [Adding a New AI Tool](#adding-a-new-ai-tool)
- [Adding a New Authentication Provider](#adding-a-new-authentication-provider)
- [Rate Limiting](#rate-limiting)
- [Environment Variables Reference](#environment-variables-reference)
- [Troubleshooting](#troubleshooting)

---

## Architecture Overview

The application is a Next.js App Router application that connects users to an AI agent capable of filling out benefit application forms via browser automation.

```
User (Browser)
  |
  v
Next.js App (App Router)
  |
  +-- Auth (NextAuth / Auth.js)
  |     Google OAuth, Microsoft Entra ID, Credentials
  |
  +-- AI Agent (Vercel AI SDK)
  |     Anthropic Claude (via Vertex AI)
  |
  +-- Browser Automation (Kernel.sh)
  |     Remote Chromium, Playwright-based agent-browser
  |
  +-- Client Database Integration (via API)
  |     Participant data retrieval for form filling
  |
  +-- Database (Neon Serverless Postgres / Drizzle ORM)
  |     Users, Chats, Messages, Votes
  |
  +-- Shared Links (Upstash Redis)
        AES-256-GCM encrypted, TTL-based expiration
```

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | [Next.js](https://nextjs.org) (App Router) |
| AI SDK | [Vercel AI SDK](https://sdk.vercel.ai/docs) |
| UI Components | [shadcn/ui](https://ui.shadcn.com) + [Radix UI](https://radix-ui.com) |
| Styling | [Tailwind CSS](https://tailwindcss.com) |
| Authentication | [Auth.js](https://authjs.dev) (NextAuth v5) |
| Database | [Neon](https://neon.tech) Serverless Postgres |
| ORM | [Drizzle ORM](https://orm.drizzle.team) |
| Cache / Links | [Upstash Redis](https://upstash.com) |
| Browser Automation | [Kernel.sh](https://onkernel.com) + [agent-browser](https://www.npmjs.com/package/agent-browser) |
| Package Manager | pnpm |

---

## Project Structure

```
client/
  app/                    # Next.js App Router pages and API routes
    (auth)/               # Login and registration pages
    (chat)/               # Chat interface pages
    api/                  # API routes (chat, browser, links, etc.)
  components/             # React components (UI, chat, browser view)
  lib/
    ai/                   # AI model configuration and tools
      tools/              # AI tool definitions (browser, client data, gap analysis)
    db/                   # Database schema and queries (Drizzle)
    kernel/               # Kernel.sh browser session management
    models/               # External API clients (client database)
  public/                 # Static assets
  docs/                   # Documentation (you are here)
```

---

## Authentication

Authentication is managed by [Auth.js](https://authjs.dev) with three providers:

### Google OAuth

Requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Configure the OAuth consent screen in Google Cloud Console with the callback URL:

```
https://your-domain.com/api/auth/callback/google
```

### Microsoft Entra ID

Requires `AUTH_MICROSOFT_ENTRA_ID_ID`, `AUTH_MICROSOFT_ENTRA_ID_SECRET`, and `AUTH_MICROSOFT_ENTRA_ID_ISSUER`. Register the application in Azure Portal with the callback URL:

```
https://your-domain.com/api/auth/callback/microsoft-entra-id
```

### Credentials

Email/password authentication for users provisioned directly in the database.

### Email Domain Filtering

Set `ALLOWED_EMAIL_DOMAINS` to a comma-separated list of domains to restrict who can sign in:

```env
ALLOWED_EMAIL_DOMAINS=example.com,another.org
```

If unset, all email domains are allowed.

### Guest Login

Set `USE_GUEST_LOGIN=true` to enable a guest sign-in option. This is intended for preview/demo environments only. Guest users receive isolated sessions.

---

## Browser Automation

The browser automation stack is the core of the application and consists of three layers:

### 1. Kernel.sh — Remote Browser Provider

[Kernel.sh](https://onkernel.com) provisions remote Chromium browser instances. The SDK (`@onkernel/sdk`) handles session creation and lifecycle.

**Key file:** `lib/kernel/browser.ts`

- Sessions are cached per-chat to avoid creating duplicate browsers
- A 10-minute idle timeout destroys unused sessions
- Sessions are cleaned up when a chat is deleted

### 2. agent-browser — Playwright Abstraction

The [`agent-browser`](https://www.npmjs.com/package/agent-browser) library wraps Playwright to provide high-level browser commands that the AI agent invokes as tools.

### 3. AI Browser Tool

**Key file:** `lib/ai/tools/browser.ts`

The browser tool exposes these actions to the AI:

| Action | Description |
| --- | --- |
| `navigate` | Go to a URL |
| `snapshot` | Get accessibility tree of current page |
| `click` | Click an element by CSS selector or ref |
| `fill` | Fill a text field programmatically |
| `type` | Type text character-by-character (for masked inputs like SSN, dates) |
| `select` | Choose a dropdown option |
| `check` / `uncheck` | Toggle checkboxes |
| `press` | Press a keyboard key |
| `hover` | Hover over an element |
| `scroll` | Scroll the page |
| `screenshot` | Capture a screenshot |
| `back` / `forward` | Browser history navigation |
| `getByLabel` | Fill a field by its accessible label |

### Live Streaming

Browser activity streams to the user in real time via Kernel's embedded live view.

### Configuration

```env
KERNEL_API_KEY=your-kernel-api-key
```

---

## AI Tools

The web automation agent has access to several tools beyond browser control:

| Tool | Purpose |
| --- | --- |
| `browser` | Remote browser automation (see above) |
| `getUser` | Get a user record from the external database by user ID |
| `listUsers` | Fetch all users from the external database |
| `gapAnalysis` | Analyze form fields against available data to identify missing information |
| `formSummary` | Summarize form requirements |
| `actionLabel` | Label and categorize browser actions |
| `loadSkill` / `readSkillFile` | Load reusable automation skills |

The client database integration pulls participant data (names, addresses, SSNs, dates of birth, etc.) via API that the agent uses to fill form fields automatically.

---

## Database & Schema

The database uses Neon Serverless Postgres with Drizzle ORM for schema management and queries.

### Tables

| Table | Purpose | Key Columns |
| --- | --- | --- |
| `User` | User accounts | email, name, image |
| `Chat` | Chat sessions | title, userId, visibility |
| `Message_v2` | Chat messages | chatId, role, parts (multi-part content) |
| `Vote` | Message feedback | messageId, chatId, isUpvoted |

### Migrations

```bash
# Generate a migration after changing schema files
pnpm drizzle-kit generate

# Apply pending migrations
pnpm drizzle-kit migrate
```

Schema definitions live in `lib/db/schema.ts`. Query functions are in `lib/db/queries.ts`.

---

## Shared Links & Redis

Shared links allow users to send pre-populated session content to others.

### How it works

1. Content is serialized to JSON
2. Encrypted with AES-256-GCM using a key derived from `AUTH_SECRET`
3. Stored in Upstash Redis with a TTL (time-to-live)
4. A short 8-character token is generated as the link ID
5. Recipients access `/link/[token]`, which decrypts and loads the content

### Configuration

```env
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
```

**Key files:**
- `app/api/link/route.ts` — Link creation endpoint
- `app/link/[token]/route.ts` — Link resolution route

---

## Feature Flags

| Flag | Default | Description |
| --- | --- | --- |
| `USE_GUEST_LOGIN` | `false` | Enables guest login for preview environments |
| `ENVIRONMENT` | — | Set to `dev`, `prod`, or `preview-*` to control feature visibility |

---

## Adding a New AI Tool

To give the AI agent a new capability:

1. Create a tool file in `lib/ai/tools/`:

```typescript
// lib/ai/tools/my-tool.ts
import { tool } from "ai";
import { z } from "zod";

export const myTool = tool({
  description: "Describe what this tool does",
  parameters: z.object({
    input: z.string().describe("What the input represents"),
  }),
  execute: async ({ input }) => {
    // Tool logic here
    return { result: "..." };
  },
});
```

2. Register the tool in the appropriate model's tool configuration (see `lib/ai/tools/` for existing patterns).

---

## Adding a New Authentication Provider

1. Install the provider package if needed
2. Add the provider to the Auth.js configuration in `app/(auth)/auth.ts`
3. Set the required environment variables
4. Add the callback URL to the provider's developer console:
   ```
   https://your-domain.com/api/auth/callback/[provider-id]
   ```
5. Update the login page UI in `app/(auth)/login/page.tsx`

---

## Rate Limiting

Rate limits are enforced per user, per entitlement tier:

- Default: **100 messages per day**
- Tracked in the database
- Rate limit errors return a clear message to the user

To adjust limits, modify the entitlement configuration in `lib/ai/entitlements.ts`.

---

## Environment Variables Reference

### Required

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | NextAuth session encryption secret |

### Authentication

| Variable | Description |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `AUTH_MICROSOFT_ENTRA_ID_ID` | Microsoft Entra ID app ID |
| `AUTH_MICROSOFT_ENTRA_ID_SECRET` | Microsoft Entra ID app secret |
| `AUTH_MICROSOFT_ENTRA_ID_ISSUER` | Microsoft Entra ID issuer URL |
| `ALLOWED_EMAIL_DOMAINS` | Comma-separated allowed email domains |

### AI & Automation

| Variable | Description |
| --- | --- |
| `GOOGLE_VERTEX_PROJECT` | GCP project for Vertex AI |
| `GOOGLE_VERTEX_LOCATION` | GCP region for Vertex AI |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to GCP service account JSON |
| `KERNEL_API_KEY` | Kernel.sh API key for browser automation |

### Storage & Services

| Variable | Description |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis URL for shared links |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis auth token |

### Optional

| Variable | Description |
| --- | --- |
| `OPENAI_API_KEY` | OpenAI API key (if using OpenAI models) |
| `ANTHROPIC_API_KEY` | Anthropic API key (if using direct API) |
| `ENVIRONMENT` | `dev`, `prod`, or `preview-*` |
| `USE_GUEST_LOGIN` | Enable guest login for previews |

See [`.env.example`](../.env.example) for the full list.

---

## Troubleshooting

### "Rate limit exceeded" error

The user has exceeded their daily message limit (default 100). This resets daily. To adjust, modify entitlements in `lib/ai/entitlements.ts`.

### Browser automation not working

1. Verify `KERNEL_API_KEY` is set and valid
3. Check server logs for Kernel session creation errors

### Authentication failures

1. Verify OAuth callback URLs match your deployment domain exactly
2. Check that the user's email domain is in `ALLOWED_EMAIL_DOMAINS` (if set)
3. Confirm client ID and secret are correct for the provider
4. For Microsoft Entra ID, verify the issuer URL matches your tenant

### Database connection errors

1. Verify `DATABASE_URL` is correct and the database is accessible
2. Run `pnpm drizzle-kit migrate` to apply any pending migrations
3. For Neon, ensure the database hasn't been suspended due to inactivity

### Shared links not working

1. Verify `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set
2. Check that `AUTH_SECRET` is consistent across deployments (it's used for encryption)
3. Links expire — the recipient may need a fresh link
