# Hermes VPS Dispatch Connector

**Version:** 1.0.0  
**Type:** ephemeral-dispatch-connector  
**Priority:** P0  
**Scope:** Quick VPS Claude SDK dispatch via Base44 hybridDispatch

## Files

| File | Purpose |
|------|---------|
| `SKILL.md` | YAML frontmatter + skill definition |
| `client.ts` | HermesVpsClient class (wraps hybridDispatch) |
| `actions.ts` | dispatch, poll, cancel, trigger detection |
| `index.ts` | Barrel exports |
| `docs/README.md` | Full documentation |

## Quick Reference

```typescript
import { dispatchToVps, pollVpsDispatch, cancelVpsDispatch } from "@/playbook-skills/connectors/hermes-vps";

// Dispatch
const { dispatchId } = await dispatchToVps("Check the error logs");

// Poll
const status = await pollVpsDispatch(dispatchId);

// Cancel
await cancelVpsDispatch(dispatchId);
```

See `docs/README.md` for full documentation.
