---
name: cardinal-rules-extract
version: 1.0.0
domain: planning-research
connector: neptune
scope: planning-research-suite
priority: P0
intent_tags:
  - cardinal rules
  - locked rules
  - constraints
  - rules to follow
  - what rules apply
  - governing rules
associated_skills:
  - save-to-cortex
  - draft-prd
  - draft-impl-plan
headline: |
  Extract LOCKED cardinal rules from save_memory and cortex.
  Categorize by domain, de-duplicate, rank by priority,
  and return structured output with rule IDs and source citations.
type: "skill"
access: internal
---

# Cardinal Rules Extract — Pull LOCKED Constraints

## Core Intent

Before any planning or execution, extract the non-negotiable cardinal rules
that constrain the operation. These rules come from two sources: save_memory
(in-session rules) and cortex (persistent knowledge). Rules are categorized,
de-duplicated, and ranked by priority so the agent never violates a LOCKED
constraint.

## Rule Sources

| Source | Location | Description |
|--------|----------|-------------|
| save_memory | In-memory store | Rules set during the current session, often domain-specific |
| cortex/skills | jarvis/cortex/skills/ | Persistent knowledge base of documented rules |
| playbooks | playbooks/<domain>/ | Domain-specific cardinal rules in playbooks |
| NEPTUNE.md | Repo root | Global cardinal rules from the traffic controller |
| PLAYBOOK-ROUTER.md | playbooks/ | Router-level cardinal rules |

## Rule Categories

| Category | Example Rules | Priority |
|----------|--------------|----------|
| billing | source_transaction_id BANNED, cofCompliant check required, Day-Zero CIT consent | P0 |
| deploy | Vercel REST API only, GitHub PR flow, NEVER VPS Python/pm2 | P0 |
| security | NEVER real customer data, Slack #jarvis-admin only | P0 |
| engineering | Commit author: abhiswami2121@gmail.com, NEVER cancel sessions | P1 |
| general | Pattern A+1 (7 tools), annotate after every execution | P1 |
| planning-research | Plan mode for 3+ phases, parallel research default | P1 |

## Action Catalog

### Extraction (4 actions)

| # | Action | Description |
|---|--------|-------------|
| 1 | `cardinal.extract_memory` | Pull rules from save_memory |
| 2 | `cardinal.extract_cortex` | Pull rules from cortex (skills + PRDs) |
| 3 | `cardinal.extract_playbooks` | Pull rules from domain playbooks |
| 4 | `cardinal.extract_global` | Pull rules from NEPTUNE.md + PLAYBOOK-ROUTER.md |

### Processing (3 actions)

| 5 | `cardinal.categorize` | Sort rules into categories by domain |
| 6 | `cardinal.deduplicate` | Remove duplicate rules across sources |
| 7 | `cardinal.rank` | Rank by priority: P0 > P1 > P2 |

### Output (2 actions)

| 8 | `cardinal.format` | Format as structured JSON with IDs and citations |
| 9 | `cardinal.filter` | Filter rules by domain or priority |

## Procedure

1. Pull rules from all 5 sources in parallel
2. Deduplicate — same rule from multiple sources = single entry
3. Categorize by domain (billing, deploy, security, engineering, general)
4. Rank by priority (P0 > P1 > P2)
5. Assign each rule a stable ID (hash of rule text)
6. Include source citations for every rule
7. Return structured output to caller
8. The caller applies the rules before executing their plan

## Output Structure

```typescript
interface CardinalRulesOutput {
  total_rules: number;
  by_priority: {
    P0: number;
    P1: number;
    P2: number;
  };
  by_domain: Record<string, number>;
  rules: Array<{
    id: string;          // stable hash
    rule: string;        // the rule text
    priority: "P0" | "P1" | "P2";
    domain: string;
    sources: string[];   // where this rule was found
    category: string;    // billing, deploy, security, etc.
  }>;
  extracted_at: string;
  sources_checked: string[];
}
```

## Known Cardinal Rules (Authoritative)

| ID | Rule | Priority | Domain |
|----|------|----------|--------|
| 6a29cf6f | Commit author: abhiswami2121@gmail.com | P0 | engineering |
| 6a273f70 | Vercel REST API only — never Vercel CLI on VPS | P0 | deploy |
| 6a276f8c | Slack #jarvis-admin ONLY — never newleaf-admin | P0 | security |
| 6a29d171 | NEVER cancel running agent sessions | P0 | engineering |
| 6a153d63 | NEVER edit VPS Python scripts or pm2 reload | P0 | deploy |
| pattern-a1 | Pattern A+1 — only 7 tools (6 gatekeepers + run_workflow) | P1 | engineering |
| annotate | Annotate after every execution (outcome, duration, error, learning) | P1 | general |
| no-real-data | NEVER use real customer data in test/smoke scenarios | P0 | security |
| router-first | PLAYBOOK-ROUTER.md FIRST — every turn, before any action | P1 | general |

## Anti-Patterns

- DON'T skip cardinal extraction before a plan — rules constrain everything
- DON'T only check one source — pull from all 5 sources
- DON'T apply rules without checking priority — P0 rules are non-negotiable
- DON'T ignore rule conflicts — if two rules conflict, flag it explicitly
- DON'T hardcode rules in plans — extract them fresh each time
