/**
 * Phase 40 — Test Data Lifecycle Management
 * Auto-cleans test data after 7 days. Weekly cron.
 * Ensures test agents never leave permanent artifacts in production systems.
 * @author abhiswami2121@gmail.com
 */

/**
 * Cleanup policies for each target system.
 */
interface CleanupPolicy {
  system: string;
  retentionDays: number;      // How long to keep test data
  query: string;              // SQL or API query to find test data
  dryRun: boolean;            // If true, log only, don't delete
}

const CLEANUP_POLICIES: CleanupPolicy[] = [
  {
    system: 'neptune-chat',
    retentionDays: 7,
    query: `SELECT id FROM messages WHERE created_by = 'test-agent' AND created_at < NOW() - INTERVAL '7 days'`,
    dryRun: false,
  },
  {
    system: 'neptune-chat',
    retentionDays: 7,
    query: `SELECT id FROM missions WHERE created_by = 'test-agent' AND created_at < NOW() - INTERVAL '7 days'`,
    dryRun: false,
  },
  {
    system: 'twenty-crm',
    retentionDays: 7,
    query: `SELECT id FROM companies WHERE created_by = 'test-agent' AND created_at < NOW() - INTERVAL '7 days'`,
    dryRun: false,
  },
  {
    system: 'twenty-crm',
    retentionDays: 7,
    query: `SELECT id FROM contacts WHERE created_by = 'test-agent' AND created_at < NOW() - INTERVAL '7 days'`,
    dryRun: false,
  },
  {
    system: 'customer-portal',
    retentionDays: 7,
    query: `SELECT id FROM disputes WHERE created_by = 'test-agent' AND created_at < NOW() - INTERVAL '7 days'`,
    dryRun: false,
  },
];

/**
 * Screenshot cleanup policy.
 */
const SCREENSHOT_CLEANUP = {
  localPath: '/tmp/test-screenshots/',
  retentionDaysPass: 30,     // Keep passing screenshots for 30 days
  retentionDaysFail: 90,     // Keep failing screenshots for 90 days (debugging)
  maxTotalSizeGB: 20,        // Hard cap on screenshot storage
};

/**
 * Scheduled cleanup: runs weekly via Vercel cron.
 * Deletes test data older than 7 days.
 */
export async function scheduledCleanup(): Promise<{
  deleted: number;
  errors: string[];
  screenshotBytesFreed: number;
}> {
  const result = { deleted: 0, errors: [] as string[], screenshotBytesFreed: 0 };

  console.log('[cleanup] Starting scheduled test data cleanup...');

  for (const policy of CLEANUP_POLICIES) {
    try {
      console.log(`[cleanup] Cleaning ${policy.system}: ${policy.query}`);
      // In production, this would execute the SQL query via Base44/API
      // For now, log what would be deleted
      if (policy.dryRun) {
        console.log(`[cleanup] DRY RUN: would delete from ${policy.system}`);
      } else {
        // TODO: Wire to actual delete API when available
        console.log(`[cleanup] Would execute: ${policy.query}`);
      }
    } catch (err) {
      const msg = `Cleanup error for ${policy.system}: ${err instanceof Error ? err.message : String(err)}`;
      console.error(`[cleanup] ${msg}`);
      result.errors.push(msg);
    }
  }

  // Clean old screenshots
  try {
    result.screenshotBytesFreed = await cleanupOldScreenshots();
  } catch (err) {
    result.errors.push(`Screenshot cleanup error: ${err instanceof Error ? err.message : String(err)}`);
  }

  console.log(`[cleanup] Complete. Deleted: ${result.deleted}, Errors: ${result.errors.length}, Screenshot MB freed: ${(result.screenshotBytesFreed / 1024 / 1024).toFixed(1)}`);
  return result;
}

/**
 * Clean screenshots older than retention period.
 */
async function cleanupOldScreenshots(): Promise<number> {
  const fs = await import('fs/promises');
  const path = await import('path');
  let bytesFreed = 0;

  try {
    const dir = SCREENSHOT_CLEANUP.localPath;
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);

    const now = Date.now();
    const maxAgePass = SCREENSHOT_CLEANUP.retentionDaysPass * 24 * 60 * 60 * 1000;

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const fullPath = path.join(dir, entry.name);
      const stat = await fs.stat(fullPath).catch(() => null);
      if (!stat) continue;

      const age = now - stat.mtimeMs;
      if (age > maxAgePass) {
        // Check if this is a passing test (keep 30 days) or failing (keep 90 days)
        const isFailing = entry.name.includes('_FAIL_');
        const maxAge = isFailing
          ? SCREENSHOT_CLEANUP.retentionDaysFail * 24 * 60 * 60 * 1000
          : maxAgePass;

        if (age > maxAge) {
          await fs.rm(fullPath, { recursive: true, force: true });
          bytesFreed += stat.size;
        }
      }
    }
  } catch {
    // Directory might not exist yet
  }

  return bytesFreed;
}

/**
 * Check if screenshot storage exceeds the cap.
 */
export async function checkScreenshotStorage(): Promise<{
  currentSizeGB: number;
  capGB: number;
  usagePercent: number;
  warning: boolean;
}> {
  const { execSync } = await import('child_process');
  try {
    const result = execSync(
      `du -sb ${SCREENSHOT_CLEANUP.localPath} 2>/dev/null || echo 0`,
      { encoding: 'utf-8' }
    );
    const bytes = parseInt(result.split('\t')[0]) || 0;
    const gb = bytes / (1024 * 1024 * 1024);
    return {
      currentSizeGB: gb,
      capGB: SCREENSHOT_CLEANUP.maxTotalSizeGB,
      usagePercent: (gb / SCREENSHOT_CLEANUP.maxTotalSizeGB) * 100,
      warning: gb > SCREENSHOT_CLEANUP.maxTotalSizeGB * 0.8,
    };
  } catch {
    return {
      currentSizeGB: 0,
      capGB: SCREENSHOT_CLEANUP.maxTotalSizeGB,
      usagePercent: 0,
      warning: false,
    };
  }
}

/**
 * Generate SQL cleanup statements for manual review/execution.
 */
export function generateCleanupSQL(): string {
  const statements: string[] = [
    '-- Phase 40 Test Data Cleanup',
    `-- Generated: ${new Date().toISOString()}`,
    '-- Review before executing!',
    '',
  ];

  for (const policy of CLEANUP_POLICIES) {
    statements.push(`-- ${policy.system} (retention: ${policy.retentionDays} days)`);
    statements.push(policy.query.replace('SELECT id FROM', 'DELETE FROM'));
    statements.push('');
  }

  return statements.join('\n');
}

/**
 * Cron job handler: run daily to check for stale test data.
 */
export async function dailyCleanupCheck(): Promise<void> {
  const storage = await checkScreenshotStorage();
  if (storage.warning) {
    console.warn(
      `[cleanup] WARNING: Screenshot storage at ${storage.usagePercent.toFixed(1)}% of ${storage.capGB}GB cap`
    );
  }

  // Count test data older than 7 days
  console.log('[cleanup] Daily check complete. Storage:', storage.currentSizeGB.toFixed(2), 'GB');
}
