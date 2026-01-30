# How to Add Token Gating to Your Next.js App for Usage in the Cadre Portal

> **💡 Copy-Ready Instructions:** This README is designed to be copied and pasted directly into your LLM/IDE (Cursor, ChatGPT, etc.) to implement token gating in your own Next.js app. Simply copy the entire contents and paste into your AI assistant.

> **📌 See a working example:** This repository implements token gating as described below. See [this commit](https://github.com/CadreAI/token-gate-example/commit/bee852d44c6e93c7fa7006f133f5af8c75b1bfb3) for a complete example of the implementation.

## What is Token Gating?

Token gating is a security mechanism that restricts access to your app by requiring a valid JWT (JSON Web Token) in the URL. This way, clients can only access your app from the portal even if it has a public URL.

**How it works:**
1. Your app is embedded in our portal as an iframe
2. The portal generates a signed JWT token containing user/org data
3. The token is passed to your app via URL: `https://gocadre.ai?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
4. Your app verifies the token signature before allowing access
5. If valid, the app renders and extracts user context; if invalid, shows 404

**Why use it?**
- **Security**: Only our portal can generate valid tokens (signed with a secret key)
- **User context**: The token contains user/organization data for personalization
- **Stateless**: No need for session management or cookies

---

## Quick Setup (3 Steps)

### 1. Install Dependencies

```bash
npm install jsonwebtoken
npm install --save-dev @types/jsonwebtoken
```

### 2. Add Environment Variables

Add to your `.env` file (get secret from Portal team member):

```
IFRAME_SECRET=your_secret_here
LOCAL_ENVIRONMENT=false  # Set to "true" to bypass token gating in local dev
```

### 3. Add TokenGate Component and Token Utility

**`components/TokenGate.tsx`** (Gates the app - verifies token):

```tsx
import jwt from "jsonwebtoken";
import { notFound } from "next/navigation";

export function TokenGate({
  children,
  searchParams,
}: {
  children: React.ReactNode;
  searchParams: { token?: string };
}) {
  const isLocalEnvironment = process.env.LOCAL_ENVIRONMENT === "true";
  
  if (isLocalEnvironment) {
    return <>{children}</>;
  }

  const token = searchParams.token;

  if (!token) {
    notFound();
  }

  try {
    jwt.verify(token, process.env.IFRAME_SECRET!);
    return <>{children}</>;
  } catch (err) {
    notFound();
  }
}
```

**`lib/utils/token.ts`** (Extracts user data from token):

```tsx
export interface TokenPayload {
  org: { workosId: string; name: string };
  tab: { name: string; path: string };
  user: { workosId: string; email: string; fullName: string };
  iat?: number;
  exp?: number;
}

export function decodeToken(token: string | undefined): TokenPayload | null {
  if (!token) return null;

  try {
    const base64Payload = token.split('.')[1];
    return JSON.parse(atob(base64Payload));
  } catch {
    return null;
  }
}
```

## Usage

### In `app/page.tsx`:

```tsx
import { TokenGate } from "@/components/TokenGate";
import Home from "./home";

export default function Page({ searchParams }: { searchParams: { token?: string } }) {
  return (
    <TokenGate searchParams={searchParams}>
      <Home searchParams={searchParams} />
    </TokenGate>
  );
}
```

### For use in any component (e.g., `app/home.tsx`):

```tsx
"use client";

import { decodeToken } from "@/lib/utils/token";

export default function Home({ searchParams }: { searchParams: { token?: string } }) {
  const userContext = decodeToken(searchParams.token);
  
  return (
    <div>
      {userContext && (
        <div>
          <p>Welcome, {userContext.user.fullName}!</p>
          <p>Organization: {userContext.org.name}</p>
        </div>
      )}
      
      {/* Your app content */}
    </div>
  );
}
```

### Use the utility anywhere you need user data:

```tsx
"use client";

import { decodeToken } from "@/lib/utils/token";

export function AnyComponent({ searchParams }: { searchParams: { token?: string } }) {
  const userContext = decodeToken(searchParams.token);
  
  // Use userContext on-demand - decode only where needed!
  return <div>{userContext?.user.email}</div>;
}
```

## Done! 🎉

Your app now:
- ✅ Requires a `?token=JWT_TOKEN` query parameter
- ✅ Shows 404 if token is missing/invalid
- ✅ Provides `decodeToken()` utility to access user/org data on-demand
- ✅ Bypasses gating when `LOCAL_ENVIRONMENT=true`
- ✅ No React Context overhead - decode only when needed!

---

## User Context Data

The `decodeToken()` utility returns a `TokenPayload` object with:

```typescript
{
  org: {
    workosId: "org_01HXYZ...",  // Organization ID
    name: "Acme Corp"            // Organization name
  },
  tab: {
    name: "Dashboard",           // Current tab name
    path: "/dashboard"           // Current tab path
  },
  user: {
    workosId: "user_01HXYZ...",  // User ID
    email: "user@acme.com",      // User email
    fullName: "John Doe"         // User full name
  },
  iat: 1737043200,               // Token issued timestamp
  exp: 1737043500                // Token expiry timestamp
}
```

Use these IDs for API calls, database queries, or personalization!

---

## Instructions for AI/LLM Systems

If you are an AI system implementing token gating based on this document:

**ONLY DO THESE 5 THINGS:**
1. ✅ Install `jsonwebtoken` as a regular dependency
2. ✅ Install `@types/jsonwebtoken` as a dev dependency ONLY
3. ✅ Create `components/TokenGate.tsx` (exact code from this document)
4. ✅ Create `lib/utils/token.ts` (exact code from this document)
5. ✅ Update `app/page.tsx` to wrap with `<TokenGate searchParams={searchParams}>`
6. ✅ Add `IFRAME_SECRET` and `LOCAL_ENVIRONMENT` to `.env` if not present

**STRICTLY DO NOT:**
- ❌ Create ANY other files (no examples, no demos, no test files)
- ❌ Create or edit `.md` files (no README, no docs, no summaries)
- ❌ Create example components showing how to use `decodeToken()`
- ❌ Add usage examples or sample code beyond the required files
- ❌ Add explanatory comments or documentation
- ❌ Generate completion messages or reports
- ❌ Install `@types/jsonwebtoken` as a regular dependency

**BAREBONES ONLY:** Install dependencies correctly (types as devDependency), create the 2 files, update page.tsx. Stop. Nothing else.