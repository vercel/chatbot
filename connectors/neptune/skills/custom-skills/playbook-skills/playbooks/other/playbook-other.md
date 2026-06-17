---
title: Miscellaneous Capabilities
domain: other
version: 1.0.0
last_updated: 2026-06-16
owner: neptune-agent
priority: P2
intent_tags:
  - fun
  - random
  - utility
  - misc
  - experimental
  - general
associated_connectors:
  - cat-facts
  - affy
associated_skills: []
associated_functions: []
type: "playbook"
access: internal
---

# Miscellaneous Capabilities (other)

## Purpose

The `other` playbook is the **orphan catcher** for connectors, skills, functions, and capabilities that don't fit a specific business domain. It ensures every integration has a home, preventing architectural drift.

## When This Playbook Applies

This playbook activates when:
- An intent doesn't match any specific business domain (billing, support, disputes, etc.)
- A user asks for a "fun" or "random" capability
- An experimental connector needs classification
- A cross-domain utility is used by multiple playbooks but doesn't belong to any single one

## Fallback Intent Keywords

`fun`, `random`, `utility`, `misc`, `experimental`, `try this`, `random fact`, `general`, `other`, `unknown`, `unclassified`

## Orphan Connectors

Connectors currently in this bucket:
| Connector | Status | Notes |
|-----------|--------|-------|
| cat-facts | Orphan | No business domain affiliation |
| affy | Disputes-adjacent | Awaiting classification; may promote to disputes |

## Routing Logic

When the PLAYBOOK-ROUTER.md intent map returns no match (confidence < threshold), the system falls back to this playbook. The FALLBACK INTENT section in PLAYBOOK-ROUTER.md documents this behavior.

## Sub-Folder Structure

```
other/
├── playbook-other.md      ← You are here
├── manifest.yaml          ← Declares orphans
├── connectors/            ← Orphan connectors (cat-facts, affy, etc.)
├── skills/                ← Uncategorized skills
├── functions/             ← Cross-domain utility functions
└── workflows/             ← General-purpose workflows
```

## Safeguards

1. **Classify before promote:** An orphan should spend at least one mission cycle in 'other' before promotion to a domain playbook.
2. **Don't hoard:** If 3+ connectors in other/ relate to the same domain, create a new playbook.
3. **Review cadence:** Review orphan bucket contents every 5 missions. Promote or archive stale connectors.
4. **Orphan visibility:** Any connector in other/connectors/ should be visible in the /library twin-view page.

## Anti-Patterns

- **DON'T** put production-critical business logic in other/ — classify it properly.
- **DON'T** let other/ become a dumping ground. Classify actively.
- **DON'T** reference other/ connectors from domain playbooks without flagging them for promotion.

---

*End of playbook-other.md — Orphan catcher for unclassified capabilities*
