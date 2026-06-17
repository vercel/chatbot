/**
 * Phase 40 — RBAC Permissions Matrix
 * Enforces what test agents CAN and CANNOT do per system.
 * Sacred rule: NMI vault (6a1f118b) — test agent CANNOT touch billing.
 * @author abhiswami2121@gmail.com
 */

import type { TargetSystem, TestUserRole, RbacMatrix, Permission, PermissionAction } from './types';

// ===== RBAC MATRIX =====
// This is the SOURCE OF TRUTH for test agent permissions.
// Any action not explicitly allowed is DENIED.

export const RBAC_MATRIX: Record<TargetSystem, RbacMatrix> = {
  'neptune-chat': {
    system: 'neptune-chat',
    canRead: ['messages', 'knowledge', 'discovery_results', 'missions', 'chat_history'],
    canCreate: ['test_messages', 'test_missions'],
    canModify: ['own_test_messages', 'own_test_missions'],
    canDelete: ['own_test_messages', 'own_test_missions'],
    cannot: ['admin_settings', 'user_management', 'api_keys', 'production_missions', 'billing_data'],
  },
  'neptune-v2': {
    system: 'neptune-v2',
    canRead: ['generated_code', 'projects', 'deployments'],
    canCreate: ['test_projects'],
    canModify: ['own_test_projects'],
    canDelete: ['own_test_projects'],
    cannot: ['production_projects', 'user_auth', 'billing', 'api_keys'],
  },
  'twenty-crm': {
    system: 'twenty-crm',
    canRead: ['test_companies', 'test_contacts', 'test_deals', 'test_tasks', 'custom_fields'],
    canCreate: ['test_companies', 'test_contacts', 'test_deals', 'test_tasks'],
    canModify: ['test_companies', 'test_contacts', 'test_deals', 'test_tasks'],
    canDelete: ['test_companies', 'test_contacts', 'test_deals', 'test_tasks'],
    cannot: ['real_customer_data', 'billing_records', 'integrations', 'api_keys', 'workspace_settings'],
  },
  'customer-portal': {
    system: 'customer-portal',
    canRead: ['test_profile', 'test_disputes'],
    canCreate: ['test_disputes_draft'],
    canModify: ['test_profile', 'test_disputes_draft'],
    canDelete: ['test_disputes_draft'],
    cannot: ['real_disputes', 'payment_methods', 'ssn_data', 'bank_accounts', 'real_credit_reports'],
  },
  billing: {
    system: 'billing',
    canRead: ['test_billing_page_screenshot_only'],
    canCreate: [],
    canModify: [],
    canDelete: [],
    cannot: [
      'NMI_VAULT',          // Sacred vault (6a1f118b)
      'STRIPE_API',          // Production billing
      'CUSTOMER_CARDS',      // Card numbers
      'SUBSCRIPTIONS',       // Real subscriptions
      'REFUNDS',             // Cannot issue refunds
      'CHARGES',             // Cannot create charges
      'PAYMENT_METHODS',     // Real payment methods
      'INVOICES',            // Real invoices
    ],
  },
};

// ===== ROLE-BASED PERMISSIONS =====

export const ROLE_PERMISSIONS: Record<TestUserRole, Permission[]> = {
  tester: [
    { resource: 'neptune-chat', actions: ['read', 'create', 'modify', 'delete'] },
    { resource: 'neptune-v2', actions: ['read', 'create', 'modify', 'delete'] },
    { resource: 'twenty-crm', actions: ['read', 'create', 'modify', 'delete'] },
    { resource: 'customer-portal', actions: ['read', 'create', 'modify', 'delete'] },
    { resource: 'billing', actions: ['read'] }, // READ-ONLY, screenshots only
  ],
  test_customer: [
    { resource: 'customer-portal', actions: ['read', 'create', 'modify', 'delete'] },
  ],
  test_billing_readonly: [
    { resource: 'billing', actions: ['read'] }, // SCREENSHOTS ONLY, no interaction
    { resource: 'customer-portal', actions: ['read'] },
  ],
};

// ===== PERMISSION CHECKING =====

/**
 * Check if a test user role can perform an action on a resource.
 * Returns { allowed: boolean, reason?: string }
 */
export function canPerform(
  role: TestUserRole,
  system: TargetSystem,
  action: PermissionAction,
  resource: string,
): { allowed: boolean; reason?: string } {
  const matrix = RBAC_MATRIX[system];
  if (!matrix) {
    return { allowed: false, reason: `Unknown system: ${system}` };
  }

  // 1. Check explicit deny list FIRST (sacred rules)
  if (matrix.cannot.some(denied =>
    resource.toUpperCase().includes(denied.toUpperCase()) ||
    denied.toUpperCase().includes(resource.toUpperCase())
  )) {
    return {
      allowed: false,
      reason: `DENIED: ${resource} is in the explicit deny list for ${system}. Sacred rule enforced.`,
    };
  }

  // 2. Check billing sacred vault
  if (system === 'billing' && action !== 'read') {
    return {
      allowed: false,
      reason: `DENIED: Test agents CANNOT ${action} billing resources. NMI vault (6a1f118b) is sacred.`,
    };
  }

  // 3. Check tier-3 billing: screenshots only, no interaction
  if (system === 'billing' && role === 'test_billing_readonly') {
    if (action !== 'read') {
      return {
        allowed: false,
        reason: 'Tier 3 billing: READ-ONLY, screenshots only. No interaction allowed.',
      };
    }
  }

  // 4. Check allowed actions per system
  const allowedMap: Record<PermissionAction, string[]> = {
    read: matrix.canRead,
    create: matrix.canCreate,
    modify: matrix.canModify,
    delete: matrix.canDelete,
  };

  const allowedResources = allowedMap[action];
  const isAllowed = allowedResources.some(allowed =>
    resource.toLowerCase().includes(allowed.toLowerCase()) ||
    allowed.toLowerCase().includes(resource.toLowerCase())
  );

  if (!isAllowed) {
    return {
      allowed: false,
      reason: `DENIED: ${action} ${resource} not in allowed list for ${system}`,
    };
  }

  return { allowed: true };
}

/**
 * Assert that a test action is permitted. Throws if denied.
 */
export function enforcePermission(
  role: TestUserRole,
  system: TargetSystem,
  action: PermissionAction,
  resource: string,
): void {
  const result = canPerform(role, system, action, resource);
  if (!result.allowed) {
    throw new Error(`RBAC VIOLATION: ${result.reason}`);
  }
}

/**
 * Get the forbidden resources list for a system (for UI display).
 */
export function getForbiddenResources(system: TargetSystem): string[] {
  return RBAC_MATRIX[system]?.cannot || [];
}

/**
 * Get the allowed actions for a role on a system.
 */
export function getAllowedActions(role: TestUserRole, system: TargetSystem): PermissionAction[] {
  const rolePerms = ROLE_PERMISSIONS[role] || [];
  const sysPerm = rolePerms.find(p => p.resource === system);
  return sysPerm?.actions || [];
}

// ===== BILLING DOMAIN BLOCKLIST =====
// IPs/domains that the test browser must NEVER reach.
// Enforced at: 1) iptables level (VPS), 2) Playwright route interception, 3) CDP network blocking

export const BILLING_DOMAIN_BLOCKLIST = [
  'api.nmi.com',
  'secure.nmi.com',
  'api.stripe.com',
  'dashboard.stripe.com',
  'checkout.stripe.com',
  'js.stripe.com',
  'api.recoveryhub.com',
  'billing.newleaf.financial',
];

/**
 * Generate iptables rules for billing domain blocks.
 * Run once on VPS setup.
 */
export function generateIptablesRules(): string[] {
  return BILLING_DOMAIN_BLOCKLIST.map(domain =>
    `iptables -A OUTPUT -p tcp -d ${domain} -j DROP -m comment --comment "Phase40-test-browser-block"`
  );
}

// ===== TEST DATA TAGGING =====
// All test-created entities must have these markers

export const TEST_DATA_MARKER = {
  created_by: 'test-agent',
  is_test_data: true,
};

export function tagTestData<T extends Record<string, unknown>>(
  data: T,
  runId: string,
): T & { created_by: string; test_run_id: string; is_test_data: boolean } {
  return {
    ...data,
    created_by: 'test-agent',
    test_run_id: runId,
    is_test_data: true,
  };
}
