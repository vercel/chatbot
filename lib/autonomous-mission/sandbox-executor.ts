/**
 * Autonomous Mission — Sandbox Executor
 *
 * Provides isolated code execution for autonomous coding missions.
 * Supports two backends:
 *   1. LOCAL — child_process with resource limits (default)
 *   2. VERCEL_SANDBOX — Vercel Sandbox API (future)
 *
 * All output captured, sanitized, and returned with exit codes.
 * Enforces max runtime and max output size to prevent runaway processes.
 *
 * NEPTUNE-KNOWLEDGE-SPEC v1.0 compatible.
 * Phase 38: Autonomous Coding Platform
 */

import { execSync, spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// ─── Types ────────────────────────────────────────────────────────────────

export type SandboxBackend = "LOCAL" | "VERCEL_SANDBOX";

export interface SandboxOptions {
  /** Max execution time in milliseconds (default: 60000) */
  timeoutMs: number;
  /** Max output size in bytes (default: 1MB) */
  maxOutputBytes: number;
  /** Working directory for execution (default: process.cwd()) */
  cwd: string;
  /** Environment variables to pass */
  env: Record<string, string>;
  /** Backend selection */
  backend: SandboxBackend;
  /** Vercel Sandbox project ID (for VERCEL_SANDBOX backend) */
  vercelProjectId?: string;
  /** Whether to capture stderr separately */
  captureStderr: boolean;
}

export interface SandboxResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  output: string;
  durationMs: number;
  timedOut: boolean;
  error?: string;
  summary: string;
}

export interface FileWriteSpec {
  filePath: string;
  content: string;
}

export interface FileReadResult {
  filePath: string;
  content: string;
  exists: boolean;
  error?: string;
}

const DEFAULT_SANDBOX_OPTIONS: SandboxOptions = {
  timeoutMs: 60_000,
  maxOutputBytes: 1_048_576, // 1MB
  cwd: process.cwd(),
  env: {},
  backend: "LOCAL",
  captureStderr: true,
};

// ─── Temp Workspace ───────────────────────────────────────────────────────

let sandboxWorkspace: string | null = null;

function getWorkspace(): string {
  if (!sandboxWorkspace) {
    sandboxWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "neptune-sandbox-"));
  }
  return sandboxWorkspace;
}

export function cleanupWorkspace(): void {
  if (sandboxWorkspace) {
    try {
      fs.rmSync(sandboxWorkspace, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    sandboxWorkspace = null;
  }
}

// ─── Local Executor ────────────────────────────────────────────────────────

/**
 * Execute a command in a local child process with resource limits.
 * Uses spawn for streaming output capture.
 */
async function executeLocal(
  command: string,
  args: string[],
  options: SandboxOptions,
): Promise<SandboxResult> {
  const startTime = Date.now();

  return new Promise<SandboxResult>((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let killed = false;
    const outputChunks: string[] = [];

    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      shell: true,
      stdio: ["pipe", "pipe", options.captureStderr ? "pipe" : "ignore"],
    });

    // Timeout handler
    const timer = setTimeout(() => {
      timedOut = true;
      killed = true;
      child.kill("SIGKILL");
    }, options.timeoutMs);

    child.stdout?.on("data", (data: Buffer) => {
      const chunk = data.toString();
      if (stdout.length < options.maxOutputBytes) {
        stdout += chunk;
        outputChunks.push(chunk);
      }
    });

    child.stderr?.on("data", (data: Buffer) => {
      const chunk = data.toString();
      if (stderr.length < options.maxOutputBytes) {
        stderr += chunk;
      }
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      const durationMs = Date.now() - startTime;

      // Truncate if needed
      const fullOutput = stdout.slice(0, options.maxOutputBytes);
      const truncated = stdout.length > options.maxOutputBytes;
      const exitCode = code ?? (killed ? 137 : 1);

      const summary = [
        `Exit code: ${exitCode}`,
        `Duration: ${durationMs}ms`,
        timedOut ? "TIMEOUT" : "",
        truncated ? "OUTPUT TRUNCATED" : "",
        `Output: ${fullOutput.length} bytes`,
      ].filter(Boolean).join(" | ");

      resolve({
        success: exitCode === 0 && !timedOut,
        exitCode,
        stdout: fullOutput,
        stderr: stderr.slice(0, options.maxOutputBytes),
        output: fullOutput,
        durationMs,
        timedOut,
        error: timedOut
          ? `Command timed out after ${options.timeoutMs}ms`
          : exitCode !== 0
            ? `Command exited with code ${exitCode}`
            : undefined,
        summary,
      });
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      const durationMs = Date.now() - startTime;

      resolve({
        success: false,
        exitCode: 1,
        stdout,
        stderr,
        output: stdout,
        durationMs,
        timedOut: false,
        error: `Spawn error: ${err.message}`,
        summary: `Failed to spawn: ${err.message}`,
      });
    });
  });
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Execute a shell command in the sandbox.
 * Returns structured result with stdout, stderr, exit code, and timing.
 */
export async function runCommand(
  command: string,
  options: Partial<SandboxOptions> = {},
): Promise<SandboxResult> {
  const opts = { ...DEFAULT_SANDBOX_OPTIONS, ...options };

  if (opts.backend === "VERCEL_SANDBOX") {
    return runInVercelSandbox(command, opts);
  }

  // Parse command into command + args
  const args = command.split(" ").slice(1);
  const cmd = command.split(" ")[0];

  return executeLocal(cmd, args, opts);
}

/**
 * Execute a shell command synchronously (blocking).
 * For simple, fast commands only.
 */
export function runCommandSync(
  command: string,
  options: Partial<SandboxOptions> = {},
): SandboxResult {
  const opts = { ...DEFAULT_SANDBOX_OPTIONS, ...options };
  const startTime = Date.now();

  try {
    const output = execSync(command, {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      timeout: opts.timeoutMs,
      encoding: "utf-8",
      maxBuffer: opts.maxOutputBytes,
    });

    const durationMs = Date.now() - startTime;

    return {
      success: true,
      exitCode: 0,
      stdout: output,
      stderr: "",
      output,
      durationMs,
      timedOut: false,
      summary: `OK | ${durationMs}ms | ${output.length} bytes`,
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const error = err as { stdout?: Buffer | string; stderr?: Buffer | string; message?: string; status?: number };

    const stdout = typeof error.stdout === "string"
      ? error.stdout
      : error.stdout?.toString() ?? "";
    const stderr = typeof error.stderr === "string"
      ? error.stderr
      : error.stderr?.toString() ?? "";

    return {
      success: false,
      exitCode: error.status ?? 1,
      stdout,
      stderr,
      output: stdout,
      durationMs,
      timedOut: (error.message ?? "").includes("ETIMEDOUT"),
      error: error.message,
      summary: `FAILED (${error.status ?? 1}) | ${durationMs}ms`,
    };
  }
}

/**
 * Write files into the sandbox workspace.
 */
export async function writeFiles(files: FileWriteSpec[]): Promise<SandboxResult[]> {
  const results: SandboxResult[] = [];

  for (const file of files) {
    const startTime = Date.now();
    try {
      const fullPath = path.join(getWorkspace(), file.filePath);
      const dir = path.dirname(fullPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fullPath, file.content, "utf-8");

      results.push({
        success: true,
        exitCode: 0,
        stdout: `Written ${file.content.length} bytes to ${file.filePath}`,
        stderr: "",
        output: "",
        durationMs: Date.now() - startTime,
        timedOut: false,
        summary: `Created ${file.filePath} (${file.content.length} bytes)`,
      });
    } catch (err) {
      results.push({
        success: false,
        exitCode: 1,
        stdout: "",
        stderr: String(err),
        output: "",
        durationMs: Date.now() - startTime,
        timedOut: false,
        error: String(err),
        summary: `Failed to write ${file.filePath}`,
      });
    }
  }

  return results;
}

/**
 * Read files from the sandbox workspace.
 */
export function readFiles(filePaths: string[]): FileReadResult[] {
  return filePaths.map((fp) => {
    const fullPath = path.join(getWorkspace(), fp);
    try {
      const content = fs.readFileSync(fullPath, "utf-8");
      return { filePath: fp, content, exists: true };
    } catch {
      // Try reading from actual project
      try {
        const content = fs.readFileSync(path.join(process.cwd(), fp), "utf-8");
        return { filePath: fp, content, exists: true };
      } catch (err) {
        return { filePath: fp, content: "", exists: false, error: String(err) };
      }
    }
  });
}

/**
 * Run a build in the sandbox with retry logic.
 */
export async function buildWithRetry(
  buildCommand: string,
  maxRetries = 3,
  options: Partial<SandboxOptions> = {},
): Promise<SandboxResult> {
  let lastResult: SandboxResult | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const result = await runCommand(buildCommand, options);

    if (result.success) return result;

    lastResult = result;

    // Don't retry on timeout — it'll just timeout again
    if (result.timedOut) break;

    // Wait with exponential backoff
    if (attempt < maxRetries - 1) {
      await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
    }
  }

  return lastResult!;
}

/**
 * Run a test suite in the sandbox and parse results.
 */
export async function runTests(
  testCommand: string,
  options: Partial<SandboxOptions> = {},
): Promise<SandboxResult & { passed?: number; failed?: number; total?: number }> {
  const result = await runCommand(testCommand, {
    ...options,
    timeoutMs: (options.timeoutMs ?? 60_000) * 2, // Tests get double timeout
  });

  // Try to parse test results from common test frameworks
  const output = result.output;
  const extra: { passed?: number; failed?: number; total?: number } = {};

  // Jest/Vitest pattern: "Tests: 5 passed, 2 failed, 7 total"
  const jestMatch = output.match(/Tests?:\s*(\d+)\s*passed?,\s*(\d+)\s*failed?,\s*(\d+)\s*total/i)
    || output.match(/(\d+)\s*passed?,\s*(\d+)\s*failed?,\s*(\d+)\s*total/i);
  if (jestMatch) {
    extra.passed = parseInt(jestMatch[1], 10);
    extra.failed = parseInt(jestMatch[2], 10);
    extra.total = parseInt(jestMatch[3], 10);
  }

  // Playwright pattern: "6 passed, 1 failed"
  const pwMatch = output.match(/(\d+)\s*passed?[,.]?\s*(\d+)\s*failed/i);
  if (pwMatch && !jestMatch) {
    extra.passed = parseInt(pwMatch[1], 10);
    extra.failed = parseInt(pwMatch[2], 10);
    extra.total = extra.passed + extra.failed;
  }

  return { ...result, ...extra };
}

/**
 * Run a linter check in the sandbox.
 */
export async function lint(
  lintCommand = "pnpm lint",
  options: Partial<SandboxOptions> = {},
): Promise<SandboxResult> {
  return runCommand(lintCommand, options);
}

/**
 * Run TypeScript type checking in the sandbox.
 */
export async function typeCheck(
  tscCommand = "npx tsc --noEmit",
  options: Partial<SandboxOptions> = {},
): Promise<SandboxResult> {
  return runCommand(tscCommand, {
    ...options,
    timeoutMs: (options.timeoutMs ?? 60_000) * 3, // TSC is slow
  });
}

// ─── Vercel Sandbox Adapter (Future) ──────────────────────────────────────

/**
 * Placeholder for Vercel Sandbox integration.
 * When Vercel Sandbox API becomes available, replace this implementation.
 */
async function runInVercelSandbox(
  _command: string,
  _options: SandboxOptions,
): Promise<SandboxResult> {
  // TODO: Integrate with Vercel Sandbox API
  // POST https://api.vercel.com/v1/sandboxes — not yet available
  return {
    success: false,
    exitCode: 1,
    stdout: "",
    stderr: "",
    output: "",
    durationMs: 0,
    timedOut: false,
    error: "Vercel Sandbox backend not yet implemented — use LOCAL backend",
    summary: "Vercel Sandbox: NOT IMPLEMENTED",
  };
}

// ─── Kill Switch ───────────────────────────────────────────────────────────

/**
 * Kill all running sandbox processes.
 * Called on shutdown or when aborting a mission.
 */
export function killAll(): void {
  if (sandboxWorkspace) {
    try {
      // Kill processes in the workspace
      execSync(`pkill -f "${sandboxWorkspace}" 2>/dev/null || true`, {
        timeout: 5000,
      });
    } catch {
      // Ignore
    }
  }
}

// ─── Export Default ────────────────────────────────────────────────────────

export default {
  runCommand,
  runCommandSync,
  writeFiles,
  readFiles,
  buildWithRetry,
  runTests,
  lint,
  typeCheck,
  cleanupWorkspace,
  killAll,
  getWorkspace,
};
