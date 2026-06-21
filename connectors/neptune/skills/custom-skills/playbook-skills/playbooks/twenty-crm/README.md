# Twenty CRM Playbook for Neptune Chat

**Version:** 1.0.0 | **Organization:** NewLeaf Financial | **Priority:** P0

## Quick Links
- [Master Playbook](playbook-twenty-crm.md) — Full operational guide
- [Knowledge Base](wiki/) — 10 wiki pages covering architecture, data model, API, workflows, etc.
- [Custom Skills](skills/) — 10 executable skills for Twenty CRM operations
- [KG Manifest](../../../playbook-skills/kg-manifests/twenty-crm.json) — Knowledge graph nodes and edges
- [Hermes Reference](/home/hermes/cortex/skills/twenty-crm-reference.md) — VPS agent reference
- [Master Dossier](/home/hermes/cortex/research/twenty/MASTER-DOSSIER.md) — Comprehensive research (30KB+)
- [Feature Deep Dives](/home/hermes/cortex/research/twenty/features/) — 15 deep dives
- [Live Repo](/home/hermes/repos/twenty/) — Twenty source code (commit 7eafbd91)

## What This Playbook Covers
- Twenty CRM architecture, data model, and API surface
- How to create custom objects, fields, and relations
- How to query and mutate data via GraphQL + REST
- How to build workflow automations
- How to write and deploy serverless logic functions
- How to register and verify webhooks
- How to manage users, roles, and permissions
- How to bulk import/export data
- How to troubleshoot common issues

## When Neptune Chat Loads This Playbook
When a user's message contains any trigger word (twenty, crm, custom object, pipeline, workflow, etc.), the PLAYBOOK-ROUTER will match to this playbook and load the relevant skill.

## Skills (10)
| # | Skill | When to Use |
|---|-------|-------------|
| 1 | twenty-connector | Authenticating and connecting to Twenty |
| 2 | create-custom-object | Creating new object types in workspace |
| 3 | query-twenty-data | Reading data via GraphQL or REST |
| 4 | mutate-twenty-data | Creating/updating/deleting records |
| 5 | manage-workflows | Building workflow automations |
| 6 | manage-functions | Writing serverless logic functions |
| 7 | register-webhook | Setting up webhook endpoints |
| 8 | manage-users-and-roles | Admin operations on users/roles |
| 9 | bulk-import-export | Data migration and batch operations |
| 10 | troubleshoot-twenty | Diagnosing and fixing issues |
