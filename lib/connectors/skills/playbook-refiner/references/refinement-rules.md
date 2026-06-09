# Refinement Rules

This document spells out the detectors, scoring, and promotion logic used by `propose_diff.py`.

## Detector catalog

### 1. RecurringErrorDetector
- **Triggers on:** the same `(tool, error_class)` pair appearing ≥3 times in the time window
- **Proposes:** a Safeguard entry that pre-checks the condition causing the error
- **Confidence formula:** `min(0.5 + count * 0.05, 0.95)`
- **Caveats:** transient infra errors (5xx, connection reset) should be filtered out before this runs — they're not playbook-fixable

### 2. NewIdOutsideAllowlistDetector
- **Triggers on:** channel/repo/project IDs used ≥2 times that aren't in the playbook's Business Context allowlist
- **Proposes:** a Business Context entry marked "PURPOSE UNCLEAR" for human triage
- **Confidence:** fixed 0.7 — we never know if it's a legitimate new surface or a leak
- **Caveats:** requires the playbook to actually have a parseable allowlist table. If it doesn't, this detector no-ops

### 3. VelocityAnomalyDetector
- **Triggers on:** same tool + same input hash fired ≥4 times in a 60-second sliding window
- **Proposes:** a Safeguard for content-hash deduplication
- **Confidence:** 0.85 (high — duplicate sends are almost never intentional)
- **Caveats:** legitimate fan-out workflows (sending the same notification to 4 channels intentionally) will false-positive. Handle by setting `intentional_fanout: true` in the tool call metadata

### 4. UserCorrectionDetector
- **Triggers on:** user message within 2 turns of a tool call matching correction patterns ("don't", "never", "use X instead", "wrong channel/repo/team")
- **Proposes:** an Anti-Pattern entry quoting the user's correction
- **Confidence:** 0.75
- **Caveats:** the user's words may be context-specific. Always mark these `needs-discussion` in the PR

### 5. BypassedSafeguardDetector *(not yet implemented in v0.1)*
- **Triggers on:** tool invoked without first invoking a documented pre-flight check
- **Proposes:** strengthened wording on the existing safeguard
- **Confidence:** 0.9
- **Requires:** safeguards to be machine-parseable, which v0.1 playbooks don't enforce. Coming in v0.2

### 6. AntiPatternViolationDetector *(not yet implemented in v0.1)*
- **Triggers on:** tool invocation matching an existing anti-pattern
- **Proposes:** elevating the anti-pattern to a Safeguard (machine-enforced)
- **Confidence:** 0.95
- **Requires:** anti-patterns to be machine-checkable. Coming in v0.2

## Pattern key computation

```
pattern_key = sha1(connector + section + proposed_change)[:16]
```

This means two detectors producing the same proposed change collapse into one cluster, increasing recurrence count.

## Promotion rule

A cluster is promoted to the proposed diff if:

- `recurrence_count ≥ 3` **AND** `len(sessions) ≥ 2`, **OR**
- `recurrence_count ≥ 5` **AND** `confidence ≥ 0.8`, **OR**
- `recurrence_count == 1` **AND** `confidence ≥ 0.95`

The dual-session requirement on the first rule prevents one bad session from polluting the playbook.

## Section assignment heuristics

When a finding could go in multiple sections, prefer in this order:

1. **Safeguards** (machine-actionable, agent can self-check)
2. **Anti-Patterns** (clear "don't do this" rule)
3. **Operational Knowledge** (stable technical fact)
4. **Business Context** (org-specific config)
5. **Refinement Notes** (everything always gets a note here too)

## Diff format

The output is **not** a real unified diff — it's a markdown proposal that a human (or a follow-up LLM) translates into the actual file edit. This is intentional: the agent that runs the refiner shouldn't have write access to the playbooks. The PR creator (human or separate trusted agent) does the actual edit.

## False positive handling

Every detector should err toward false negatives over false positives. A missed pattern is recoverable (it'll trigger again next week). A bad pattern in the playbook costs trust permanently.

Specifically:
- Detectors should never propose deletion or modification of existing content — only additions
- Existing Refinement Notes are append-only; never rewritten
- If a detector produces a finding that contradicts an existing playbook entry, surface the contradiction for human review rather than auto-resolving

## Versioning the playbook after refinement

Patch bump (`0.x.y` → `0.x.y+1`): Refinement Notes additions only
Minor bump (`0.x.y` → `0.x+1.0`): new Safeguard, Anti-Pattern, or Business Context entry
Major bump (`x.y.z` → `x+1.0.0`): not done by the refiner — humans only
