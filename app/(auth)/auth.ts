import { compare } from "bcrypt-ts";
import NextAuth, { type DefaultSession } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import { DUMMY_PASSWORD } from "@/lib/constants";
import { createGuestUser, getUser } from "@/lib/db/queries";
import { authConfig } from "./auth.config";

export type UserType = "guest" | "regular";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      type: UserType;
      isLoggedIn: boolean;
      username?: string|null;
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    email?: string | null;
    type: UserType;
    username?: string|null;
    isLoggedIn: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    type: UserType;
    email?: string;
    username?: string;
    isLoggedIn: boolean;
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
      credentials: {},
      async authorize({ email, password }: any) {
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

        return { ...user, type: "regular", isLoggedIn: true };
      },
    }),
    Credentials({
      id: "guest",
      credentials: {},
      async authorize() {
        try {
          // Create guest user
          const [guestUser] = await createGuestUser();

          return {
            ...guestUser,
            type: "guest",
            isLoggedIn: false
          };
        } catch (error) {
          console.error("Guest auth error: Unexpected error during guest authentication:", {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          });
          return null;
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.type = user.type;
        token.isLoggedIn = user.isLoggedIn;
        if (user.email) {
          token.email = user.email;
        }
        if (user.username) {
          token.username = user.username;
        }
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.type = token.type;
        session.user.isLoggedIn = token.isLoggedIn;
        if (token.email) {
          session.user.email = token.email;
        }
        if (token.username) {
          session.user.username = token.username;
        }
      }

      return session;
    },
  },
});
