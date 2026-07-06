import NextAuth, { type DefaultSession } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { hasEntraAuthConfig } from "@/lib/auth-mode";
import { authConfig } from "./auth.config";

export type UserType = "regular";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      type: UserType;
    } & DefaultSession["user"];
    accessToken?: string;
    idToken?: string;
  }

  interface User {
    id?: string;
    email?: string | null;
    type?: UserType;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    type: UserType;
    accessToken?: string;
    idToken?: string;
  }
}

const tenantId = process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID;
const entraProvider =
  hasEntraAuthConfig()
    ? MicrosoftEntraID({
        clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
        clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
        ...(tenantId && {
          issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
        }),
      })
    : null;

const providers = [entraProvider].filter(
  (provider): provider is NonNullable<typeof provider> => Boolean(provider)
);

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  providers,
  callbacks: {
    jwt({ token, user, account }) {
      if (user) {
        token.id = user.id ?? token.sub ?? user.email ?? "";
        token.type = "regular";
      }

      if (account?.access_token) {
        token.accessToken = account.access_token;
      }

      if (account?.id_token) {
        token.idToken = account.id_token;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.type = token.type ?? "regular";
      }

      session.accessToken = token.accessToken;
      session.idToken = token.idToken;

      return session;
    },
  },
});
