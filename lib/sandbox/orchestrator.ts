/**
 * Sandbox Orchestrator — 5-layer router per master PRD section 4.
 * Routes tool requests through: inline → ephemeral sandbox → persistent session → VPS bridge → v2 handoff.
 */
import { Sandbox } from '@vercel/sandbox';
import { sandboxManager } from './manager';

export type SandboxLayer = 'inline' | 'ephemeral' | 'persistent' | 'vps_bridge' | 'v2_handoff';

interface OrchestrationResult {
  layer: SandboxLayer;
  result: unknown;
  runId?: string;
  durationMs: number;
}

interface ToolRequest {
  tool: string;
  userId: string;
  payload: Record<string, unknown>;
  sessionKey?: string;
}

/**
 * Determine which layer handles this request.
 * Layer 1 (inline): simple, fast operations that don't need sandbox isolation.
 * Layer 2 (ephemeral): one-shot sandbox for untrusted/user code.
 * Layer 3 (persistent): session sandbox reused across calls.
 * Layer 4 (vps_bridge): external tools (Slack, NMI, Base44) via VPS bridge.
 * Layer 5 (v2_handoff): complex multi-step coding agent handoff to neptune-v2.
 */
function routeLayer(req: ToolRequest): SandboxLayer {
  const { tool, sessionKey } = req;

  // Layer 3: Persistent session tools
  if (sessionKey && ['runScript', 'runWorkflow', 'processData'].includes(tool)) {
    return 'persistent';
  }

  // Layer 5: Complex multi-step coding tasks
  if (tool === 'spawnCodingAgent' || tool === 'runWorkflow') {
    return 'v2_handoff';
  }

  // Layer 4: External tools
  if (['slackPost', 'slackHistory', 'nmiCharge', 'nmiQuery', 'base44Query', 'base44Create'].includes(tool)) {
    return 'vps_bridge';
  }

  // Layer 2: Ephemeral sandbox (default for code execution)
  if (['runScript', 'scrapeURL', 'processData', 'generateMedia'].includes(tool)) {
    return 'ephemeral';
  }

  // Layer 1: Inline fallback
  return 'inline';
}

export class SandboxOrchestrator {
  /**
   * Execute a tool request through the appropriate layer.
   */
  async execute(req: ToolRequest): Promise<OrchestrationResult> {
    const layer = routeLayer(req);
    const startTime = Date.now();

    switch (layer) {
      case 'inline':
        return { layer, result: await this.executeInline(req), durationMs: Date.now() - startTime };

      case 'ephemeral':
        return { layer, result: await this.executeEphemeral(req), durationMs: Date.now() - startTime };

      case 'persistent':
        return { layer, result: await this.executePersistent(req), durationMs: Date.now() - startTime };

      case 'vps_bridge':
        return { layer, result: await this.executeVpsBridge(req), durationMs: Date.now() - startTime };

      case 'v2_handoff':
        return { layer, result: await this.executeV2Handoff(req), durationMs: Date.now() - startTime };

      default:
        throw new Error(`Unknown sandbox layer: ${layer}`);
    }
  }

  private async executeInline(req: ToolRequest): Promise<unknown> {
    // Simple operations that don't need sandbox isolation
    switch (req.tool) {
      case 'echo':
        return { echo: req.payload };
      case 'getStats':
        return sandboxManager.getStats();
      default:
        return { message: `Inline handler for ${req.tool} not implemented` };
    }
  }

  private async executeEphemeral(req: ToolRequest): Promise<unknown> {
    const { sandbox, runId } = await sandboxManager.createEphemeral({
      userId: req.userId,
      toolName: req.tool,
      runtime: (req.payload.runtime as 'node24' | 'python3.13') || 'node24',
    });

    try {
      const result = await this.runInSandbox(sandbox, req);
      sandboxManager.updateRun(runId, { status: 'completed' });
      await sandbox.stop();
      return { runId, ...result };
    } catch (e: any) {
      sandboxManager.updateRun(runId, { status: 'error', stderr: e.message });
      await sandbox.stop();
      throw e;
    }
  }

  private async executePersistent(req: ToolRequest): Promise<unknown> {
    const sandbox = await sandboxManager.getOrCreatePersistent({
      sessionKey: req.sessionKey!,
      userId: req.userId,
    });

    try {
      const result = await this.runInSandbox(sandbox, req);
      sandboxManager.releasePersistent(req.sessionKey!);
      return result;
    } catch (e) {
      sandboxManager.releasePersistent(req.sessionKey!);
      throw e;
    }
  }

  private async runInSandbox(sandbox: Sandbox, req: ToolRequest): Promise<unknown> {
    const { tool, payload } = req;

    switch (tool) {
      case 'runScript': {
        const { code, runtime } = payload as { code: string; runtime?: string };
        const ext = runtime === 'python' ? 'py' : 'ts';
        const filename = `/script.${ext}`;
        await sandbox.writeFiles([{ path: filename, content: Buffer.from(code) }]);

        if (runtime === 'python') {
          const result = await sandbox.runCommand('python3', [filename]);
          return { stdout: await result.stdout(), stderr: await result.stderr(), exitCode: result.exitCode };
        }
        const result = await sandbox.runCommand('npx', ['tsx', filename]);
        return { stdout: await result.stdout(), stderr: await result.stderr(), exitCode: result.exitCode };
      }

      case 'scrapeURL': {
        const { url, selectors } = payload as { url: string; selectors?: string[] };
        const code = `
          const res = await fetch('${url}');
          const html = await res.text();
          console.log(html.substring(0, 50000));
        `;
        await sandbox.writeFiles([{ path: '/scrape.ts', content: Buffer.from(code) }]);
        const result = await sandbox.runCommand('npx', ['tsx', '/scrape.ts']);
        return { stdout: await result.stdout(), stderr: await result.stderr() };
      }

      case 'processData': {
        const { data, operation, expression } = payload as {
          data: string;
          operation: string;
          expression?: string;
        };
        const code = `
          const data = ${data};
          const result = ${expression || `data.${operation}()`};
          console.log(JSON.stringify(result));
        `;
        await sandbox.writeFiles([{ path: '/process.ts', content: Buffer.from(code) }]);
        const result = await sandbox.runCommand('npx', ['tsx', '/process.ts']);
        return { stdout: await result.stdout() };
      }

      default:
        throw new Error(`Unknown sandbox tool: ${tool}`);
    }
  }

  /** Map flat tool names to VPS bridge category/name paths */
  private toolToBridgePath(tool: string): { category: string; name: string } {
    const map: Record<string, { category: string; name: string }> = {
      slackPost: { category: 'slack', name: 'postMessage' },
      slackHistory: { category: 'slack', name: 'pullMessages' },
      nmiCharge: { category: 'nmi', name: 'charge' },
      nmiQuery: { category: 'nmi', name: 'queryTransactions' },
      nmiVaultCreate: { category: 'nmi', name: 'vaultCreate' },
      base44Query: { category: 'base44', name: 'queryEntity' },
      base44Create: { category: 'base44', name: 'invokeFunction' },
      base44Invoke: { category: 'base44', name: 'invokeFunction' },
      // Generic fallback — first segment before dot/hyphen becomes category
    };
    if (map[tool]) return map[tool];
    // Fallback: split on first non-alphanumeric boundary
    const match = tool.match(/^([a-zA-Z0-9]+)/);
    const category = match ? match[1].toLowerCase() : 'misc';
    return { category, name: tool };
  }

  private async executeVpsBridge(req: ToolRequest): Promise<unknown> {
    const VPS_BRIDGE_URL = process.env.VPS_BRIDGE_URL || 'http://localhost:8400';
    const VPS_BRIDGE_TOKEN = process.env.NEPTUNE_INTERNAL_TOKEN || '';
    const { category, name } = this.toolToBridgePath(req.tool);

    const res = await fetch(`${VPS_BRIDGE_URL}/tool/${category}/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${VPS_BRIDGE_TOKEN}`,
      },
      body: JSON.stringify(req.payload),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`VPS bridge error: ${res.status} ${body.slice(0, 200)}`);
    }

    return res.json();
  }

  private async executeV2Handoff(req: ToolRequest): Promise<unknown> {
    const OPEN_AGENTS_URL = process.env.OPEN_AGENTS_URL || 'https://neptune-v2.vercel.app';
    const OPEN_AGENTS_API_KEY = process.env.OPEN_AGENTS_API_KEY || '';

    const res = await fetch(`${OPEN_AGENTS_URL}/api/runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPEN_AGENTS_API_KEY}`,
      },
      body: JSON.stringify({
        code: req.payload.code,
        runtime: req.payload.runtime || 'node',
        context: req.payload.context || {},
      }),
    });

    if (!res.ok) {
      throw new Error(`V2 handoff error: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    return { ...data, layer: 'v2_handoff' };
  }
}

// Singleton
export const sandboxOrchestrator = new SandboxOrchestrator();
