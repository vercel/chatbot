/**
 * Phase 40 — Secure Credential Loader
 * Loads test credentials from vault, NEVER logs passwords.
 * Supports: VPS (/etc/newleaf/.env.test) + Vercel (encrypted env vars)
 * @author abhiswami2121@gmail.com
 */

import type { TestUserCredentials, TargetSystem, TestUserRole } from './types';

// ===== Security constants =====
const VAULT_PATH = '/etc/newleaf/.env.test';
const CREDENTIAL_VERSION = process.env.CREDENTIAL_VERSION || '1';
const TEST_ENV = process.env.TEST_ENV || 'preview';

// Fields that MUST be redacted in logs
const REDACT_FIELDS = new Set([
  'password', 'secret', 'key', 'token', 'credential',
  'pass', 'pwd', 'auth', 'authorization',
]);

// ===== Vault Loading =====

/**
 * Load credentials from VPS vault file (/etc/newleaf/.env.test).
 * Only called server-side, never exposed to client.
 */
function loadVaultFile(): Record<string, string> {
  try {
    const fs = require('fs');
    const content = fs.readFileSync(VAULT_PATH, 'utf-8');
    const vars: Record<string, string> = {};

    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) continue;

      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;

      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();

      // Remove surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      vars[key] = value;
    }

    return vars;
  } catch {
    // Vault file not accessible (e.g., in Vercel environment)
    return {};
  }
}

/**
 * Load credentials from Vercel encrypted environment variables.
 * Uses TESTER_USER_CREDENTIALS (JSON blob) or individual vars.
 */
function loadVercelEnv(): Record<string, string> {
  const blob = process.env.TESTER_USER_CREDENTIALS;
  if (blob) {
    try {
      return JSON.parse(blob);
    } catch {
      console.warn('[credentials] Failed to parse TESTER_USER_CREDENTIALS JSON');
    }
  }

  // Fallback: load individual env vars
  const prefix = 'TEST_USER_';
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith(prefix) && value) {
      vars[key] = value;
    }
  }
  return vars;
}

// ===== Safe Logging =====

/**
 * Strip sensitive fields from any object before logging.
 */
export function sanitizeForLog(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeForLog);
  }

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (REDACT_FIELDS.has(key.toLowerCase())) {
      cleaned[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      cleaned[key] = sanitizeForLog(value);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

/**
 * Safe console.log that strips credentials.
 */
export function safeLog(message: string, data?: unknown): void {
  if (data) {
    console.log(`[credentials] ${message}`, sanitizeForLog(data));
  } else {
    console.log(`[credentials] ${message}`);
  }
}

// ===== Credential Access =====

let cachedCredentials: TestUserCredentials | null = null;

/**
 * Get ALL test user credentials. Cached per process lifetime.
 * NEVER call this from client-side code.
 */
export function getTestCredentials(): TestUserCredentials {
  if (cachedCredentials) return cachedCredentials;

  const vaultVars = loadVaultFile();
  const vercelVars = loadVercelEnv();

  // Merge: VPS vault takes precedence over Vercel env
  const vars = { ...vercelVars, ...vaultVars };

  cachedCredentials = {
    neptuneChat: {
      email: vars.TEST_USER_NEPTUNE_CHAT_EMAIL || 'test-agent@newleaf.financial',
      password: vars.TEST_USER_NEPTUNE_CHAT_PASSWORD || '',
    },
    neptuneV2: {
      email: vars.TEST_USER_NEPTUNE_V2_EMAIL || 'test-agent@newleaf.financial',
      password: vars.TEST_USER_NEPTUNE_V2_PASSWORD || '',
    },
    twentyCrm: {
      email: vars.TEST_USER_TWENTY_EMAIL || 'test_agent@newleaf.financial',
      password: vars.TEST_USER_TWENTY_PASSWORD || '',
    },
    customerPortal: {
      email: vars.TEST_USER_PORTAL_EMAIL || 'test-customer@newleaf.financial',
      password: vars.TEST_USER_PORTAL_PASSWORD || '',
    },
    billingReadonly: {
      email: vars.TEST_USER_BILLING_EMAIL || 'test-billing@newleaf.financial',
      password: vars.TEST_USER_BILLING_PASSWORD || '',
    },
  };

  safeLog(`Credentials loaded [env=${TEST_ENV}, version=${CREDENTIAL_VERSION}]`);

  // Validate: at minimum, neptune-chat credentials must exist
  if (!cachedCredentials.neptuneChat.password) {
    safeLog('WARNING: neptune-chat test password is empty. Run Stream 1 setup.');
  }

  return cachedCredentials;
}

/**
 * Get credentials for a specific target system.
 */
export function getCredentialsForSystem(system: TargetSystem): { email: string; password: string } {
  const creds = getTestCredentials();
  switch (system) {
    case 'neptune-chat': return creds.neptuneChat;
    case 'neptune-v2': return creds.neptuneV2;
    case 'twenty-crm': return creds.twentyCrm;
    case 'customer-portal': return creds.customerPortal;
    case 'billing': return creds.billingReadonly;
    default: throw new Error(`Unknown target system: ${system}`);
  }
}

/**
 * Force reload credentials (for rotation support via CREDENTIAL_VERSION bump).
 */
export function reloadCredentials(): TestUserCredentials {
  cachedCredentials = null;
  return getTestCredentials();
}

/**
 * Check if credentials need rotation (env var tells us version changed).
 */
export function checkRotation(): boolean {
  const currentVersion = process.env.CREDENTIAL_VERSION || '1';
  if (currentVersion !== CREDENTIAL_VERSION) {
    safeLog(`Credential version changed: ${CREDENTIAL_VERSION} → ${currentVersion}. Reloading.`);
    reloadCredentials();
    return true;
  }
  return false;
}
