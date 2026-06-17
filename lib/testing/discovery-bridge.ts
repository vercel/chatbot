/**
 * Phase 40 ↔ Phase 38 Discovery Bridge
 * Connects discovery findings to UI verification via test agent.
 * Enables: "Verify in UI" action from discovery results.
 * @author abhiswami2121@gmail.com
 */

import { getOrchestrator } from './orchestrator';

// ===== Types =====

export interface DiscoveryFinding {
  id: string;
  title: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  system: string;
  url?: string;
  element?: string;
  expectedValue?: string;
  actualValue?: string;
  timestamp: Date;
}

export interface DiscoveryVerification {
  findingId: string;
  verified: boolean;
  verifiedAt: Date;
  screenshotPath?: string;
  diffFromExpected?: string;
  testRunId?: string;
  error?: string;
}

// ===== Bridge =====

/**
 * Verify a discovery finding in the actual UI using the test agent.
 */
export async function verifyDiscoveryFinding(
  finding: DiscoveryFinding,
): Promise<DiscoveryVerification> {
  if (!finding.url || !finding.element) {
    return {
      findingId: finding.id,
      verified: false,
      verifiedAt: new Date(),
      error: 'Finding missing url or element — cannot verify in UI',
    };
  }

  const orch = getOrchestrator();
  const result = await orch.verifyDiscoveryFinding({
    title: finding.title,
    url: finding.url,
    element: finding.element,
    expectedValue: finding.expectedValue || '',
  });

  return {
    findingId: finding.id,
    verified: result.verified,
    verifiedAt: new Date(),
    screenshotPath: result.screenshotPath,
    error: result.error,
  };
}

/**
 * Verify multiple discovery findings in batch.
 */
export async function verifyDiscoveryBatch(
  findings: DiscoveryFinding[],
): Promise<DiscoveryVerification[]> {
  const results: DiscoveryVerification[] = [];

  for (const finding of findings) {
    const result = await verifyDiscoveryFinding(finding);
    results.push(result);
  }

  const verified = results.filter(r => r.verified).length;
  console.log(`[discovery-bridge] Verified ${verified}/${findings.length} discovery findings`);

  return results;
}

/**
 * Generate a "Verify in UI" action for the discovery system.
 * This is the callback that discovery routes call to trigger test verification.
 */
export async function createDiscoveryVerificationAction(finding: DiscoveryFinding): Promise<{
  actionType: 'verify_in_ui';
  payload: DiscoveryVerification;
}> {
  const verification = await verifyDiscoveryFinding(finding);

  return {
    actionType: 'verify_in_ui',
    payload: verification,
  };
}

/**
 * Check if a finding is verifiable via UI testing.
 */
export function isFindingVerifiable(finding: DiscoveryFinding): boolean {
  return !!(
    finding.url &&
    finding.element &&
    (finding.expectedValue || finding.actualValue)
  );
}

/**
 * Get suggested test playbook for a discovery category.
 */
export function getSuggestedPlaybook(category: string): string | null {
  const map: Record<string, string> = {
    'crm_data': 'twenty-crm-smoke-test',
    'crm_missing': 'twenty-crm-smoke-test',
    'billing': 'cross-app-billing-flow',
    'customer_data': 'portal-customer-flow',
    'chat': 'chat-smoke-test',
    'discovery': 'chat-discovery-workflow-test',
    'code_gen': 'v2-smoke-test',
  };

  return map[category.toLowerCase()] || null;
}

/**
 * Format discovery verification result for display in UI.
 */
export function formatVerificationForUI(verification: DiscoveryVerification): {
  badge: 'verified' | 'unverified' | 'error';
  label: string;
  screenshotUrl?: string;
} {
  if (verification.error) {
    return { badge: 'error', label: `Error: ${verification.error}` };
  }
  if (verification.verified) {
    return {
      badge: 'verified',
      label: `Verified in UI at ${verification.verifiedAt.toISOString()}`,
      screenshotUrl: verification.screenshotPath,
    };
  }
  return { badge: 'unverified', label: 'Not verified in UI' };
}
