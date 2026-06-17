---
name: gap-analysis
version: 1.0.0
domain: planning-research
connector: neptune
scope: planning-research-suite
priority: P1
intent_tags:
  - gap analysis
  - gap
  - what is missing
  - audit
  - compare
  - delta
  - discrepancy
associated_skills:
  - deep-research
  - cardinal-rules-extract
  - draft-impl-plan
  - save-to-cortex
headline: |
  Systematic current-vs-target state analysis producing classified gaps
  (critical/high/medium/low) with remediation plans and effort estimates.
type: "skill"
access: internal
---

# Gap Analysis — Current vs Target State Diff

## Core Intent

Perform a structured gap analysis by comparing the current state of a system,
domain, or codebase against a desired target state. Produces classified gaps
with severity ratings and actionable remediation plans.

## Gap Classification

| Severity | Criteria | SLA |
|----------|----------|-----|
| Critical | Blocks core functionality, security vulnerability, data loss risk | Fix immediately |
| High | Significant capability missing, user-facing impact | Fix within current phase |
| Medium | Quality/performance gap, non-blocking | Fix in next phase |
| Low | Nice-to-have, minor improvement | Backlog |

## Analysis Dimensions

| # | Dimension | What We Compare |
|---|-----------|----------------|
| 1 | Features | Currently implemented vs required features |
| 2 | Capabilities | System capabilities vs needed capabilities |
| 3 | Integrations | Connected systems vs needed integrations |
| 4 | Performance | Current metrics vs target SLAs |
| 5 | Security | Current posture vs required compliance |
| 6 | Reliability | Current uptime/error rates vs targets |
| 7 | Developer Experience | Current tooling/DX vs desired state |
| 8 | Documentation | Existing docs vs needed coverage |

## Action Catalog

### State Definition (3 actions)

| # | Action | Description |
|---|--------|-------------|
| 1 | `gap.define_current` | Document current state from codebase/cortex/input |
| 2 | `gap.define_target` | Document target state from PRDs/requirements/input |
| 3 | `gap.load_context` | Load both states from files if provided |

### Analysis (4 actions)

| 4 | `gap.run_diff` | Run systematic diff across all 8 dimensions |
| 5 | `gap.classify` | Classify each gap as critical/high/medium/low |
| 6 | `gap.prioritize` | Rank gaps by business impact + technical urgency |
| 7 | `gap.summarize` | Generate executive summary of findings |

### Remediation (3 actions)

| 8 | `gap.generate_fixes` | Generate specific remediation actions per gap |
| 9 | `gap.estimate_effort` | Estimate effort (turns/complexity) per remediation |
| 10 | `gap.build_timeline` | Sequence remediation by priority and dependency |

### Output (2 actions)

| 11 | `gap.generate_report` | Generate complete gap analysis report |
| 12 | `gap.save` | Save to jarvis/prd/ via save-to-cortex |

## Procedure

1. Define current state: gather from cortex (existing PRDs, playbooks, skills)
2. Define target state: from PRD, requirements doc, or user specification
3. Run systematic diff across all 8 analysis dimensions
4. Classify each gap by severity (critical/high/medium/low)
5. Prioritize gaps by business impact + technical urgency
6. Generate remediation actions for each gap
7. Estimate effort for each remediation
8. Build timeline: sequence fixes by priority and dependency
9. Generate complete gap analysis report
10. Save to jarvis/prd/{title}-GAP-ANALYSIS-{date}.md
11. Annotate completion

## Output Structure

```typescript
interface GapAnalysisOutput {
  summary: string;
  current_state_summary: string;
  target_state_summary: string;
  dimensions_analyzed: string[];
  gaps: Array<{
    id: string;
    dimension: string;
    description: string;
    current: string;
    target: string;
    severity: "critical" | "high" | "medium" | "low";
    remediation: string;
    effort_estimate: string;
    dependencies: string[];
  }>;
  statistics: {
    total_gaps: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  timeline: Array<{
    phase: string;
    gaps_addressed: string[];
    estimated_turns: number;
  }>;
}
```

## Anti-Patterns

- DON'T analyze without a clear target state — comparison needs a reference
- DON'T classify everything as critical — be honest about severity
- DON'T skip dimensions — analyze all 8, even if some show no gaps
- DON'T propose fixes without effort estimates — unestimated work is unplanned work
- DON'T save without validating cardinal rule compliance

## Related Workflows

- `playbooks/planning-research/workflows/gap-analysis.yaml` — full gap analysis pipeline
