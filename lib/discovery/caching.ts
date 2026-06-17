/**
 * lib/discovery/caching.ts
 * Phase 38 Stream 0 — In-Memory Response Cache
 *
 * Simple in-memory cache for NMI responses, Base44 queries, and user name lookups.
 * TTL-based expiration. Used within a single discovery run to avoid redundant API calls.
 */

import type { CacheEntry, PulledCustomerData, Base44Snapshot, NmiSnapshot } from "./types";

// ── Cache Stores ─────────────────────────────────────────────────

const nmiCache = new Map<string, CacheEntry<NmiSnapshot>>();
const base44Cache = new Map<string, CacheEntry<Base44Snapshot>>();
const pullCache = new Map<string, CacheEntry<PulledCustomerData>>();

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ── Generic Cache Operations ─────────────────────────────────────

export function getCached<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string
): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > entry.ttlMs) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCache<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  data: T,
  ttlMs: number = DEFAULT_TTL_MS
): void {
  cache.set(key, {
    data,
    cachedAt: Date.now(),
    ttlMs,
  });

  // Prevent unbounded growth: evict oldest if >500 entries
  if (cache.size > 500) {
    const oldest = Array.from(cache.entries()).sort(
      (a, b) => a[1].cachedAt - b[1].cachedAt
    )[0];
    if (oldest) cache.delete(oldest[0]);
  }
}

export function clearCache<T>(
  cache: Map<string, CacheEntry<T>>
): void {
  cache.clear();
}

// ── Specialized Cache Functions ──────────────────────────────────

export function getCachedNmi(customerId: string): NmiSnapshot | null {
  return getCached(nmiCache, customerId);
}

export function setCachedNmi(customerId: string, data: NmiSnapshot): void {
  setCache(nmiCache, customerId, data);
}

export function getCachedBase44(customerId: string): Base44Snapshot | null {
  return getCached(base44Cache, customerId);
}

export function setCachedBase44(customerId: string, data: Base44Snapshot): void {
  setCache(base44Cache, customerId, data);
}

export function getCachedPull(customerId: string): PulledCustomerData | null {
  return getCached(pullCache, customerId);
}

export function setCachedPull(customerId: string, data: PulledCustomerData): void {
  setCache(pullCache, customerId, data);
}

// ── Cache Management ─────────────────────────────────────────────

export function clearAllCaches(): void {
  clearCache(nmiCache);
  clearCache(base44Cache);
  clearCache(pullCache);
}

export function getCacheStats(): {
  nmi: number;
  base44: number;
  pull: number;
} {
  const now = Date.now();
  // Clean expired entries
  for (const [key, entry] of Array.from(nmiCache)) {
    if (now - entry.cachedAt > entry.ttlMs) nmiCache.delete(key);
  }
  for (const [key, entry] of Array.from(base44Cache)) {
    if (now - entry.cachedAt > entry.ttlMs) base44Cache.delete(key);
  }
  for (const [key, entry] of Array.from(pullCache)) {
    if (now - entry.cachedAt > entry.ttlMs) pullCache.delete(key);
  }

  return {
    nmi: nmiCache.size,
    base44: base44Cache.size,
    pull: pullCache.size,
  };
}
