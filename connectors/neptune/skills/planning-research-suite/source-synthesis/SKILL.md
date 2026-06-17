---
name: source-synthesis
version: 1.0.0
domain: planning-research
connector: neptune
scope: planning-research-suite
priority: P1
intent_tags:
  - synthesize
  - combine
  - merge
  - consolidate
  - summary
  - bring together
  - unify
associated_skills:
  - deep-research
  - save-to-cortex
headline: |
  Weighted merge of multiple research sources into a unified synthesis.
  Ranks sources by confidence (0.4) + recency (0.3) + relevance (0.3),
  resolves contradictions, and produces confidence-weighted recommendations.
type: "skill"
---

# Source Synthesis — Weighted Multi-Source Merge

## Core Intent

Take raw outputs from multiple research sources (deep-research skill) and
synthesize them into a single, coherent, confidence-weighted output. Handle
overlapping findings, contradictory claims, and varying source quality.

## Weighting Model

| Factor | Weight | Rationale |
|--------|--------|-----------|
| Confidence | 0.4 | How reliable is this source? (API quality, track record) |
| Recency | 0.3 | How fresh is the information? (newer = more relevant) |
| Relevance | 0.3 | How closely does it match the query? (semantic similarity) |

Score = (confidence × 0.4) + (recency × 0.3) + (relevance × 0.3)

## Action Catalog

### Processing (4 actions)

| # | Action | Description |
|---|--------|-------------|
| 1 | `synth.rank` | Score each source by confidence + recency + relevance |
| 2 | `synth.cluster` | Group similar findings across sources |
| 3 | `synth.resolve_contradictions` | Identify and resolve conflicting claims |
| 4 | `synth.merge` | Merge overlapping findings into unified entries |

### Output (3 actions)

| 5 | `synth.generate_findings` | Produce structured findings array |
| 6 | `synth.generate_recommendations` | Produce confidence-weighted recommendations |
| 7 | `synth.format` | Format complete synthesis output |

## Procedure

1. Collect all research outputs from deep-research or other sources
2. Score each source: confidence × 0.4 + recency × 0.3 + relevance × 0.3
3. Cluster similar findings: group claims about the same topic
4. Within each cluster, merge overlapping claims
5. Resolve contradictions: where sources disagree, note the conflict and weigh by source score
6. Generate findings: each with key_finding, confidence, supporting sources, evidence
7. Generate recommendations: actionable next steps, confidence-weighted
8. Return structured synthesis output
9. Optionally save to jarvis/cortex/ for reuse

## Contradiction Resolution Strategy

1. **Majority rule**: If 3+ sources agree, preference to majority
2. **Confidence tiebreaker**: Higher confidence source wins
3. **Recency tiebreaker**: More recent source wins
4. **Flag unresolved**: If sources are evenly split, flag as "unresolved" with both positions

## Output Structure

```typescript
interface SynthesisOutput {
  query: string;
  source_count: number;
  total_findings_raw: number;
  synthesized_findings: Array<{
    key_finding: string;
    confidence: number;       // 0.0-1.0 weighted average
    supporting_sources: number;
    sources: string[];
    evidence: string;
    strength: "strong" | "moderate" | "weak" | "speculative";
  }>;
  contradictions: Array<{
    topic: string;
    positions: Array<{
      source: string;
      claim: string;
      confidence: number;
    }>;
    resolved: boolean;
    resolution?: string;
  }>;
  recommendations: Array<{
    recommendation: string;
    confidence: number;
    based_on: string[];
    urgency: "high" | "medium" | "low";
  }>;
  overall_confidence: number;
  synthesis_summary: string;
}
```

## Anti-Patterns

- DON'T merge without weighting — all sources are not equal
- DON'T hide contradictions — flag them explicitly, even if unresolved
- DON'T drop low-confidence findings — include them marked as "speculative"
- DON'T synthesize without first ranking sources
- DON'T return raw output — always apply the full pipeline

## Related Skills

- `deep-research` — provides the raw source outputs to synthesize
- `save-to-cortex` — persist reusable syntheses
