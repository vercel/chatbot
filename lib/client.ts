import { createAuthClient } from "better-auth/react";
import { anonymousClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  basePath: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/auth`,
  plugins: [anonymousClient()],
});

export const { useSession, signIn, signUp, signOut } = authClient;
