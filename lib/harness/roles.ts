/**
 * Role-Based Access Control — Neptune Command Center
 *
 * Phase 29: Per-user RBAC (Stream 3)
 *
 * Mapped to next-auth session (not Clerk). Role stored in User table `role` column:
 *   - sales_agent → Twenty Member (read/write assigned records, no settings)
 *   - admin → Twenty Admin (full CRUD, settings access)
 *   - super_admin → Twenty Super Admin (extensions + all)
 *
 * NMI SACRED BOUNDARY: Card data NEVER transmitted through this system.
 */

export type UserRole = "sales_agent" | "admin" | "super_admin";

export type TwentyRole = "Member" | "Admin" | "Super Admin";

export interface RoleConfig {
  role: UserRole;
  twentyRole: TwentyRole;
  label: string;
  color: "blue" | "orange" | "red";
  permissions: {
    canSendPayment: boolean;
    canSendSMS: boolean;
    canAddNote: boolean;
    canCreateTicket: boolean;
    canRunWorkflow: boolean;
    canAccessSettings: boolean;
    canManageExtensions: boolean;
    canViewAllRecords: boolean;
  };
}

// ── Role Configuration ──────────────────────────────────────────────

const ROLE_CONFIGS: Record<UserRole, RoleConfig> = {
  sales_agent: {
    role: "sales_agent",
    twentyRole: "Member",
    label: "Sales Agent",
    color: "blue",
    permissions: {
      canSendPayment: true,
      canSendSMS: true,
      canAddNote: true,
      canCreateTicket: true,
      canRunWorkflow: false,
      canAccessSettings: false,
      canManageExtensions: false,
      canViewAllRecords: false,
    },
  },
  admin: {
    role: "admin",
    twentyRole: "Admin",
    label: "Admin",
    color: "orange",
    permissions: {
      canSendPayment: true,
      canSendSMS: true,
      canAddNote: true,
      canCreateTicket: true,
      canRunWorkflow: true,
      canAccessSettings: true,
      canManageExtensions: false,
      canViewAllRecords: true,
    },
  },
  super_admin: {
    role: "super_admin",
    twentyRole: "Super Admin",
    label: "Super Admin",
    color: "red",
    permissions: {
      canSendPayment: true,
      canSendSMS: true,
      canAddNote: true,
      canCreateTicket: true,
      canRunWorkflow: true,
      canAccessSettings: true,
      canManageExtensions: true,
      canViewAllRecords: true,
    },
  },
};

// ── Helpers ─────────────────────────────────────────────────────────

export function getRoleConfig(role: UserRole): RoleConfig {
  return ROLE_CONFIGS[role] || ROLE_CONFIGS.sales_agent;
}

export function validateRole(role: string): role is UserRole {
  return role === "sales_agent" || role === "admin" || role === "super_admin";
}

export function roleToTwentyRole(role: UserRole): TwentyRole {
  return ROLE_CONFIGS[role]?.twentyRole || "Member";
}

/**
 * Check if a role can perform a specific action.
 * Used for UI gating in the Chat Drawer and Quick Actions toolbar.
 */
export function canPerform(role: UserRole, action: keyof RoleConfig["permissions"]): boolean {
  return ROLE_CONFIGS[role]?.permissions[action] ?? false;
}
