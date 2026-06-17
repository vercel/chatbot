---
name: deep-research
version: 1.0.0
domain: planning-research
connector: neptune
scope: planning-research-suite
priority: P0
intent_tags:
  - research
  - investigate
  - explore
  - compare
  - deep dive
  - learn
  - survey
  - background
associated_skills:
  - source-synthesis
  - draft-prd
  - save-to-cortex
parallel_sources:
  - tavilySearch
  - exaSearch
  - githubCodeSearch
  - webSearch
  - smitheryMcpSearch
per_source_timeout_ms: 30000
min_sources_required: 2
headline: |
  Parallel multi-source research engine. Fires 5 sources simultaneously
  (Tavily, Exa, GitHub, Web, Smithery) with 30s per-source timeout.
  Synthesizes results ranked by confidence + recency + relevance.
type: "skill"
access: internal
---

# Deep Research — Parallel Multi-Source Synthesis

## Core Intent

Execute comprehensive research by querying 5 independent sources in parallel,
merging results with confidence-weighted synthesis. Gracefully handles source
failures — if a source times out or errors, it's skipped rather than blocking
the entire research operation.

## Prerequisites

- At least 2 sources must be available (webSearch and githubCodeSearch are always available)
- Optional: TAVILY_API_KEY, EXA_API_KEY, SMITHERY_API_KEY for additional sources
- API keys staged via Chat Vercel REST API (not hardcoded)

## Action Catalog

### Research Execution (3 actions)

| # | Action | Description |
|---|--------|-------------|
| 1 | `research.execute` | Fire all configured sources in parallel |
| 2 | `research.single_source` | Query a specific source individually |
| 3 | `research.check_sources` | Check which sources are available/configured |

### Synthesis (3 actions)

| 4 | `synthesis.rank` | Rank results by confidence (0.4) + recency (0.3) + relevance (0.3) |
| 5 | `synthesis.merge` | Merge overlapping findings, flag contradictions |
| 6 | `synthesis.format` | Produce structured output: findings, sources, confidence, recommendations |

### Configuration (2 actions)

| 7 | `config.set_key` | Stage API key via Vercel REST API |
| 8 | `config.status` | Report which sources are active and which are missing keys |

## Procedure

1. Define the research question with sufficient precision (scope narrows results)
2. Check available sources via `research.check_sources`
3. If sources < min_sources_required, warn user and proceed with available sources
4. Fire `research.execute` with the scoped query — all sources run in Promise.all
5. Each source has 30s timeout — failed sources are skipped with graceful fallback
6. Run `synthesis.rank` on collected results using weighted scoring
7. Run `synthesis.merge` to consolidate overlapping findings
8. Run `synthesis.format` to produce the structured output
9. Optionally cross-reference with cortex via `save-to-cortex` skill
10. Return structured output to the caller

## Structured Output Schema

```typescript
interface ResearchOutput {
  query: string;
  findings: Array<{
    key_finding: string;
    confidence: number;  // 0.0-1.0
    sources: string[];   // which sources support this finding
    evidence: string;    // excerpt or summary
  }>;
  sources: Array<{
    name: string;
    status: "success" | "timeout" | "error" | "skipped";
    result_count: number;
    confidence: number;
    response_time_ms: number;
  }>;
  overall_confidence: number;  // weighted average
  recommendations: string[];
  contradictions: Array<{
    topic: string;
    positions: Array<{source: string; claim: string}>;
    resolution: string;
  }>;
  generated_at: string;
  query_time_ms: number;
}
```

## Anti-Patterns

- DON'T research from a single source — parallel is the default
- DON'T skip the synthesis step — raw results are not actionable
- DON'T hardcode API keys — always use Vercel REST API env var staging
- DON'T block on failed sources — graceful skip, don't fail the whole operation
- DON'T exceed 30s per source — timeout protection is mandatory
- DON'T return results without confidence scores — every finding must be scored

## Error Handling

- Source timeout → mark as "timeout", continue with other sources
- Source error → mark as "error", log error message, continue
- All sources fail → return error with diagnostic information
- < min_sources_required available → warn, proceed with available sources
- Missing API key → mark source as "skipped", suggest staging via Vercel REST API

## Smoke Test

Query: "compare AI SDK 6 vs LangChain 2"
Expected: At least 2 sources return results, synthesis produces comparison table,
overall_confidence >= 0.4, response time < 35s
