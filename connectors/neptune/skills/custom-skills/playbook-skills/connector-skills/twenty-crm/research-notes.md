# Twenty CRM — Master Research Dossier

**Phase:** 27 | **Date:** 2026-06-17 | **Version:** v1.0  
**Universal Integration Mastery Protocol** (memory 6a1e2ddb)  
**NMI Vault Sacred** (memory 6a1f118b)

---

## 1. NEWLEAF INSTALLATION (Live VPS — 2 Weeks Healthy)

### 1.1 Docker Stack

| Container | Image | Ports | Status | Deployed |
|---|---|---|---|---|
| `twenty-newleaf-server` | `twentycrm/twenty:latest` | 3002→3000 | Healthy (2w) | 2026-06-02 |
| `twenty-newleaf-worker` | `twentycrm/twenty:latest` | — | Up (2w) | 2026-06-02 |
| `twenty-newleaf-db` | `postgres:16` | 5434→5432 | Healthy (2w) | 2026-06-02 |
| `twenty-newleaf-redis` | `redis:7-alpine` | 6382→6379 | Healthy (2w) | 2026-06-02 |

**Image Digest:** `sha256:fd6faa713fd2042d5d87e5705d47d24e492fc5202e7394e188f438085b483fad`  
**Image Created:** 2026-05-27T09:07:37 UTC  
**GitHub Latest:** `twenty/v2.14.0` (2026-06-15)  

### 1.2 Docker Compose

**Location:** `/home/hermes/services/twenty-self-host/docker-compose.newleaf.yml`  
**Stack name:** `twenty-newleaf`  
**Network:** `twenty-newleaf_default`  

Server runs `node dist/main` on port 3000. Worker runs `yarn worker:prod`. PostgreSQL database is `twenty` with user `twenty`. Redis uses AOF persistence + `noeviction` memory policy.

### 1.3 Environment Configuration

| Variable | Description |
|---|---|
| `SERVER_URL` | `https://crm.newleaf.financial` |
| `FRONT_BASE_URL` | `https://crm.newleaf.financial` |
| `IS_SIGN_UP_ENABLED` | `false` (invite-only) |
| `IS_MULTIWORKSPACE_ENABLED` | `false` (single workspace) |
| `AUTH_PASSWORD_ENABLED` | `true` (email/password auth) |
| `STORAGE_TYPE` | `local` (files at `/home/hermes/data/twenty/storage`) |
| `DISABLE_DB_MIGRATIONS` | empty on server, `"true"` on worker |
| `DISABLE_CRON_JOBS_REGISTRATION` | empty on server, `"true"` on worker |
| `EMAIL_DRIVER` | `logger` (emails logged, not sent) |

### 1.4 Nginx Configuration

**Domain:** `crm.newleaf.financial`  
**SSL:** Let's Encrypt via Certbot (auto-renewed)  
**Redirect:** `crm.newleaf.financial/` → 301 → `https://app.crm.newleaf.financial/welcome`  
**Proxy:** All requests → `localhost:3002` with WebSocket upgrade support  
**Timeout:** `proxy_read_timeout 86400` (24h — supports long-lived connections)

### 1.5 Health Status

Health check endpoint at `/healthz` returns `{"status":"ok"}` every 5 seconds. All containers pass health checks consistently.

---

## 2. TWENTY CRM PLATFORM OVERVIEW

### 2.1 Identity

- **Project:** Twenty — "The #1 Open-Source CRM"
- **GitHub:** `github.com/twentyhq/twenty` — 50.2k stars
- **License:** AGPL (verified from GitHub)
- **Latest Release:** v2.14.0 (2026-06-15)
- **Positioning:** "Open alternative to Salesforce, designed for AI"

### 2.2 Architecture

| Layer | Technology |
|---|---|
| **Language** | TypeScript (78.8% of codebase) |
| **Monorepo** | Nx |
| **Backend** | NestJS |
| **Job Queue** | BullMQ (Redis-backed) |
| **Primary DB** | PostgreSQL 16 |
| **Cache/Queue** | Redis 7 |
| **Frontend** | React |
| **State Mgmt** | Jotai |
| **CSS** | Linaria (CSS-in-JS) |
| **I18n** | Lingui |
| **API** | Auto-generated REST + GraphQL per workspace schema |

### 2.3 Core Concepts

1. **Objects** — Custom record types defined via `defineObject()` (tables with fields)
2. **Fields** — 27 types from TEXT to RELATION to RICH_TEXT
3. **Relations** — Bidirectional ONE_TO_MANY / MANY_TO_ONE patterns
4. **Views** — Table, Kanban, Calendar, with filters, sorting, grouping
5. **Layouts** — Record pages, side panels, widgets, tabs
6. **Workflows** — Visual workflow builder with 7 triggers + 11 action types
7. **Apps** — Extensions via `npx create-twenty-app` (data + layout + logic)
8. **AI** — AI Agents, AI Chatbot, AI-powered workflows (agents "Coming Soon" in workflows)

---

## 3. DEFINE OBJECT API (Programmatic Schema)

### 3.1 `defineObject()` — Create Custom Objects

**Import:** `import { defineObject, FieldType } from 'twenty-sdk/define';`

**Top-Level Parameters:**

| Parameter | Required | Description |
|---|---|---|
| `universalIdentifier` | Yes | Stable UUID — unique across deployments |
| `nameSingular` | Yes | CamelCase singular (`'subscription'`) |
| `namePlural` | Yes | CamelCase plural (`'subscriptions'`) |
| `labelSingular` | Yes | Human-readable singular (`'Subscription'`) |
| `labelPlural` | Yes | Human-readable plural (`'Subscriptions'`) |
| `description` | No | Description string |
| `icon` | No | Twenty icon identifier (e.g., `'IconCreditCard'`) |
| `fields` | No | Array of field definitions (optional) |

**Auto-generated base fields:** `id`, `name`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`, `deletedAt` — always created automatically.

### 3.2 Field Definition Parameters

Each field in the `fields` array:

| Parameter | Required | Description |
|---|---|---|
| `universalIdentifier` | Yes | Stable UUID for this field |
| `name` | Yes | CamelCase identifier |
| `type` | Yes | `FieldType` enum value |
| `label` | Yes | Display label |
| `description` | No | Description |
| `icon` | No | Icon identifier |
| `defaultValue` | No | Default value (see quoting rules) |
| `isNullable` | No | Boolean |
| `options` | SELECT only | Array of `{value, label, position, color}` |

**Default Value Quoting:**
- Literal strings: wrapped in single quotes inside the string — `` `'${value}'` ``
- Computed: `'uuid'` (generates UUID), `'now'` (current timestamp)
- `null` for nullable fields

### 3.3 Complete FieldType Enum

```typescript
export enum FieldMetadataType {
  ACTOR = 'ACTOR',               // User/agent reference
  ADDRESS = 'ADDRESS',           // Structured address
  ARRAY = 'ARRAY',               // Array of values
  BOOLEAN = 'BOOLEAN',           // True/false
  CURRENCY = 'CURRENCY',         // Currency amount + code
  DATE = 'DATE',                 // Date only (no time)
  DATE_TIME = 'DATE_TIME',       // Full timestamp
  EMAILS = 'EMAILS',             // Email addresses (primary + additional)
  FILES = 'FILES',               // File attachments
  FULL_NAME = 'FULL_NAME',       // Structured name (firstName, lastName)
  LINKS = 'LINKS',               // URL links (primary + additional)
  MORPH_RELATION = 'MORPH_RELATION', // Polymorphic relation
  MULTI_SELECT = 'MULTI_SELECT', // Multi-value select
  NUMBER = 'NUMBER',             // Integer or float
  NUMERIC = 'NUMERIC',           // High-precision numeric
  PHONES = 'PHONES',             // Phone numbers (primary + additional)
  POSITION = 'POSITION',         // Sort/order position
  RATING = 'RATING',             // Star/numeric rating
  RAW_JSON = 'RAW_JSON',         // Arbitrary JSON
  RELATION = 'RELATION',         // Object relation (FK)
  RICH_TEXT = 'RICH_TEXT',       // Formatted text (HTML/Markdown)
  SELECT = 'SELECT',             // Single-select dropdown
  TEXT = 'TEXT',                 // Plain text
  TS_VECTOR = 'TS_VECTOR',       // Full-text search vector
  UUID = 'UUID',                 // UUID value
}
```

**27 field types total.**

### 3.4 SELECT Field Options

```typescript
{
  type: FieldType.SELECT,
  options: [
    { value: 'ACTIVE', label: 'Active', position: 0, color: 'green' },
    { value: 'PAUSED', label: 'Paused', position: 1, color: 'orange' },
    { value: 'CANCELLED', label: 'Cancelled', position: 2, color: 'red' },
  ]
}
```

### 3.5 `defineField()` — Extend Existing Objects

**Import:** `import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';`

Adds fields to objects you don't own (built-in `Person`, `Company`, or another app's objects). Requires explicit `objectUniversalIdentifier`:

```typescript
export default defineField({
  universalIdentifier: 'uuid-here',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  name: 'enrollmentStatus',
  type: FieldType.SELECT,
  label: 'Enrollment Status',
});
```

**Standard Object Identifiers available:** `person`, `company`, `opportunity`, `workspaceMember`, `calendarEvent`, `message`, `task`, `note`, and all custom objects.

### 3.6 Relations — Bidirectional Pattern

**No `defineRelation()` function exists.** Relations use paired `FieldType.RELATION` fields referencing each other:

**MANY_TO_ONE side (holds FK):**
```typescript
{
  type: FieldType.RELATION,
  universalSettings: {
    relationType: 'MANY_TO_ONE',
    joinColumnName: 'personId',
    onDelete: 'CASCADE', // or SET_NULL, RESTRICT, NO_ACTION
  },
  relationTargetObjectMetadataUniversalIdentifier: PERSON_UNIVERSAL_ID,
  relationTargetFieldMetadataUniversalIdentifier: SUBSCRIPTIONS_FIELD_ID,
}
```

**ONE_TO_MANY side (collection):**
```typescript
{
  type: FieldType.RELATION,
  universalSettings: {
    relationType: 'ONE_TO_MANY',
  },
  relationTargetObjectMetadataUniversalIdentifier: SUBSCRIPTION_UNIVERSAL_ID,
  relationTargetFieldMetadataUniversalIdentifier: PERSON_FIELD_ID,
}
```

Key: Both sides reference each other's `universalIdentifier`. Export field IDs as named constants to handle circular imports.

---

## 4. FRONT COMPONENTS (UI Extensions)

### 4.1 `defineFrontComponent()` — React in Twenty UI

**Import:** `import { defineFrontComponent } from 'twenty-sdk/define';`

**Sandbox Model:** Components run in an **isolated Web Worker** using **Remote DOM** — code is sandboxed but renders natively in the page (NOT an iframe).

**Configuration:**
| Parameter | Required | Description |
|---|---|---|
| `universalIdentifier` | Yes | Stable UUID |
| `component` | Yes | React component function (default export) |
| `name` | No | Display name |
| `description` | No | Description |
| `isHeadless` | No | Boolean — `true` = invisible background execution |

**Rendering Surfaces:**
1. **Side panel** — Default for non-headless components (triggered from command menu)
2. **Widgets** — Embedded in dashboards and record detail pages via page layouts

### 4.2 Host Communication API

**Import from `twenty-sdk/front-component`:**

| Function | Purpose |
|---|---|
| `navigate(to, params?, queryParams?, options?)` | Navigate to any app page |
| `openSidePanelPage(params)` | Open side panel |
| `closeSidePanel()` | Close side panel |
| `openCommandConfirmationModal(params)` | Confirmation dialog |
| `enqueueSnackbar(params)` | Toast notification |
| `unmountFrontComponent()` | Unmount this component |
| `updateProgress(progress)` | Progress indicator update |

### 4.3 Context Hooks

| Hook | Returns |
|---|---|
| `useUserId()` | `string \| null` — current user |
| `useSelectedRecordIds()` | `string[]` — selected records |
| `useRecordId()` | `string \| null` — DEPRECATED |
| `useFrontComponentId()` | `string` — component instance ID |
| `useColorScheme()` | `'light' \| 'dark'` |

### 4.4 API Clients in Front Components

| Client | Import | Purpose |
|---|---|---|
| `RestApiClient` | `twenty-client-sdk/rest` | HTTP calls to logic functions |
| `CoreApiClient` | `twenty-sdk/clients` | GraphQL queries/mutations (workspace data) |
| `MetadataApiClient` | (sibling of CoreApiClient) | Schema management + file uploads |

### 4.5 Environment Variables

- `TWENTY_API_URL` — Base API URL (auto-injected)
- `TWENTY_APP_ACCESS_TOKEN` — Short-lived, role-scoped token (auto-injected)
- `process.env` variables from `defineApplicationVariable` (non-secret only)

**Secret variables (`isSecret: true`) are NEVER exposed to front components.** They only exist in logic functions.

### 4.6 SDK UI Components

**Import from `twenty-sdk/ui`:** `Button`, `Tag`, `Status`, `Chip`, `Avatar`, and more.

### 4.7 CSS / Styling

All major styling approaches supported: inline styles, Emotion, styled-components, Tailwind CSS utility classes, any CSS-in-JS. Remote DOM handles stylesheet bridging.

### 4.8 Command Components (Headless)

**Import from `twenty-sdk/command`:**
- `Command` — Runs async callback on mount, then unmounts
- `CommandLink` — Navigates to app path
- `CommandModal` — Confirmation modal with execute callback
- `CommandOpenSidePanelPage` — Opens side panel page

---

## 5. LOGIC FUNCTIONS (Server-Side TypeScript)

### 5.1 `defineLogicFunction()`

**Import:** `import { defineLogicFunction } from 'twenty-sdk/define';`

Server-side TypeScript functions with five trigger types:

| Trigger | Use Case |
|---|---|
| `httpRouteTriggerSettings` | HTTP endpoint at `/s/<path>` |
| `cronTriggerSettings` | Scheduled execution (cron expression) |
| `databaseEventTriggerSettings` | Record lifecycle events (`person.updated`, etc.) |
| `toolTriggerSettings` | AI Agent / MCP tool discovery |
| `workflowActionTriggerSettings` | Visual workflow builder action |

### 5.2 HTTP Route Trigger

```typescript
httpRouteTriggerSettings: {
  path: '/sync-customer',
  httpMethod: 'POST',
  isAuthRequired: true,
  forwardedRequestHeaders: ['content-type', 'x-api-key'],
}
```

**Payload:** AWS HTTP API v2 format — `headers`, `queryStringParameters`, `pathParameters`, `body`, `rawBody`, `requestContext`.

**Response:** `new Response(body, { status, headers })` — only 5 headers allowed: `content-type`, `content-language`, `content-disposition`, `cache-control`, `retry-after`.

### 5.3 Database Event Trigger

```typescript
databaseEventTriggerSettings: {
  eventName: 'person.updated',
  updatedFields: ['emails'], // optional filter
}
```

**Event patterns:** `person.created`, `person.updated`, `person.destroyed`, `*.created`, `company.*`.

**Payload includes:** `before`, `after`, `diff`, `updatedFields` (for updates).

### 5.4 API Clients in Logic Functions

- **CoreApiClient** (`twenty-client-sdk/core`) — Typed GraphQL for workspace data. Auto-generated from schema.
- **MetadataApiClient** (`twenty-client-sdk/metadata`) — Pre-built. Includes `uploadFile(fileBuffer, filename, mimeType, fieldUniversalIdentifier)`.

**Credentials auto-injected** from `process.env.TWENTY_API_URL` and `TWENTY_APP_ACCESS_TOKEN`.

---

## 6. API SURFACE (REST + GraphQL)

### 6.1 Schema-Per-Tenant Architecture

Twenty does NOT publish a static API reference. Each workspace generates its own schema dynamically. When you define a custom object, "it immediately gets REST and GraphQL endpoints identical to built-in objects."

Personalized API docs live under **Settings → API & Webhooks**.

### 6.2 Two APIs

| API | Paths | Purpose |
|---|---|---|
| **Core API** | `/rest/` and `/graphql/` | CRUD on workspace records |
| **Metadata API** | `/rest/metadata/` and `/metadata/` | Schema management |

Both exposed as REST AND GraphQL. GraphQL adds batch upserts and relation traversal.

### 6.3 Authentication

**Bearer Token:** `Authorization: Bearer YOUR_API_KEY`

API keys created in **Settings → API & Webhooks → + Create key** (shown once). Keys can be scoped to a specific role.

### 6.4 Rate Limits

| Limit | Value |
|---|---|
| Requests | 100 per minute |
| Batch size | 60 records per call |

### 6.5 Base URLs

- **Cloud:** `https://api.twenty.com/`
- **Self-Hosted:** `https://crm.newleaf.financial/`

---

## 7. OAUTH 2.0

### 7.1 Supported Flows

1. **Authorization Code + PKCE** — User-facing apps (recommended)
2. **Client Credentials** — Server-to-server integrations

### 7.2 Dynamic Client Registration

`POST /oauth/register` — RFC 7591 compliant. Returns `client_id` + `client_secret` (secret shown once).

### 7.3 Scopes

- `api` — Full read/write to Core + Metadata APIs
- `profile` — Read user profile

### 7.4 Token Lifecycle

- Access token: 3600 seconds (1 hour)
- Refresh via `/oauth/token` with `grant_type=refresh_token`
- Authorization endpoint: `/oauth/authorize`
- Token endpoint: `/oauth/token`
- Discovery: `/.well-known/oauth-authorization-server`

### 7.5 PKCE

SHA-256 code challenge method (`S256`), code verifier sent at token exchange.

---

## 8. RBAC (Role-Based Access Control)

### 8.1 Role Definition

Two functions:
- `defineRole()` — General permission set
- `defineApplicationRole()` — App default role (exactly one per app)

### 8.2 Permission Levels

**System-Level Boolean Flags:**
- `canReadAllObjectRecords`
- `canUpdateAllObjectRecords`
- `canSoftDeleteAllObjectRecords`
- `canDestroyAllObjectRecords`
- `canUpdateAllSettings`
- `canBeAssignedToAgents`
- `canBeAssignedToUsers`
- `canBeAssignedToApiKeys`

**Object-Level Permissions** (`objectPermissions` array):
Per-object: `canReadObjectRecords`, `canUpdateObjectRecords`, `canSoftDeleteObjectRecords`, `canDestroyObjectRecords`

**Field-Level Permissions** (`fieldPermissions` array):
Per-field: `canReadFieldValue`, `canUpdateFieldValue`

**Platform Capability Flags** (`permissionFlagUniversalIdentifiers`):
E.g., `SystemPermissionFlag.APPLICATIONS`

### 8.3 Scoping

Three tiers can combine: Global (`canReadAll*`) → Object-scoped (`objectPermissions`) → Field-scoped (`fieldPermissions`).

### 8.4 Default Role (Scaffold)

Grants `canReadAllObjectRecords: true`, all other flags `false`. The docs say: "grant broad read access, which is rarely what you want in production."

---

## 9. WEBHOOKS

### 9.1 Configuration

**UI:** Settings → APIs & Webhooks → Webhooks → + Create webhook  
**API programmatic CRUD:** NOT documented (UI only as of v2.14.0)

### 9.2 Events

All object types (including custom objects). Three event types:
- `record.created` (e.g., `person.created`)
- `record.updated` (e.g., `subscription.updated`)
- `record.deleted` (e.g., `paymentrecord.deleted`)

**Event filtering:** NOT available yet ("may be added in future releases").

### 9.3 Payload

```json
{
  "event": "person.created",
  "data": { /* full record */ },
  "timestamp": "2026-06-17T02:04:00.000Z"
}
```

### 9.4 Security

HMAC SHA256 signing. Headers:
- `X-Twenty-Webhook-Signature` — hex-encoded HMAC
- `X-Twenty-Webhook-Timestamp` — request timestamp

Verification: `HMAC_SHA256(secret, timestamp:JSON_payload)` compared with constant-time equality.

### 9.5 Delivery

Must respond with 2xx to acknowledge. Non-2xx = logged as delivery failure. **Retry policy NOT documented** (no counts, intervals, or guarantees specified).

---

## 10. WORKFLOW ENGINE

### 10.1 Triggers (7 Types)

| Trigger | Code | Config |
|---|---|---|
| Record Created | `record.created` | Object type |
| Record Updated | `record.updated` | Object + optional field filter |
| Record Created/Updated | combo | Object + optional field filter |
| Record Deleted | `record.deleted` | Object type |
| Manual | manual | Global / Single / Bulk modes |
| Scheduled | cron | Minutes/hours/days or cron expression (UTC) |
| Webhook Inbound | webhook | Auto-generated URL, body schema definition |

### 10.2 Actions (11 Types)

| Category | Actions |
|---|---|
| **Record** | Create Record, Update Record, Delete Record, Search Records, Upsert Record |
| **Flow** | Iterator, Filter (pass/fail gate), Delay (duration or date) |
| **Communication** | Send Email (single recipient, own mailbox), Form (manual triggers only) |
| **Integration** | Code (custom JavaScript), HTTP Request (GET/POST/PUT/PATCH/DELETE) |
| **AI** | AI Agent ("Coming Soon") |

### 10.3 Code Actions

JavaScript with direct API key embedding. Can call external APIs. Runs in workflow execution context.

### 10.4 Credits

Consumed on Delay nodes and AI agent actions. Credit pricing varies by plan.

### 10.5 Key Limitations

- Search Records: max 200 results
- Send Email: single recipient only
- Filter: pass/fail gate only (no data output)
- Form: manual triggers only
- Update Record: no inline search
- Code: API keys must be hardcoded
- Webhook auth: "coming soon"

---

## 11. IFRAME EMBEDDING ANALYSIS

### 11.1 Twenty's Approach

Twenty does NOT support traditional iframe embedding. Instead, it provides **Front Components** which render natively inside Twenty's UI via Web Workers + Remote DOM. This is a more modern, performant, and secure approach than iframes.

### 11.2 If You Must iframe

If embedding Twenty inside another app (e.g., Neptune Command Center):
- **X-Frame-Options:** Not explicitly documented — must test against live deployment
- **CORS:** Twenty uses its own API server; CORS headers likely configured for the server URL
- **postMessage:** Not a documented API. Use Workflow Webhooks for outbound data, REST/GraphQL for inbound
- **Clerk / Auth pass-through:** NOT documented. Twenty manages its own sessions via password auth and OAuth

### 11.3 Clerk JWT Integration Status

Twenty does NOT have built-in Clerk integration. Auth options are:
1. Password auth (enabled on our deployment)
2. SSO (SAML/OIDC via workspace settings)
3. OAuth 2.0 (for API access, not user auth)

For Neptune → Twenty auth pass-through in an iframe scenario, options are:
- **API Keys** — Server-side, workspace-scoped
- **OAuth 2.0 Client Credentials** — Server-to-server
- **Extension Auth Tokens** — `TWENTY_APP_ACCESS_TOKEN` auto-injected for apps

### 11.4 Best Integration Pattern for Neptune

Given Twenty's architecture, the recommended approach is:
1. **Neptune Chat** (our app) as a Twenty App extension
2. Front Components render inside Twenty's UI (not iframe)
3. Logic Functions handle server-side operations
4. Neptune Chat communicates via `RestApiClient` for operations, `CoreApiClient` for data
5. Webhooks notify Neptune of record changes

**Alternative (if iframe is required):**
1. Embed Twenty in Neptune Command Center via iframe
2. Use API Keys for Neptune → Twenty data operations
3. Use Webhooks for Twenty → Neptune event notifications
4. Test X-Frame-Options behavior on self-hosted deployment

---

## 12. DATA MIGRATION CAPABILITIES

### 12.1 Built-in Import

- CSV import for Companies, Contacts, Opportunities
- Field mapping UI
- Uniqueness constraints (email for People, domain for Companies)
- Update existing records via import
- Import relations between objects via CSV
- API-based import (REST/GraphQL)

### 12.2 Export

Export data from any object view to CSV from the UI.

### 12.3 API Migration Strategy

For programmatic migration (our use case):
- Use Core API GraphQL `CreatePerson` / `CreateCompanies` mutations
- Batch upserts up to 60 records per call
- REST endpoints for simple CRUD
- Map `external_id` fields on custom objects for idempotent sync

---

## 13. TWENTY SDK PROJECT STRUCTURE

### 13.1 App Scaffolding

```bash
npx create-twenty-app my-app
```

Creates a TypeScript project with:
```
src/
  objects/        # defineObject() files
  fields/         # defineField() files
  front-components/  # defineFrontComponent() files
  logic-functions/   # defineLogicFunction() files
  config/
    application.ts    # defineApplication()
    roles.ts          # defineRole() / defineApplicationRole()
    install-hooks.ts  # definePreInstall / definePostInstall
```

### 13.2 Dev Commands

```bash
yarn twenty dev          # Start local dev server
yarn twenty dev:build    # Build SDK clients from workspace schema
yarn twenty dev:add object  # Interactive object scaffolding
yarn twenty dev:function:exec -n <name> -p <payload>  # Run function
yarn twenty dev:function:logs  # View function logs
yarn twenty app:publish  # Deploy app to workspace
```

### 13.3 Publishing

`npx twenty app:publish` deploys the extension to the target workspace. Twenty auto-migrates PostgreSQL, auto-generates GraphQL + REST endpoints, and auto-applies RBAC.

---

## 14. NEWLEAF-SPECIFIC NOTES

### 14.1 Sacred Boundaries

| Boundary | Rule |
|---|---|
| **NMI Vault** (memory 6a1f118b) | Card data NEVER enters Twenty. PANs, CVVs stay in NMI only |
| **Card Numbers** | Only last4 stored anywhere outside NMI |
| **Subscription State** | NMI is source of truth; Twenty mirrors for display |
| **Auth** | All API access must be authenticated (no bypass) |

### 14.2 Current State

- ✅ Twenty deployed, stable, healthy (2 weeks)
- ✅ Domain `crm.newleaf.financial` live with SSL
- ⚠️ NO custom objects defined
- ⚠️ NO NewLeaf data in Twenty
- ⚠️ NO Neptune integration
- ⚠️ NO API keys created
- ⚠️ Sign-up disabled (invite-only workspace)

### 14.3 Next Steps (Post Phase 27)

1. **Phase 28:** Neptune Command Center UI (iframe harness)
2. **Phase 29:** Full Base44 → Twenty migration
3. **Phase 30:** Linear bidirectional sync via n8n
4. **Phase 31:** Generative CRM actions live
5. **Phase 32:** Sales agent optimized UI polish

---

## APPENDIX A: QUICK REFERENCE

### defineObject() Example

```typescript
import { defineObject, FieldType } from 'twenty-sdk/define';

export default defineObject({
  universalIdentifier: 'b9c8d7e6-f5a4-4321-0987-654321abcdef',
  nameSingular: 'subscription',
  namePlural: 'subscriptions',
  labelSingular: 'Subscription',
  labelPlural: 'Subscriptions',
  description: 'A customer billing subscription',
  icon: 'IconCreditCard',
  fields: [
    {
      universalIdentifier: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      name: 'nmiSubscriptionId',
      type: FieldType.TEXT,
      label: 'NMI Subscription ID',
    },
    {
      universalIdentifier: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      name: 'paymentAmount',
      type: FieldType.CURRENCY,
      label: 'Payment Amount',
    },
    {
      universalIdentifier: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
      name: 'billingStatus',
      type: FieldType.SELECT,
      label: 'Billing Status',
      options: [
        { value: 'ACTIVE', label: 'Active', position: 0, color: 'green' },
        { value: 'PAST_DUE', label: 'Past Due', position: 1, color: 'red' },
        { value: 'CANCELLED', label: 'Cancelled', position: 2, color: 'gray' },
      ],
    },
  ],
});
```

### Key URLs

| Resource | URL |
|---|---|
| Docs Index | `https://docs.twenty.com/llms.txt` |
| OpenAPI Spec | `https://docs.twenty.com/api-reference/openapi.json` |
| GitHub | `https://github.com/twentyhq/twenty` |
| NewLeaf CRM | `https://crm.newleaf.financial` |
| NewLeaf App CRM | `https://app.crm.newleaf.financial` |

---

**Research completed:** 2026-06-17 02:04 UTC  
**Budget consumed:** ~750t of 800t allocated  
**Protocol:** Universal Integration Mastery Protocol v1.0 (memory 6a1e2ddb)  
**Status:** ✅ Complete — ready for Stream 1 (Data Model)
