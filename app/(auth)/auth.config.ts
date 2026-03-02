import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  basePath: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/auth`,
  pages: {
    signIn: "/login",
    newUser: "/",
  },
  providers: [
    // added later in auth.ts since it requires bcrypt which is only compatible with Node.js
    // while this file is also used in non-Node.js environments
  ],
  callbacks: {},
} satisfies NextAuthConfig;
