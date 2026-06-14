"use client";

/**
 * hooks/use-canvas-synthesis.ts — SWR hook for canvas synthesis data.
 *
 * Phase 16.C: Fetches synthesized data from /api/canvas/synthesize/[type]/[name].
 * Uses SWR with 5-min stale-while-revalidate caching.
 */

import useSWR, { type SWRResponse } from "swr";
import type { SynthesisResponse } from "@/lib/canvas/types";

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error(`Canvas synthesis failed: ${res.status}`);
    return res.json();
  });

/**
 * Fetches synthesized data for a given library item.
 *
 * @param type - The entity type (connector, skill, function, playbook, workflow, wiki)
 * @param name - The entity name
 * @returns SWR response with SynthesisResponse data
 */
export function useCanvasSynthesis(
  type: string,
  name: string,
): SWRResponse<SynthesisResponse> {
  const key = type && name ? `/api/canvas/synthesize/${type}/${encodeURIComponent(name)}` : null;

  return useSWR<SynthesisResponse>(key, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 60_000, // 1 min
    errorRetryCount: 2,
    errorRetryInterval: 5_000,
  });
}

/**
 * Fetches the enriched library graph (for Library Overview + KG Explorer).
 */
export function useEnrichedLibraryGraph(): SWRResponse<{
  nodes: unknown[];
  edges: unknown[];
  summary: Record<string, unknown>;
  usage: Record<string, unknown>;
  recent: unknown[];
}> {
  return useSWR("/api/library/graph?enrich=usage", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 120_000, // 2 min
    errorRetryCount: 2,
  });
}
