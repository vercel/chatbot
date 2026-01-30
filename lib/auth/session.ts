import "server-only";

import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { user } from "@/lib/db/schema";
import { decodeToken, type TokenPayload } from "@/lib/utils/token";

export type Session = {
  user: {
    id: string;
    email: string;
    name: string;
  };
  tokenPayload: TokenPayload;
};

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

async function getOrCreateUser(
  email: string
): Promise<{ id: string; email: string }> {
  const existing = await db
    .select()
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  if (existing.length > 0) {
    return { id: existing[0].id, email: existing[0].email };
  }

  const [created] = await db
    .insert(user)
    .values({ email })
    .returning({ id: user.id, email: user.email });

  return created;
}

export async function getSession(): Promise<Session | null> {
  const isLocalEnvironment = process.env.LOCAL_ENVIRONMENT === "true";

  if (isLocalEnvironment) {
    const devEmail = "dev@localhost";
    const dbUser = await getOrCreateUser(devEmail);

    return {
      user: {
        id: dbUser.id,
        email: dbUser.email,
        name: "Local Dev",
      },
      tokenPayload: {
        org: { workosId: "local", name: "Local" },
        tab: { name: "Chat", path: "/" },
        user: {
          workosId: "local",
          email: devEmail,
          fullName: "Local Dev",
        },
      },
    };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("portal-token")?.value;

  if (!token) {
    return null;
  }

  const payload = decodeToken(token);
  if (!payload) {
    return null;
  }

  const dbUser = await getOrCreateUser(payload.user.email);

  return {
    user: {
      id: dbUser.id,
      email: dbUser.email,
      name: payload.user.fullName,
    },
    tokenPayload: payload,
  };
}
