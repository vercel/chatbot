import { compare } from "bcrypt-ts";
import NextAuth, { type DefaultSession } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { DUMMY_PASSWORD } from "@/lib/constants";
import { createGuestUser, getUser } from "@/lib/db/queries";
import { isAllowed } from "@/lib/auth/allowlist";
import { authConfig } from "./auth.config";

export type UserType = "guest" | "regular";

// Phase 29: Role-based access for Command Center
export type TwentyRole = "sales_agent" | "admin" | "super_admin";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      type: UserType;
      role?: TwentyRole;
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    email?: string | null;
    type: UserType;
    role?: TwentyRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    type: UserType;
    role?: TwentyRole;
  }
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials.email ?? "");
        const password = String(credentials.password ?? "");
        const users = await getUser(email);

        if (users.length === 0) {
          await compare(password, DUMMY_PASSWORD);
          return null;
        }

        const [user] = users;

        if (!user.password) {
          await compare(password, DUMMY_PASSWORD);
          return null;
        }

        const passwordsMatch = await compare(password, user.password);

        if (!passwordsMatch) {
          return null;
        }

        return { ...user, type: "regular" };
      },
    }),
    Credentials({
      id: "guest",
      credentials: {},
      async authorize() {
        const [guestUser] = await createGuestUser();
        return { ...guestUser, type: "guest" };
      },
    }),
    // Google OAuth — conditionally registered only when env vars are set
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
  ],
  callbacks: {
    signIn({ user }) {
      // PHASE A: Block guest users — chat is NOT available as guest
      if (user.type === "guest") return false;

      // Regular users must have an allowed email
      if (!isAllowed(user.email)) {
        return false;
      }

      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        // Google OAuth users: map to local DB user so chats/references work
        if (account?.provider === "google" && user.email) {
          const [dbUser] = await getUser(user.email);
          if (dbUser) {
            token.id = dbUser.id;
            token.type = "regular";
            token.role = (dbUser.role as TwentyRole) || "sales_agent";
          } else {
            // First Google sign-in: create local DB record (no password)
            // Use a random hash as placeholder password for Google users
            token.id = user.id as string;
            token.type = "regular";
            token.role = "sales_agent";
          }
        } else {
          token.id = user.id as string;
          token.type = user.type;
          token.role = (user as { role?: TwentyRole }).role || "sales_agent";
        }
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.type = token.type;
        // Phase 29: Role propagation
        session.user.role = token.role;
      }

      return session;
    },
  },
});
