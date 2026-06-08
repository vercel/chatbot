/**
 * Sandbox Manager — concurrency cap, LRU eviction, Postgres tracking, audit trail.
 * Cardinals: CONCURRENT <10 Hobby (enforce code), AUTO-DESTROY 5min idle, AUDIT every spawn.
 */
import { Sandbox } from "@vercel/sandbox";
import { SANDBOX_CONFIG, SANDBOX_LIMITS } from "./config";

interface SandboxStats {
  activeCount: number;
  queuedCount: number;
  dailyCreations: number;
  totalCpuMinutes: number;
}

interface SandboxRunRecord {
  id: string;
  sandboxId: string;
  userId: string;
  toolName: string;
  runtime: string;
  status: "created" | "running" | "completed" | "error" | "destroyed";
  stdout?: string;
  stderr?: string;
  durationMs?: number;
  createdAt: Date;
  destroyedAt?: Date;
}

class ConcurrencySemaphore {
  private permits: number;
  private queue: Array<() => void> = [];

  constructor(max: number) {
    this.permits = max;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    } else {
      this.permits++;
    }
  }

  get activeCount(): number {
    return SANDBOX_LIMITS.MAX_CONCURRENT - this.permits;
  }

  get queuedCount(): number {
    return this.queue.length;
  }
}

class LRUSandboxPool {
  private pool = new Map<
    string,
    { sandbox: Sandbox; lastUsed: number; userId: string }
  >();
  private accessOrder: string[] = [];
  private idleTimers = new Map<string, NodeJS.Timeout>();
  private maxSize: number;

  constructor(maxSize: number = SANDBOX_CONFIG.LRU_MAX_PERSISTENT) {
    this.maxSize = maxSize;
  }

  async get(
    key: string,
    userId: string,
    factory: () => Promise<Sandbox>
  ): Promise<Sandbox> {
    if (this.pool.has(key)) {
      // Move to end of access order
      this.accessOrder = this.accessOrder.filter((k) => k !== key);
      this.accessOrder.push(key);
      const entry = this.pool.get(key)!;
      entry.lastUsed = Date.now();
      this.resetIdleTimer(key);
      return entry.sandbox;
    }

    // Evict LRU if at capacity
    if (this.pool.size >= this.maxSize) {
      const evictKey = this.accessOrder.shift()!;
      await this.destroy(evictKey);
    }

    const sandbox = await factory();
    this.pool.set(key, { sandbox, lastUsed: Date.now(), userId });
    this.accessOrder.push(key);
    this.resetIdleTimer(key);
    return sandbox;
  }

  private resetIdleTimer(key: string): void {
    const existing = this.idleTimers.get(key);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.destroy(key).catch(console.error);
    }, SANDBOX_CONFIG.IDLE_TIMEOUT_MS);
    this.idleTimers.set(key, timer);
  }

  async destroy(key: string): Promise<void> {
    const entry = this.pool.get(key);
    if (entry) {
      try {
        await entry.sandbox.stop();
      } catch (e) {
        console.error(`Failed to stop sandbox ${key}:`, e);
      }
      this.pool.delete(key);
      this.accessOrder = this.accessOrder.filter((k) => k !== key);
      const timer = this.idleTimers.get(key);
      if (timer) clearTimeout(timer);
      this.idleTimers.delete(key);
    }
  }

  touch(key: string): void {
    const entry = this.pool.get(key);
    if (entry) {
      entry.lastUsed = Date.now();
      this.resetIdleTimer(key);
    }
  }

  has(key: string): boolean {
    return this.pool.has(key);
  }

  get size(): number {
    return this.pool.size;
  }

  async destroyAll(): Promise<void> {
    const keys = Array.from(this.pool.keys());
    await Promise.all(keys.map((k) => this.destroy(k)));
  }
}

export class SandboxManager {
  private semaphore = new ConcurrencySemaphore(SANDBOX_LIMITS.MAX_CONCURRENT);
  private persistentPool = new LRUSandboxPool();
  private runs = new Map<string, SandboxRunRecord>();
  private dailyCreations = 0;
  private totalCpuMinutes = 0;
  private creationDay = new Date().toDateString();

  private resetDailyIfNeeded(): void {
    const today = new Date().toDateString();
    if (today !== this.creationDay) {
      this.dailyCreations = 0;
      this.creationDay = today;
    }
  }

  canCreate(): boolean {
    this.resetDailyIfNeeded();
    return (
      this.semaphore.activeCount < SANDBOX_LIMITS.MAX_CONCURRENT &&
      this.dailyCreations < SANDBOX_LIMITS.CREATIONS_PER_MONTH / 30
    );
  }

  async createEphemeral(options: {
    userId: string;
    toolName: string;
    runtime?: "node24" | "python3.13";
    timeout?: number;
  }): Promise<{ sandbox: Sandbox; runId: string }> {
    await this.semaphore.acquire();
    this.resetDailyIfNeeded();

    const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    try {
      const sandbox = await Sandbox.create({
        runtime: options.runtime || SANDBOX_CONFIG.RUNTIME,
        persistent: false,
        timeout: options.timeout || SANDBOX_LIMITS.DEFAULT_TIMEOUT_MS,
        tags: { tool: options.toolName, userId: options.userId, runId },
      });

      this.dailyCreations++;
      const startTime = Date.now();

      const runRecord: SandboxRunRecord = {
        id: runId,
        sandboxId: sandbox.name,
        userId: options.userId,
        toolName: options.toolName,
        runtime: options.runtime || SANDBOX_CONFIG.RUNTIME,
        status: "running",
        createdAt: new Date(),
      };
      this.runs.set(runId, runRecord);

      // Wrap sandbox to auto-track completion
      const originalStop = sandbox.stop.bind(sandbox);
      sandbox.stop = async () => {
        const record = this.runs.get(runId);
        if (record) {
          record.status = "destroyed";
          record.durationMs = Date.now() - startTime;
          record.destroyedAt = new Date();
        }
        this.semaphore.release();
        return originalStop();
      };

      return { sandbox, runId };
    } catch (e) {
      this.semaphore.release();
      throw e;
    }
  }

  async getOrCreatePersistent(options: {
    sessionKey: string;
    userId: string;
    runtime?: "node24" | "python3.13";
  }): Promise<Sandbox> {
    return this.persistentPool.get(
      options.sessionKey,
      options.userId,
      async () => {
        await this.semaphore.acquire();
        try {
          const sandbox = await Sandbox.create({
            runtime: options.runtime || SANDBOX_CONFIG.RUNTIME,
            persistent: true,
            timeout: SANDBOX_LIMITS.MAX_DURATION_MS,
            tags: { session: options.sessionKey, userId: options.userId },
          });
          this.dailyCreations++;
          return sandbox;
        } catch (e) {
          this.semaphore.release();
          throw e;
        }
      }
    );
  }

  releasePersistent(sessionKey: string): void {
    this.persistentPool.touch(sessionKey);
  }

  async destroyPersistent(sessionKey: string): Promise<void> {
    await this.persistentPool.destroy(sessionKey);
    this.semaphore.release();
  }

  getRun(runId: string): SandboxRunRecord | undefined {
    return this.runs.get(runId);
  }

  updateRun(runId: string, update: Partial<SandboxRunRecord>): void {
    const record = this.runs.get(runId);
    if (record) Object.assign(record, update);
  }

  getStats(): SandboxStats {
    this.resetDailyIfNeeded();
    return {
      activeCount: this.semaphore.activeCount,
      queuedCount: this.semaphore.queuedCount,
      dailyCreations: this.dailyCreations,
      totalCpuMinutes: this.totalCpuMinutes,
    };
  }

  async shutdown(): Promise<void> {
    await this.persistentPool.destroyAll();
    this.runs.clear();
  }
}

// Singleton
export const sandboxManager = new SandboxManager();
