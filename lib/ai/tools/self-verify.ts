/**
 * lib/ai/tools/self-verify.ts
 *
 * Self-verification tool that uses agent-browser CLI to:
 * 1. Navigate to a URL
 * 2. Take a screenshot
 * 3. Verify expected DOM elements exist
 * 4. Return pass/fail with evidence
 *
 * Used for automated deployment verification and connector health checks.
 */

import { tool } from "ai";
import { z } from "zod";
import { execSync } from "child_process";

interface VerifyResult {
  pass: boolean;
  url: string;
  timestamp: string;
  checks: {
    element: string;
    found: boolean;
    details: string;
  }[];
  screenshotPath?: string;
  errors: string[];
}

/**
 * Run agent-browser to verify a URL contains expected elements.
 */
async function runBrowserVerify(
  url: string,
  expectedElements: string[],
  screenshotDir?: string
): Promise<VerifyResult> {
  const errors: string[] = [];
  const checks: VerifyResult["checks"] = [];

  try {
    // Navigate to the URL
    execSync(`agent-browser open "${url}"`, {
      timeout: 30_000,
      stdio: "pipe",
    });

    // Wait for page load
    execSync("sleep 2");

    // Take interactive snapshot to get DOM elements
    const snapshot = execSync("agent-browser snapshot -i", {
      timeout: 15_000,
      encoding: "utf-8",
    });

    // Check for each expected element
    for (const el of expectedElements) {
      const found = snapshot.includes(el);
      checks.push({
        element: el,
        found,
        details: found
          ? `Element "${el}" found in page`
          : `Element "${el}" NOT found in page`,
      });
      if (!found) {
        errors.push(`Missing expected element: "${el}"`);
      }
    }

    // Take screenshot if directory specified
    let screenshotPath: string | undefined;
    if (screenshotDir) {
      const timestamp = Date.now();
      const filename = `verify-${new URL(url).hostname}-${timestamp}.png`;
      screenshotPath = `${screenshotDir}/${filename}`;
      execSync(`agent-browser screenshot "${screenshotPath}"`, {
        timeout: 15_000,
        stdio: "pipe",
      });
    }

    // Close browser
    execSync("agent-browser close", { timeout: 5_000, stdio: "pipe" });

    return {
      pass: errors.length === 0,
      url,
      timestamp: new Date().toISOString(),
      checks,
      screenshotPath,
      errors,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`Browser verification failed: ${message}`);

    // Try to close browser even on error
    try {
      execSync("agent-browser close", { timeout: 5_000, stdio: "pipe" });
    } catch {
      // ignore
    }

    return {
      pass: false,
      url,
      timestamp: new Date().toISOString(),
      checks,
      errors,
    };
  }
}

/**
 * Verify endpoint health by fetching and checking status.
 */
async function verifyEndpoint(
  url: string,
  expectedStatus: number
): Promise<{ pass: boolean; status: number; body: string }> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
    });
    const body = await res.text().catch(() => "");
    return {
      pass: res.status === expectedStatus,
      status: res.status,
      body: body.slice(0, 500),
    };
  } catch (err) {
    return {
      pass: false,
      status: 0,
      body: String(err),
    };
  }
}

/**
 * Self-verify tool — validates a deployed URL.
 */
export const selfVerify = tool({
  description:
    "Verify a deployed application URL for correctness. Checks that expected DOM elements exist on the page using agent-browser. Also verifies API endpoint health. Returns pass/fail with evidence.",
  inputSchema: z.object({
    url: z.string().url().describe("The URL to verify"),
    expectedElements: z
      .array(z.string())
      .describe("List of text/elements expected to be present on the page"),
    apiEndpoints: z
      .array(
        z.object({
          path: z.string().describe("API path relative to the base URL"),
          expectedStatus: z
            .number()
            .default(200)
            .describe("Expected HTTP status code"),
        })
      )
      .optional()
      .describe("Optional API endpoints to verify"),
    takeScreenshot: z
      .boolean()
      .default(false)
      .describe("Whether to take a screenshot for evidence"),
  }),
  execute: async ({ url, expectedElements, apiEndpoints, takeScreenshot }) => {
    const screenshotDir = takeScreenshot ? "/tmp/neptune-verify" : undefined;
    if (screenshotDir) {
      execSync(`mkdir -p "${screenshotDir}"`, { stdio: "pipe" });
    }

    // Run browser verification
    const browserResult = await runBrowserVerify(
      url,
      expectedElements,
      screenshotDir
    );

    // Check API endpoints
    const apiResults: Record<string, unknown> = {};
    if (apiEndpoints) {
      for (const ep of apiEndpoints) {
        const result = await verifyEndpoint(
          `${url.replace(/\/$/, "")}${ep.path}`,
          ep.expectedStatus
        );
        apiResults[ep.path] = result;
      }
    }

    const allApiPass = Object.values(apiResults).every(
      (r: Record<string, unknown>) => r.pass
    );

    return {
      success: browserResult.pass && allApiPass,
      summary: {
        browser: {
          pass: browserResult.pass,
          checksPassed: browserResult.checks.filter((c) => c.found).length,
          checksTotal: browserResult.checks.length,
          errors: browserResult.errors,
        },
        api: {
          pass: allApiPass,
          results: apiResults,
        },
      },
      screenshotPath: browserResult.screenshotPath,
      verifiedAt: new Date().toISOString(),
    };
  },
});

export default selfVerify;
