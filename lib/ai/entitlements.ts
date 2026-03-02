import type { UserType } from "@/app/(auth)/auth";

type Entitlements = {
  maxMessagesPerDay: number;
};

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  /*
   * For users without an account
   */
  guest: {
    maxMessagesPerDay: 10,
  },

  /*
   * For users with an account
   */
  regular: {
    maxMessagesPerDay: 10,
  },

  /*
   * TODO: For users with an account and a paid membership
   */
};
