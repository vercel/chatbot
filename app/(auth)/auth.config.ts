import type { NextAuthConfig } from "next-auth";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const authConfig = {
  basePath: "/api/auth",
  callbacks: {},
  pages: {
    newUser: `${base}/`,
    signIn: `${base}/login`,
  },
  providers: [],
  trustHost: true,
} satisfies NextAuthConfig;
