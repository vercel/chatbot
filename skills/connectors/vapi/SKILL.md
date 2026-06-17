---
name: vapi-connector
version: 1.0.0
kind: connector
primary_domain: support-triage
also_in: [customer-comms]
tools: [listV2Sessions, getV2Session, postV2Session, streamV2Progress, controlV2Session]
dependencies: []
headline: |
  Neptune V2 coding engine bridge. Posts to NEPTUNE_V2_CHAT_URL with handoff secret.
  Sessions run in E2B sandboxes. Always use SSE streaming.
type: "skill"
---

# Vapi Connector Skill

## Operational Knowledge
Bridge to Neptune V2 coding engine. Manages E2B sandbox sessions for AI coding tasks.

## Tools
| Tool | Description |
|------|-------------|
| listV2Sessions | List active sandbox sessions |
| getV2Session | Get session details |
| postV2Session | Create new coding session |
| streamV2Progress | SSE stream for session output |
| controlV2Session | Pause/resume/cancel session |

## Anti-Patterns
- NEVER poll in tight loops — use SSE streaming
- NEVER leave sandboxes running idle

## Safeguards
- Sandbox timeout: 30 min max
- Auth: NEPTUNE_V2_HANDOFF_SECRET required
