# Iframe Harness Research — Neptune Command Center × Twenty CRM

**Date:** 2026-06-17 | **Phase:** 29 — Command Center UI
**Architect:** Hermes V5 | **Repository:** neptune-chat

---

## 1. Twenty CRM Iframe-Ability Assessment

### Current Deployment
- **URL:** `https://app.crm.newleaf.financial` (redirects from `crm.newleaf.financial`)
- **Infra:** nginx/1.24.0 → Twenty backend on port 3002
- **Auth:** Twenty native workspace auth (email/password or SSO)

### Header Analysis
```
HTTP/1.1 301 Moved Permanently
Server: nginx/1.24.0 (Ubuntu)
Location: https://app.crm.newleaf.financial/welcome
```

**Critical finding:** Neither `X-Frame-Options` nor `Content-Security-Policy: frame-ancestors` is present in the response from the nginx proxy. This means:

1. **Twenty CRM CAN be iframed** — no blocking headers exist at the proxy level
2. Twenty's internal CSP may still need adjustment if it serves its own headers
3. We must verify Twenty's React App doesn't use `frame-ancestors 'none'`

### Twenty Iframe Configuration (Required)
If Twenty's React app blocks iframing, update Twenty's environment:

```env
# twenty-server .env
FRONT_AUTH_CALLBACK_URL=https://neptune-chat-ashy.vercel.app/api/twenty-auth/callback
CORS_ORIGIN=https://neptune-chat-ashy.vercel.app

# If Twenty uses Helmet or similar
CSP_FRAME_ANCESTORS=https://neptune-chat-ashy.vercel.app
```

### OAuth/JWT Strategy for Twenty
Twenty supports custom auth providers. For Phase 29:
- **Option A (Fast):** Share Twenty workspace credentials via session token passed through iframe URL hash
- **Option B (Long-term):** Custom Twenty auth provider that validates next-auth JWT
- **Chosen:** Option A for Stream 3, with Option B as Phase 30 enhancement

---

## 2. CSP Headers for Neptune Chat

### Required Headers
Since Neptune Chat embeds Twenty CRM in an iframe:

```typescript
// next.config.ts — CSP headers via vercel.json or middleware
{
  "headers": [
    {
      "source": "/command-center(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "frame-src https://app.crm.newleaf.financial https://crm.newleaf.financial; frame-ancestors 'self'"
        }
      ]
    }
  ]
}
```

### Nginx Proxy (Twenty side)
Twenty's nginx should allow framing:

```nginx
# Remove if present
# add_header X-Frame-Options "SAMEORIGIN";

# Add explicit allow
add_header Content-Security-Policy "frame-ancestors https://neptune-chat-ashy.vercel.app https://neptune.newleaf.financial";
```

---

## 3. postMessage API Design

### Origin Verification (MANDATORY)
```typescript
const ALLOWED_ORIGINS = [
  "https://app.crm.newleaf.financial",
  "https://crm.newleaf.financial",
  "https://neptune-chat-ashy.vercel.app"
];

function isValidOrigin(origin: string): boolean {
  return ALLOWED_ORIGINS.some(allowed => origin === allowed || origin.startsWith(allowed));
}
```

### Command Messages (Chat → Twenty)
| Command | Payload | Effect |
|---------|---------|--------|
| `navigate` | `{path: string}` | Routes Twenty iframe to path |
| `refresh` | `{objectType?: string}` | Reloads list view |
| `highlight` | `{recordId: string}` | Visual highlight + scroll-to |
| `showActivity` | `{activityId: string}` | Opens activity drawer in Twenty |

### Event Messages (Twenty → Chat)
| Event | Payload | Effect |
|-------|---------|--------|
| `contextChanged` | `{record: object}` | Updates chat context |
| `actionRequested` | `{action: string, payload: object}` | Shows MissionCard |
| `recordOpened` | `{record: object}` | Tracks navigation |
| `fieldEdited` | `{field: string, value: any}` | Shows confirmation |

---

## 4. Auth Pass-Through Strategy (next-auth, not Clerk)

### Current Auth
Neptune Chat uses **next-auth v5** with credentials provider:
- `User` table with email/password
- No built-in role system
- JWT-based session with `type: "regular"` or `"guest"`

### Role Extension Plan
1. Add `role` column to User table (enum: `sales_agent | admin | super_admin`)
2. Extend next-auth JWT callback to include `role`
3. Extend session callback to expose `role`
4. Server-side role check in `/command-center` page

### Twenty Role Mapping
| Neptune Role | Twenty Role | Permissions |
|-------------|-------------|-------------|
| `sales_agent` | Member | Read/write assigned records, no settings |
| `admin` | Admin | Full CRUD, settings access |
| `super_admin` | Super Admin | Including extensions management |

### Auth Bridge API
`POST /api/twenty-auth/route.ts`:
1. Receives next-auth session cookie
2. Validates JWT via `auth()`
3. Maps role to Twenty workspace role
4. Returns Twenty session token (short-lived, 5min)
5. Iframe loads with `?token=<session_token>` URL param

---

## 5. Mobile Strategy

| Viewport | Layout |
|----------|--------|
| ≥768px | 70% iframe + 30% chat drawer (collapsible to 0%) |
| <768px | Iframe fullscreen, chat as bottom sheet |
| <375px | Stacked: drawer on activate 100% width |

Toggle drawer: `Cmd+/` (desktop) or swipe gesture (mobile)

---

## 6. Phase 22 Glass Primitives (Reused)

Available CSS custom properties:
- `--glass-surface-1/2/3` — surface layers with varying opacity
- `--glass-border` — border color
- `--glass-highlight` — top highlight for 3D effect
- `--glass-shadow-1/2/3` — elevation shadows
- `glass` utility class — backdrop-filter blur + saturate

---

## 7. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Twenty blocks iframing internally | High | Configure Twenty CSP + nginx; if Twenty uses frame-busting JS, add sandbox exception |
| Twenty auth session expires in iframe | Medium | Auto-refresh via postMessage; implement re-auth flow |
| Cross-origin postMessage attacks | Critical | Strict origin verification; never trust message.data |
| Cookie-based auth not sent in iframe | Medium | Use URL token or postMessage token relay |
| Mobile iframe performance | Low | Lazy load iframe; skeleton UI while loading |

---

*Generated by Hermes V5 — Phase 29 Stream 0 Research*
