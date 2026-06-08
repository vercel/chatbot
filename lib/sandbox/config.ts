/**
 * Sandbox configuration — Hobby tier limits enforced.
 * Cardinals: CONCURRENT <10, AUTO-DESTROY 5min idle, AUDIT every spawn.
 */
export const SANDBOX_LIMITS = {
  MAX_CONCURRENT: 8, // Enforced <10 (Hobby tier)
  MAX_DURATION_MS: 45 * 60_000, // 45 min max
  DEFAULT_TIMEOUT_MS: 5 * 60_000, // 5 min default
  MAX_VCPUS: 4,
  DEFAULT_VCPUS: 2,
  CREATIONS_PER_MONTH: 5000,
  ACTIVE_CPU_HOURS: 5,
  MEMORY_GB_HOURS: 420,
  DATA_TRANSFER_GB: 20,
  STORAGE_GB_LIFETIME: 15,
} as const;

export const SANDBOX_CONFIG = {
  RUNTIME: "node24" as const,
  PERSIST: {
    ENABLED: false, // Default ephemeral for tools
    KEEP_LAST: { count: 1, deleteEvicted: true },
  },
  IDLE_TIMEOUT_MS: 5 * 60_000, // Auto-destroy after 5 min idle
  QUEUE_TIMEOUT_MS: 30_000, // Queue timeout
  LRU_MAX_PERSISTENT: 8, // Max persistent sandboxes in LRU
} as const;
