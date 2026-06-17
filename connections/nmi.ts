/**
 * connections/nmi.ts — NMI Payment Connection (Eve Pattern Adapter)
 *
 * NMI vault connection — SACRED PATH.
 * Uses environment variable authentication ONLY (no OAuth).
 * NMI does not support Vercel Connect OAuth — API key based.
 *
 * Pattern 1: Connections/ + Vercel Connect OAuth
 * Phase 38: Autonomous Coding Platform
 *
 * ⛔ CARDINAL: Never expose NMI security keys in client code.
 * ⛔ CARDINAL: NMI vault memory 6a1f118b is sacred — do not modify.
 */

import type { McpClientConnection } from "./github";

export const nmiConnection: McpClientConnection = {
  name: "nmi",
  description: "NMI Payment Gateway — vault, charges, refunds, subscriptions",
  url: "https://secure.networkmerchants.com/api/transact.php",
  auth: {
    provider: "env", // NMI is env-only, no OAuth
    tokenEnv: "NMI_SECURITY_KEY",
  },
  transport: "http",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
  },
};

/**
 * Resolves NMI security key from environment.
 * NMI is env-only — no OAuth path available.
 */
export function resolveNmiSecurityKey(): string {
  const key = process.env.NMI_SECURITY_KEY;
  if (!key) {
    throw new Error("NMI_SECURITY_KEY not set. Payment operations unavailable.");
  }
  return key;
}

export default nmiConnection;
