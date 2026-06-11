import { z } from 'zod';

const VERCEL_API = 'https://api.vercel.com';

// --- Zod Schemas ---

export const VercelDeploySchema = z.object({
  uid: z.string(),
  url: z.string(),
  state: z.enum(['INITIALIZING', 'BUILDING', 'READY', 'ERROR', 'CANCELED']),
  created: z.number(),
  meta: z
    .object({
      githubCommitSha: z.string().optional(),
      githubCommitRef: z.string().optional(),
    })
    .optional(),
});

export type VercelDeploy = z.infer<typeof VercelDeploySchema>;

interface VercelDeploymentsResponse {
  deployments: VercelDeploy[];
}

// --- API Calls ---

export async function getLatestDeploy(projectId: string): Promise<VercelDeploy> {
  const token = process.env.VERCEL_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;

  if (!token) throw new Error('VERCEL_TOKEN not set');
  if (!teamId) throw new Error('VERCEL_TEAM_ID not set');

  const res = await fetch(
    `${VERCEL_API}/v6/deployments?projectId=${projectId}&teamId=${teamId}&limit=1`,
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
  );

  if (!res.ok) {
    throw new Error(`Vercel API returned ${res.status}: ${await res.text()}`);
  }

  const data: VercelDeploymentsResponse = await res.json();
  const deploy = data.deployments[0];

  if (!deploy) {
    throw new Error(`No deployments found for project ${projectId}`);
  }

  return VercelDeploySchema.parse(deploy);
}

export async function getDeployEvents(
  projectId: string,
  deployId: string,
): Promise<Array<{ type: string; text: string; created: number }>> {
  const token = process.env.VERCEL_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;

  if (!token) throw new Error('VERCEL_TOKEN not set');
  if (!teamId) throw new Error('VERCEL_TEAM_ID not set');

  const res = await fetch(
    `${VERCEL_API}/v2/deployments/${deployId}/events?teamId=${teamId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!res.ok) {
    throw new Error(`Vercel events API returned ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

export async function getDeployBuildLogs(
  projectId: string,
  deployId: string,
): Promise<string> {
  const events = await getDeployEvents(projectId, deployId);
  return events
    .filter((e) => e.type === 'log' || e.type === 'command' || e.type === 'stderr')
    .map((e) => `[${new Date(e.created).toISOString()}] ${e.type}: ${e.text}`)
    .join('\n');
}

// --- Wait + Smoke ---

export async function waitForDeployReady(
  projectId: string,
  expectedSha: string,
  maxWaitMs = 8 * 60 * 1000,
): Promise<VercelDeploy> {
  const start = Date.now();
  let lastDeploy: VercelDeploy | null = null;

  while (Date.now() - start < maxWaitMs) {
    const deploy = await getLatestDeploy(projectId);
    lastDeploy = deploy;

    // If the latest deploy matches our commit SHA
    if (deploy.meta?.githubCommitSha?.startsWith(expectedSha)) {
      if (deploy.state === 'READY') return deploy;
      if (deploy.state === 'ERROR') {
        const logs = await getDeployBuildLogs(projectId, deploy.uid).catch(() => 'Logs unavailable');
        throw new Error(`Deploy ERROR (${deploy.uid}):\n${logs}`);
      }
    }

    await new Promise((r) => setTimeout(r, 30000));
  }

  const state = lastDeploy?.state ?? 'unknown';
  throw new Error(
    `Deploy timeout after ${maxWaitMs}ms. Last state: ${state}, sha: ${lastDeploy?.meta?.githubCommitSha ?? 'unknown'}`,
  );
}

export async function smokeTest(
  url: string,
  paths: string[],
): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};

  for (const p of paths) {
    try {
      const res = await fetch(`${url}${p}`, { redirect: 'follow' });
      results[p] = res.ok;
    } catch {
      results[p] = false;
    }
  }

  return results;
}

// --- Full Deploy Verification Pipeline ---

export interface DeployVerification {
  projectId: string;
  projectName: string;
  commitSha: string;
  deploy?: VercelDeploy;
  deployState: VercelDeploy['state'] | 'PENDING';
  url?: string;
  smokeResults?: Record<string, boolean>;
  smokePassed: boolean;
  errors: string[];
}

export async function verifyDeploy(
  projectId: string,
  projectName: string,
  commitSha: string,
  smokePaths: string[],
): Promise<DeployVerification> {
  const result: DeployVerification = {
    projectId,
    projectName,
    commitSha,
    deployState: 'PENDING',
    smokePassed: false,
    errors: [],
  };

  try {
    // Wait for deploy to be ready
    const deploy = await waitForDeployReady(projectId, commitSha);

    result.deploy = deploy;
    result.deployState = deploy.state;
    result.url = deploy.url;

    // Construct the full URL for smoke testing
    const baseUrl = deploy.url.startsWith('http') ? deploy.url : `https://${deploy.url}`;

    // Smoke test
    if (smokePaths.length > 0) {
      result.smokeResults = await smokeTest(baseUrl, smokePaths);
      result.smokePassed = Object.values(result.smokeResults!).every(Boolean);
    } else {
      result.smokePassed = true; // no paths to test
    }
  } catch (err) {
    result.deployState = 'ERROR';
    result.errors.push(err instanceof Error ? err.message : String(err));
  }

  return result;
}

// --- Sandbox-callable entry point ---

export async function runDeployVerify(args: {
  projectId: string;
  projectName: string;
  commitSha: string;
  smokePaths: string[];
}): Promise<DeployVerification> {
  return verifyDeploy(args.projectId, args.projectName, args.commitSha, args.smokePaths);
}
