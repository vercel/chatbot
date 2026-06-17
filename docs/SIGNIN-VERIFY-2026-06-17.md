# Sign-In Verification Report — 2026-06-17

**Phase:** 32, Stream 0 | **Status:** COMPLETE WITH FIXES  
**Verified by:** Jarvis (Phase 32 execution)

## 1. Auth Architecture

### Provider: Credentials-based (email + password)
- No Google OAuth — intentional design for sales agent Command Center
- NextAuth v4 with Credentials provider
- Route: `/api/auth/callback/credentials`

### User Store: Drizzle ORM `User` table on Supabase PostgreSQL
- Table: `public."User"` (mapped via `lib/db/schema.ts`)
- Columns: id (uuid), email, password (bcrypt), name, emailVerified, image, isAnonymous, **role**, createdAt, updatedAt

## 2. Live Verification Results

### Auth Endpoints
| Endpoint | Status | Response |
|----------|--------|----------|
| `GET /api/auth/providers` | ✅ | Returns `credentials` + `guest` |
| `GET /api/auth/csrf` | ✅ | Returns valid csrfToken |
| `GET /api/auth/session` | ✅ | Returns `null` (no active session, expected) |
| `POST /api/auth/callback/credentials` | ✅ | Returns 302/Cookie (requires CSRF) |
| `GET /login` | ✅ | Renders full Next.js page "Neptune Chat" |

### Vercel Production Env Vars
| Variable | Status |
|----------|--------|
| `AUTH_URL` | ✅ Set to `https://neptune-chat-ashy.vercel.app` |
| `AUTH_TRUST_HOST` | ✅ Set to `true` |
| `AUTH_SECRET` | ✅ Set (32+ bytes) |
| `POSTGRES_URL` | ✅ Set (Supabase pooler) |

### Database Users
| Email | ID | Role | Password Set | emailVerified |
|-------|-----|------|-------------|---------------|
| abhiswami2121@gmail.com | 748c9b0a... | **super_admin** | ✅ | ❌ |
| abhiswami2121@gmail.com | 0a1fdf33... | **super_admin** | ✅ | ✅ |
| jerry.b.yirenkyi@gmail.com | 592d7a63... | **admin** | ✅ | ❌ |
| jerry.b.yirenkyi@gmail.com | 3d1105af... | **admin** | ✅ | ✅ |

### Allowlist (`lib/auth/allowlist.ts`)
```ts
ALLOWED_EMAILS = [
  "abhiswami2121@gmail.com",
  "jerry.b.yirenkyi@gmail.com",
]
```

## 3. Fixes Applied

### FIX-1: Role Column (CRITICAL)
**Problem:** Drizzle `User` table had NO `role` column. Auth JWT callback defaults to `"sales_agent"` for everyone.
**Fix:** Added `role varchar(32) NOT NULL DEFAULT 'sales_agent'` to:
1. `lib/db/schema.ts` — Drizzle schema definition
2. PostgreSQL `public."User"` table — `ALTER TABLE ADD COLUMN`

### FIX-2: Role Assignments
- `abhiswami2121@gmail.com` → `super_admin`
- `jerry.b.yirenkyi@gmail.com` → `admin`

### FIX-3: Auth Propagation
The `authorize` function's spread `{ ...user, type: "regular" }` now includes `role` from DB.
JWT callback: `token.role = user.role || "sales_agent"` — picks up DB role.
Session callback: `session.user.role = token.role` — propagates to client.

## 4. Acceptance Criteria

| AC | Description | Status |
|----|-------------|--------|
| AC-1 | Sign-in works for abhiswami2121@gmail.com | ✅ Code verified, DB confirmed |
| AC-2 | Sign-in works for jerry.b.yirenkyi@gmail.com | ✅ Code verified, DB confirmed |
| AC-3 | Roles propagate to session | ✅ Code path traced |
| AC-4 | Guest users blocked | ✅ signIn callback blocks type=guest |
| AC-5 | Allowlist enforced | ✅ isAllowed() checks both emails |
| AC-6 | Login page renders | ✅ Vercel live, title "Neptune Chat" |

## 5. Remaining Notes
- Both users have duplicate records (one emailVerified, one not) — `getUser` returns first match
- No `middleware.ts` — auth protection relies on client-side session checks + server actions
- Register page also available at `/register` — restricted by allowlist in signIn callback
