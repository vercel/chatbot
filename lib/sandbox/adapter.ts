/**
 * Sandbox Adapter — Eve Pattern Adoption (Dimension 12)
 *
 * Implements Eve's defineSandbox({ backend }) adapter pattern:
 *  - Backend-agnostic interface
 *  - Pluggable providers: Vercel Sandbox, E2B, Local/Bash
 *  - Swap adapters without changing execution logic
 *
 * Non-breaking: existing sandbox manager continues to work.
 * This adapter wraps it for Eve compatibility.
 *
 * Pattern: defineSandbox from Eve
 * Phase 38: Autonomous Coding Platform
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type SandboxBackend = "vercel" | "e2b" | "local" | "docker";

export interface SandboxAdapterConfig {
  backend: SandboxBackend;
  timeoutMs?: number;
  maxVcpus?: number;
  memoryMb?: number;
  env?: Record<string, string>;
  persist?: boolean;
  idleTimeoutMs?: number;
}

export interface SandboxExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  durationMs: number;
  sandboxId?: string;
}

export interface SandboxAdapter {
  readonly backend: SandboxBackend;
  readonly config: SandboxAdapterConfig;

  /** Create a new sandbox instance */
  create(): Promise<{ sandboxId: string }>;

  /** Execute code/command in the sandbox */
  execute(
    sandboxId: string,
    command: string,
    options?: {
      cwd?: string;
      env?: Record<string, string>;
      timeoutMs?: number;
    },
  ): Promise<SandboxExecutionResult>;

  /** Write a file to the sandbox */
  writeFile(
    sandboxId: string,
    path: string,
    content: string,
  ): Promise<{ success: boolean }>;

  /** Read a file from the sandbox */
  readFile(
    sandboxId: string,
    path: string,
  ): Promise<{ success: boolean; content?: string }>;

  /** Destroy the sandbox */
  destroy(sandboxId: string): Promise<void>;

  /** Health check */
  health(): Promise<boolean>;
}

// ─── Vercel Sandbox Adapter ───────────────────────────────────────────────────

class VercelSandboxAdapter implements SandboxAdapter {
  readonly backend: SandboxBackend = "vercel";
  readonly config: SandboxAdapterConfig;
  private sandboxes: Map<string, { sandbox: unknown }> = new Map();

  constructor(config: SandboxAdapterConfig) {
    this.config = {
      timeoutMs: 300_000,
      maxVcpus: 2,
      memoryMb: 1024,
      idleTimeoutMs: 300_000,
      ...config,
    };
  }

  async create(): Promise<{ sandboxId: string }> {
    try {
      // Use @vercel/sandbox when available
      const { Sandbox } = await import("@vercel/sandbox");
      const sandbox = await Sandbox.create({
        runtime: "node24",
        timeout: this.config.timeoutMs,
        env: this.config.env,
      } as Parameters<typeof Sandbox.create>[0]);

      const sandboxId = `vercel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      this.sandboxes.set(sandboxId, { sandbox });
      return { sandboxId };
    } catch (err) {
      throw new Error(`Vercel Sandbox creation failed: ${(err as Error).message}`);
    }
  }

  async execute(
    sandboxId: string,
    command: string,
    options?: { cwd?: string; env?: Record<string, string>; timeoutMs?: number },
  ): Promise<SandboxExecutionResult> {
    const start = Date.now();

    try {
      const entry = this.sandboxes.get(sandboxId);
      if (!entry) return { success: false, error: "Sandbox not found", durationMs: Date.now() - start };

      // @ts-expect-error - dynamic sandbox interface
      const result = await entry.sandbox.runCommand(command, {
        cwd: options?.cwd || "/",
        env: options?.env,
        timeoutMs: options?.timeoutMs || this.config.timeoutMs,
      });

      return {
        success: result.exitCode === 0,
        output: result.stdout || result.output || "",
        error: result.stderr || result.error,
        durationMs: Date.now() - start,
        sandboxId,
      };
    } catch (err) {
      return {
        success: false,
        error: (err as Error).message,
        durationMs: Date.now() - start,
        sandboxId,
      };
    }
  }

  async writeFile(sandboxId: string, path: string, content: string): Promise<{ success: boolean }> {
    try {
      const entry = this.sandboxes.get(sandboxId);
      if (!entry) return { success: false };

      // @ts-expect-error - dynamic sandbox interface
      await entry.sandbox.writeFile(path, content);
      return { success: true };
    } catch {
      return { success: false };
    }
  }

  async readFile(sandboxId: string, path: string): Promise<{ success: boolean; content?: string }> {
    try {
      const entry = this.sandboxes.get(sandboxId);
      if (!entry) return { success: false };

      // @ts-expect-error - dynamic sandbox interface
      const content = await entry.sandbox.readFile(path);
      return { success: true, content };
    } catch {
      return { success: false };
    }
  }

  async destroy(sandboxId: string): Promise<void> {
    const entry = this.sandboxes.get(sandboxId);
    if (entry) {
      try {
        // @ts-expect-error - dynamic sandbox interface
        await entry.sandbox.destroy();
      } catch {
        // Sandbox already destroyed
      }
      this.sandboxes.delete(sandboxId);
    }
  }

  async health(): Promise<boolean> {
    try {
      const { sandboxId } = await this.create();
      await this.destroy(sandboxId);
      return true;
    } catch {
      return false;
    }
  }
}

// ─── Local/Bash Sandbox Adapter ───────────────────────────────────────────────

class LocalSandboxAdapter implements SandboxAdapter {
  readonly backend: SandboxBackend = "local";
  readonly config: SandboxAdapterConfig;
  private sandboxes: Map<string, { id: string }> = new Map();

  constructor(config: SandboxAdapterConfig) {
    this.config = { timeoutMs: 300_000, ...config };
  }

  async create(): Promise<{ sandboxId: string }> {
    const sandboxId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    this.sandboxes.set(sandboxId, { id: sandboxId });
    return { sandboxId };
  }

  async execute(
    sandboxId: string,
    command: string,
    options?: { cwd?: string; env?: Record<string, string>; timeoutMs?: number },
  ): Promise<SandboxExecutionResult> {
    const start = Date.now();

    try {
      const { execSync } = await import("node:child_process");
      const output = execSync(command, {
        cwd: options?.cwd || process.cwd(),
        encoding: "utf-8",
        timeout: options?.timeoutMs || this.config.timeoutMs,
        env: { ...process.env, ...options?.env },
      });
      return {
        success: true,
        output,
        durationMs: Date.now() - start,
        sandboxId,
      };
    } catch (err) {
      const output = (err as { stdout?: string; stderr?: string; message?: string }).stderr ||
                    (err as { message?: string }).message || String(err);
      return {
        success: false,
        error: output,
        durationMs: Date.now() - start,
        sandboxId,
      };
    }
  }

  async writeFile(sandboxId: string, path: string, content: string): Promise<{ success: boolean }> {
    try {
      const { writeFile, mkdir } = await import("node:fs/promises");
      const dir = path.substring(0, path.lastIndexOf("/"));
      await mkdir(dir, { recursive: true }).catch(() => {});
      await writeFile(path, content, "utf-8");
      return { success: true };
    } catch {
      return { success: false };
    }
  }

  async readFile(sandboxId: string, path: string): Promise<{ success: boolean; content?: string }> {
    try {
      const { readFile } = await import("node:fs/promises");
      const content = await readFile(path, "utf-8");
      return { success: true, content };
    } catch {
      return { success: false };
    }
  }

  async destroy(_sandboxId: string): Promise<void> {
    this.sandboxes.delete(_sandboxId);
  }

  async health(): Promise<boolean> {
    return true; // Local is always available
  }
}

// ─── E2B Sandbox Adapter ──────────────────────────────────────────────────────

class E2BSandboxAdapter implements SandboxAdapter {
  readonly backend: SandboxBackend = "e2b";
  readonly config: SandboxAdapterConfig;

  constructor(config: SandboxAdapterConfig) {
    this.config = {
      timeoutMs: 600_000,
      maxVcpus: 4,
      memoryMb: 2048,
      ...config,
    };
  }

  async create(): Promise<{ sandboxId: string }> {
    try {
      const secret = process.env.E2B_API_KEY;
      if (!secret) throw new Error("E2B_API_KEY not set");

      const res = await fetch("https://api.e2b.dev/sandboxes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": secret,
        },
        body: JSON.stringify({
          template: "base",
          timeout_ms: this.config.timeoutMs,
        }),
      });

      if (!res.ok) throw new Error(`E2B returned ${res.status}`);
      const data = await res.json();
      return { sandboxId: data.sandbox_id || data.sandboxId };
    } catch (err) {
      throw new Error(`E2B sandbox creation failed: ${(err as Error).message}`);
    }
  }

  async execute(
    sandboxId: string,
    command: string,
    options?: { cwd?: string; env?: Record<string, string>; timeoutMs?: number },
  ): Promise<SandboxExecutionResult> {
    const start = Date.now();

    try {
      const secret = process.env.E2B_API_KEY;
      if (!secret) return { success: false, error: "E2B_API_KEY not set", durationMs: Date.now() - start };

      const res = await fetch(
        `https://api.e2b.dev/sandboxes/${sandboxId}/commands`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": secret,
          },
          body: JSON.stringify({
            cmd: command,
            cwd: options?.cwd,
            env_vars: options?.env,
            timeout_ms: options?.timeoutMs || this.config.timeoutMs,
          }),
        },
      );

      if (!res.ok) {
        return { success: false, error: `E2B returned ${res.status}`, durationMs: Date.now() - start };
      }

      const data = await res.json();
      return {
        success: (data.exit_code ?? data.exitCode) === 0,
        output: data.stdout || data.output || "",
        error: data.stderr || data.error,
        durationMs: Date.now() - start,
        sandboxId,
      };
    } catch (err) {
      return {
        success: false,
        error: (err as Error).message,
        durationMs: Date.now() - start,
        sandboxId,
      };
    }
  }

  async writeFile(sandboxId: string, path: string, content: string): Promise<{ success: boolean }> {
    try {
      const secret = process.env.E2B_API_KEY;
      if (!secret) return { success: false };

      const res = await fetch(
        `https://api.e2b.dev/sandboxes/${sandboxId}/files`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": secret,
          },
          body: JSON.stringify({ path, content }),
        },
      );
      return { success: res.ok };
    } catch {
      return { success: false };
    }
  }

  async readFile(sandboxId: string, path: string): Promise<{ success: boolean; content?: string }> {
    try {
      const secret = process.env.E2B_API_KEY;
      if (!secret) return { success: false };

      const res = await fetch(
        `https://api.e2b.dev/sandboxes/${sandboxId}/files?path=${encodeURIComponent(path)}`,
        { headers: { "X-API-Key": secret } },
      );
      if (!res.ok) return { success: false };
      const data = await res.json();
      return { success: true, content: data.content };
    } catch {
      return { success: false };
    }
  }

  async destroy(sandboxId: string): Promise<void> {
    try {
      const secret = process.env.E2B_API_KEY;
      if (!secret) return;
      await fetch(`https://api.e2b.dev/sandboxes/${sandboxId}`, {
        method: "DELETE",
        headers: { "X-API-Key": secret },
      });
    } catch {
      // Already destroyed
    }
  }

  async health(): Promise<boolean> {
    try {
      const { sandboxId } = await this.create();
      await this.destroy(sandboxId);
      return true;
    } catch {
      return false;
    }
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * defineSandbox — Eve-compatible sandbox adapter factory.
 *
 * Usage:
 *   const sandbox = defineSandbox({ backend: "vercel" });
 *   const { sandboxId } = await sandbox.create();
 *   const result = await sandbox.execute(sandboxId, "npm test");
 *   await sandbox.destroy(sandboxId);
 */
export function defineSandbox(config: SandboxAdapterConfig): SandboxAdapter {
  switch (config.backend) {
    case "e2b":
      return new E2BSandboxAdapter(config);
    case "local":
      return new LocalSandboxAdapter(config);
    case "vercel":
    default:
      return new VercelSandboxAdapter(config);
  }
}

/**
 * Auto-detect the best available sandbox backend.
 * Priority: Vercel Sandbox (if VERCEL_ENV) → E2B (if E2B_API_KEY) → Local
 */
export function autoDetectSandboxBackend(): SandboxBackend {
  if (process.env.VERCEL_ENV) return "vercel";
  if (process.env.E2B_API_KEY) return "e2b";
  return "local";
}

/**
 * Create a sandbox adapter with auto-detected backend.
 */
export function createDefaultSandbox(config?: Partial<SandboxAdapterConfig>): SandboxAdapter {
  return defineSandbox({
    backend: autoDetectSandboxBackend(),
    ...config,
  });
}
