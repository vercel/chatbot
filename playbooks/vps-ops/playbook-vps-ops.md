---
playbook: vps-ops
version: 1.0.0
domain: vps-ops
scope: domain
auto_load: false
headline: VPS management, pm2, nginx, Cloudflare and system health operations
priority: P1
intent_tags:
  - VPS
  - pm2
  - nginx
  - Cloudflare
  - server
  - hostinger
  - daemon
  - health check
associated_connectors:
  - base44
  - slack
associated_skills:
  - capabilities/deploy-yourself
associated_functions:
  - validate-action
routines_count: 3
---

# VPS Ops Domain Playbook

## Operational Knowledge
- **VPS Provider:** Hostinger (hostingerBridge)
- **Process Manager:** pm2 for Claude Agent API + background daemons
- **Agent API:** Claude Agent API running on port 8102
- **Web Server:** nginx as reverse proxy in front of Node/Python services
- **CDN/DNS:** Cloudflare for DDoS protection + SSL termination
- **API Endpoint:** 187.127.250.171:8102 (claude-agent-api)
- **CRITICAL:** NEVER pm2 reload from inside Claude session (cardinal 6a153d63)

## Business Context
- VPS hosts all agent logic: playbook loading, context management, bridge operations
- Slack #jarvis-admin for VPS health alerts
- Scheduled cron jobs for playbook refinement, sync health, recovery
- Session data persists in jarvisDataGuard vault
- Rolling context buffer for agent working memory

## Anti-Patterns (DO NOT DO)
- DON'T run pm2 reload from inside a Claude session (cardinal 6a153d63)
- DON'T edit server.py without backup + ast.parse validation
- DON'T skip nginx reload after config change
- DON'T let disk usage exceed 80% — clean old logs
- DON'T expose port 8102 directly without nginx/Cloudflare
- DON'T keep expired SSL certs — renew 7 days before expiry
- DON'T call hostingerBridge from off-VPS — use native tools (5-30s latency + Cloudflare 403)
- DON'T deploy VPS changes without health-gating first

## Safeguards
1. Before editing server.py: create backup, run ast.parse, diff
2. After editing: schedule deferred pm2 reload via `at now + 1 minute`
3. After reload: dispatch tiny test session to verify API responds
4. If verify fails: revert from backup, re-schedule reload
5. VPS disk: monitor with `df -h`, alert if >80%
6. SSL certs: check expiry monthly via certbot
7. Cloudflare: verify DNS resolution after any IP changes
8. NEVER use hostingerBridge from the VPS itself (use native Bash/Read/Write)

## Routines

### Routine: 'Deploy VPS Change'
Trigger words: 'deploy to VPS', 'update VPS', 'ship VPS change',
              'reload agent', 'update agent API'

Mandatory steps:
1. Backup target file: cp server.py server.py.bak.$(date +%s)
2. Validate Python syntax: python3 -m ast server.py (if Python file)
3. Show diff of changes
4. Schedule deferred reload: echo 'pm2 reload claude-agent-api --update-env' | at now + 1 minute
5. Wait 70 seconds for reload to complete
6. Dispatch test session: curl -s http://localhost:8102/health
7. If test passes: commit backup, proceed
8. If test fails: revert: cp server.py.bak.<timestamp> server.py, schedule another reload
9. Post result to #jarvis-admin

### Routine: 'VPS Health Check'
Trigger words: 'VPS health', 'server status', 'check VPS', 'system health',
              'is the server ok', 'health audit'

Mandatory steps:
1. Check disk: df -h / (alert if >80%)
2. Check memory: free -m (alert if <500MB available)
3. Check CPU: top -bn1 | head -5
4. Check pm2 processes: pm2 status
5. Check nginx: systemctl status nginx
6. Check agent API: curl -s http://localhost:8102/health
7. Check Cloudflare: verify DNS resolves correctly
8. Check SSL certs: certbot certificates (expiry dates)
9. Report health dashboard to #jarvis-admin

### Routine: 'VPS Incident Response'
Trigger words: 'VPS down', 'server crashed', 'API not responding',
              'VPS error', 'server failure'

Mandatory steps:
1. Check if host is reachable: ping 187.127.250.171
2. If ping fails: escalate to Hostinger (host down)
3. If ping succeeds but API down: SSH in, check pm2 status
4. If pm2 stopped: pm2 resurrect (from pm2 save dump)
5. If pm2 running but API stuck: pm2 restart claude-agent-api
6. Check logs: pm2 logs claude-agent-api --lines 50
7. Check nginx error logs: tail -50 /var/log/nginx/error.log
8. If recoverable: fix issue, restart, verify
9. If unrecoverable: revert to last known good backup, restart
10. Post incident report to #jarvis-admin

## Custom Skills (under connectors/neptune)

### Functions
| Function | Path | Used For |
|----------|------|----------|
| `usage-telemetry` | `connectors/neptune/functions/usage-telemetry.ts` | Track VPS operation success/failure rates and durations |

## Refinement Notes
- 2026-06-11: cardinal 6a153d63 established after session c0e7413d17dd died at 82% during pm2 reload.
- 2026-06-11: Deferred reload via `at` command is the only safe VPS update mechanism.
- 2026-06-12: Added incident response routine for VPS outage scenarios.
- 2026-06-12: Phase 8 — usage-telemetry tracks VPS operation patterns for anomaly detection.
