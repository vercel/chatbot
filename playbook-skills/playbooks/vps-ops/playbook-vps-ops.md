---
name: VPS Operations Playbook
description: Hermes VPS management, PM2 process health, Claude Agent API, file system operations, and infrastructure monitoring.
domain: vps-ops
connectors: [base44, slack]
version: "1.0"
updated: 2026-06-22
---

# VPS Operations Playbook

## Purpose
Manage Hermes VPS infrastructure, PM2 process health, file system bridge, and infrastructure monitoring.

## Safeguards
- NEVER `pm2 reload claude-agent-api` from inside an active session
- NEVER kill the Claude agent process that is executing commands
- File system writes require safety validation
- VPS memory threshold: alert at 80%, critical at 90%
- Disk space threshold: alert at 85%

## Routines

### Routine: PM2 Health Check
1. Run `pm2 list` to get all process statuses
2. Verify all 22 processes online
3. Check restart counts (flag >10 restarts in 24h)
4. Check memory usage per process
5. Post health summary to #jarvis-admin

### Routine: Memory & Disk Check
1. Run `free -h` for memory overview
2. Run `df -h` for disk usage
3. Check swap usage
4. Alert if memory >80% or disk >85%
5. Identify memory-heavy processes for investigation

### Routine: Service Restart Protocol
1. Identify target service
2. Verify it's NOT claude-agent-api (cardinal rule)
3. Run `pm2 restart <service-name>`
4. Wait 5 seconds
5. Verify process online
6. Check logs for startup errors

### Routine: Log Analysis
1. Run `pm2 logs <service> --lines 100 --err`
2. Identify error patterns and frequency
3. Cross-reference with restart count
4. Diagnose root cause (env var missing, port conflict, OOM)
5. Apply fix and verify

### Routine: File System Audit
1. Check /home/hermes/cortex/skills/ count
2. Verify critical paths exist
3. Check file permissions
4. Report any missing or corrupted files
5. Run fs_search for integrity check

### Routine: Agent API Diagnostics
1. Check claude-agent-api uptime
2. Verify /api/diagnostics endpoint
3. Test /api/fs/list connectivity
4. Check session count and memory
5. Report to #jarvis-admin

## Workflows
- **vps-health-check**: Full VPS diagnostic run
- **service-recovery**: Automatic service failure detection and recovery
- **log-audit**: Deep log analysis across all services

## Anti-Patterns
- Do NOT `pm2 reload claude-agent-api` from within session
- Do NOT kill active agent sessions
- Do NOT clear logs without archiving
- Do NOT modify `/home/hermes/cortex/` without backup
