import type { UserType } from "@/app/(auth)/auth";
import { isDevelopmentEnvironment } from "@/lib/constants";

type Entitlements = {
  maxMessagesPerDay: number;
};

// In development, set very high limits to avoid rate limiting during testing
const DEVELOPMENT_LIMIT = 1_000_000;

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  /*
   * For users without an account
   */
  guest: {
    maxMessagesPerDay: 50,
  },

  /*
   * For users with an account
   */
  regular: {
    maxMessagesPerDay: isDevelopmentEnvironment ? DEVELOPMENT_LIMIT : 50,
  },

  /*
   * TODO: For users with an account and a paid membership
   */
};
