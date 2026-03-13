import type { UserType } from "@/lib/auth";

type Entitlements = {
  maxMessagesPerHour: number;
};

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  /*
   * For users without an account
   */
  guest: {
    maxMessagesPerHour: 10,
  },

  /*
   * For users with an account
   */
  regular: {
    maxMessagesPerHour: 10,
  },

  /*
   * TODO: For users with an account and a paid membership
   */
};
