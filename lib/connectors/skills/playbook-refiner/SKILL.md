---
name: playbook-refiner
description: Audit agent tool-call logs and propose updates to connector PLAYBOOK.md files. Use this skill whenever the user wants to refine, improve, audit, or update connector playbooks based on actual usage patterns. Also use when the user mentions failing tool calls, recurring errors, agent mistakes, or "make the agent smarter." This is the meta-skill that closes the feedback loop on the connector-playbooks pattern.
---

# Playbook Refiner

This skill audits agent tool-call logs against the existing PLAYBOOK.md files in a `connectors/` directory and proposes diffs that capture newly observed patterns, recurring failures, and missing safeguards.

The skill is **human-in-the-loop by default**. It never edits a PLAYBOOK.md directly. It writes a proposed diff to disk and opens a PR (or prints the diff for manual review if git isn't configured).

## When to run this

- Weekly cadence, automatic
- After any incident where an agent took an action it shouldn't have
- Whenever a new connector is added (to seed initial Refinement Notes from early usage)
- When a user reports that an agent keeps making the same mistake

## Inputs the skill needs

1. **`connectors/` directory** — the existing playbooks to audit
2. **Tool-call log source** — one of:
   - A directory of JSONL logs (`logs/*.jsonl`)
   - An audit DB connection string
   - A path to an audit-engine export
3. **Time window** — default last 7 days

If any input is missing, ask the user. Do not guess.

## The refinement loop

```
load playbooks → load logs → run detectors → cluster patterns →
score patterns → propose diff → write diff file → open PR (or print)
```

### Step 1: Load playbooks

For each `connectors/*/PLAYBOOK.md`:
- Parse YAML frontmatter
- Extract the five canonical sections
- Build an in-memory representation

If any playbook fails lint (see `references/refinement-rules.md`), surface that to the user before continuing.

### Step 2: Load logs

Tool-call logs should have at minimum:
- timestamp
- tool name (e.g. `slack:send_message`)
- input params
- output / error
- agent session ID

Common formats handled by `scripts/ingest_logs.py`:
- Claude Agent SDK trace dumps
- OpenAI Agents SDK run logs
- Custom JSONL with the schema in `references/log-schema.md`

### Step 3: Run pattern detectors

The detectors in `scripts/propose_diff.py` look for:

1. **Recurring identical errors** — same tool, same error class, ≥3 times in window
2. **New IDs outside allowlist** — channel/repo/project IDs used that aren't in any playbook's allowlist
3. **Velocity anomalies** — same tool + same input fired ≥4 times in <60s
4. **User-correction patterns** — agent took action, user said "don't do that" or "use X instead" within 2 turns
5. **Bypassed safeguards** — agent invoked tool without running a documented pre-flight check
6. **Anti-pattern violations** — agent did something a PLAYBOOK explicitly says not to do

Each detector returns a list of `Finding` objects with:
- `connector` — which playbook to update
- `section` — which canonical section the finding belongs in
- `confidence` — 0.0 to 1.0
- `evidence` — log excerpts supporting the finding
- `proposed_change` — the actual markdown to add

### Step 4: Cluster and score

Findings with the same `pattern_key` (computed from connector + section + content hash) collapse into a single entry with a `recurrence_count`. The promotion rule:

- `recurrence_count ≥ 3` and seen across ≥2 sessions → propose addition to playbook
- `recurrence_count ≥ 5` and `confidence ≥ 0.8` → propose addition with `high-confidence` marker
- `recurrence_count == 1` → drop unless `confidence ≥ 0.95` (one-off but obvious)

### Step 5: Propose the diff

For each connector with findings, write a diff to `proposals/<connector>-<date>.diff`. The diff:
- Adds a new entry to the relevant section
- Always adds a corresponding `Refinement Notes` entry with date + evidence summary
- Bumps the version in YAML frontmatter (patch for notes only, minor for new safeguards/anti-patterns)

### Step 6: Open PR or print

If git + GitHub CLI are available:
```bash
git checkout -b refiner/<date>-<connector>
# apply diff
git commit -m "refiner: propose playbook updates for <connector>"
gh pr create --label "ai-agent" --label "playbook-refiner" --title "..."
```

If not, print the diff to the user and ask them to apply manually.

## How to run

```bash
# Default: last 7 days, current directory's connectors/
python -m scripts.refine

# Custom window and source
python -m scripts.refine --since 2026-06-01 --logs ./audit-export/

# Dry-run, no diff written
python -m scripts.refine --dry-run
```

## What the skill should NOT do

- **Don't** auto-merge any proposed diff. Human review is the whole point.
- **Don't** invent findings. If a pattern doesn't actually appear in the logs, don't propose it.
- **Don't** modify the YAML frontmatter beyond version bumps and one-line headline tweaks (and only if the new pattern materially changes the headline meaning).
- **Don't** delete existing Refinement Notes. Append only.
- **Don't** propose changes to anti-patterns that contradict existing ones without flagging the contradiction for human review.

## Quality bar

The acid test for any proposed change: **would a senior operator who knows the system look at this diff and say "yes, obviously"?** If the change is plausible but not obvious, mark it `needs-discussion` in the PR description and let the human decide.

## See Also

- `references/refinement-rules.md` — full detector spec, scoring formulas, edge cases
- `references/log-schema.md` — log format expected by `ingest_logs.py`
- `scripts/ingest_logs.py` — log loader and normalizer
- `scripts/propose_diff.py` — detector + diff generator
