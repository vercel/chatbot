---
type: "concept"
name: "MULTI ORG GUIDE"
description: "Auto-generated description for MULTI ORG GUIDE"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# Multi-Org Operating Guide v1.0

## Architecture

```
┌─────────────────────────────────────────────┐
│        UNIVERSAL SKILLS LIBRARY              │
│   _shared-skills/ (or agent-skills-library)  │
│   Connectors + Functions + Capabilities      │
│   Versioned (semver), org-agnostic           │
└──────────────┬──────────────────────────────┘
               │ references by name + version
    ┌──────────┴──────────┬──────────────────┐
    │                     │                  │
┌───▼────────┐  ┌─────────▼─────┐  ┌────────▼──────┐
│ NewLeaf    │  │ Org B         │  │ Org C ...     │
│ Playbooks  │  │ Playbooks     │  │ Playbooks     │
│ (private)  │  │ (private)     │  │ (private)     │
└───┬────────┘  └─────────┬─────┘  └────────┬──────┘
    │                     │                  │
┌───▼────────┐  ┌─────────▼─────┐  ┌────────▼──────┐
│ NewLeaf    │  │ Org B Agent  │  │ Org C Agent   │
│ Agent      │  │ (Neptune     │  │ (Neptune      │
│ Instance   │  │  Chat inst)  │  │  Chat inst)   │
└────────────┘  └──────────────┘  └───────────────┘
```

## Core Principle

**Skills are universal. Playbooks are org-specific. Agents bind them at runtime.**

## How to Create a New Org's Playbook Repo

### Step 1: Create the repo
```bash
# Option A: Create on GitHub
gh repo create abhiswami2121/<org>-playbooks --private

# Option B: Create locally
mkdir /home/neptune/<org>-playbooks
cd /home/neptune/<org>-playbooks
git init
```

### Step 2: Create root PLAYBOOK.md
```yaml
---
playbook: root
version: 0.1.0
scope: workspace
auto_load: true
skills:
  - base44-connector@^1.0.0
  - slack-connector@^1.0.0
  # Add all skills this org needs
---
```

### Step 3: Create domain playbooks
For each domain the org operates in:
```bash
mkdir -p billing disputes comms coding
# Create billing/PLAYBOOK.md, etc.
```

### Step 4: Customize business context
- Change refund thresholds
- Change approver contacts
- Change channel names
- Add org-specific anti-patterns
- Add org-specific safeguards

### Step 5: Deploy agent instance
Set env vars:
- `SKILL_LIBRARY_REPO=github.com/abhiswami2121/agent-skills-library@v1.0.0`
- `PLAYBOOK_REPO=github.com/abhiswami2121/<org>-playbooks@main`

## How Playbooks Reference Skills

Playbooks reference skills by name with optional semver constraint:

```yaml
skills:
  - nmi-connector@^1.0.0         # Compatible with 1.x.x
  - calculate-refund-eligibility@^1.2.0  # At least 1.2.0
  - code-review@^1.0.0           # Any 1.x.x
```

When a skill publishes a new major version (e.g., 2.0.0), playbooks must explicitly upgrade. Minor and patch updates auto-propagate.

## How to Update a Skill in the Library

1. Edit the skill in `_shared-skills/connectors/<name>/` or `functions/<name>/`
2. Update SKILL.md frontmatter version
3. Run tests: `pnpm test -- --skill=<name>`
4. Commit with message: `feat(skill): <name> v<new-version> - <change>`
5. All orgs using `@^<major>` get the update automatically
6. If breaking change (major version bump), notify all org maintainers

## How to Deploy a New Org Agent

### Vercel Deploy (Recommended)
```bash
# 1. Clone the chat app
git clone abhiswami2121/neptune-chat orgb-chat
cd orgb-chat

# 2. Set org-specific env vars
vercel env add SKILL_LIBRARY_REPO production
vercel env add PLAYBOOK_REPO production

# 3. Deploy
vercel --prod
```

### Agent Startup Sequence
1. Load env: `SKILL_LIBRARY_REPO`, `PLAYBOOK_REPO`
2. Clone/fetch skill library to local cache
3. Clone/fetch playbook repo
4. Parse root PLAYBOOK.md → build routing table
5. Pre-load domain playbooks for known domains
6. Resolve skill dependencies from library
7. Agent ready for requests

## Multi-Org Isolation Guarantees

| Aspect | Isolated? | Mechanism |
|--------|-----------|-----------|
| Business context | Yes | Per-org playbook |
| Refund thresholds | Yes | Per-org playbook |
| Approver contacts | Yes | Per-org playbook |
| Channel names | Yes | Per-org playbook |
| Compliance rules | Yes | Per-org playbook |
| Skill code | Shared | Universal library |
| Skill updates | Shared | Semver propagation |
| Customer data | Isolated | Per-org Base44 instance |
| Agent instances | Isolated | Per-org Vercel deploy |

## Test Org B (Proof of Concept)

Created at `/home/neptune/orgb-test-playbooks/`:
- Root PLAYBOOK.md with different business context
- billing/PLAYBOOK.md with different refund threshold ($100 vs NewLeaf $200)
- Uses identical skill references: `nmi-connector@^1.0.0`

This proves: same skills, different playbooks, isolated behavior.
