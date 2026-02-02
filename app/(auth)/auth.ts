import { compare } from 'bcrypt-ts';
import NextAuth, { type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { getUser, upsertOAuthUser, ensureUserExists } from '@/lib/db/queries';
import { authConfig } from './auth.config';
import { DUMMY_PASSWORD } from '@/lib/constants';
import type { DefaultJWT } from 'next-auth/jwt';

// Feature flag for guest login in preview environments
const useGuestLogin = process.env.USE_GUEST_LOGIN === 'true';

// Fixed guest user for preview environments (using a valid UUID)
const GUEST_USER_ID = '00000000-0000-0000-0000-000000000001';
const GUEST_USER_EMAIL = 'guest@preview.local';

export type UserType = 'regular';

declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: {
      id: string;
      type: UserType;
    } & DefaultSession['user'];
  }

  interface User {
    id?: string;
    email?: string | null;
    type: UserType;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string;
    type: UserType;
  }
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
      authorization: {
        params: {
          scope: "openid profile email User.Read"
        }
      },
      profile(profile) {
        // Multi-tenant apps don't reliably return email claim, use preferred_username
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.preferred_username || profile.email || profile.upn,
          image: profile.picture,
          type: 'regular' as const,
        }
      }
    }),
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
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

        if (!passwordsMatch) return null;

        return { ...user, type: 'regular' };
      },
    }),
    // Guest provider for preview environments - auto-logs in without credentials
    Credentials({
      id: 'guest',
      name: 'guest',
      credentials: {},
      async authorize() {
        if (!useGuestLogin) {
          return null;
        }

        // Create or get the guest user
        const guestUser = await ensureUserExists({
          id: GUEST_USER_ID,
          email: GUEST_USER_EMAIL,
        });

        return { ...guestUser, type: 'regular' as const };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Handle OAuth sign-in with domain validation
      if (account?.provider === 'google' || account?.provider === 'microsoft-entra-id') {
        const email = user.email?.toLowerCase() || '';
        const allowedDomains = ['@navapbc.com', '@rivco.org', '@navapbc.onmicrosoft.com', '@amplifi.org'];
        const isAllowedDomain = allowedDomains.some(domain => email.endsWith(domain));

        if (!isAllowedDomain) {
          return false;
        }

        const dbUser = await upsertOAuthUser({
          email: user.email!,
          name: user.name,
          image: user.image,
        });
        // Use the DB-generated user ID, not the OAuth provider's sub claim
        user.id = dbUser.id;
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id as string;
        token.type = account?.provider === 'google' || account?.provider === 'microsoft-entra-id' ? 'regular' : user.type;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.type = token.type;
      }

      return session;
    },
  },
});
