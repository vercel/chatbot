import { compare, genSaltSync, hashSync } from "bcrypt-ts";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { anonymous } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/postgres-js";
import { headers } from "next/headers";
import postgres from "postgres";
import { account, session, user, verification } from "./db/schema";

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

export const auth = betterAuth({
  basePath: "/api/auth",
  baseURL: process.env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  emailAndPassword: {
    enabled: true,
    password: {
      hash: async (password) => hashSync(password, genSaltSync(10)),
      verify: async ({ hash, password }) => compare(password, hash),
    },
  },
  ...(process.env.VERCEL_CLIENT_ID && process.env.VERCEL_CLIENT_SECRET
    ? {
        socialProviders: {
          vercel: {
            clientId: process.env.VERCEL_CLIENT_ID,
            clientSecret: process.env.VERCEL_CLIENT_SECRET,
          },
        },
      }
    : {}),
  advanced: {
    database: {
      generateId: () => crypto.randomUUID(),
    },
  },
  plugins: [anonymous(), nextCookies()],
});

export type UserType = "guest" | "regular";

export function getUserType(user: Record<string, unknown>): UserType {
  return (user as { isAnonymous?: boolean }).isAnonymous ? "guest" : "regular";
}

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export type AuthSession = Awaited<ReturnType<typeof getSession>>;
export type AuthUser = NonNullable<AuthSession>["user"];
