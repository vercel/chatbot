---
type: "skill"
name: "Vps Recovery Runbook"
description: "Auto-generated description for Vps Recovery Runbook"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# VPS Recovery Runbook

**Created:** 2026-06-14 | **Phase:** 15.E | **Severity:** Critical
**Applies to:** VPS @ 187.127.250.171 running neptune-chat (pm2:jarvis-core)

## Quick Reference

| What | Where | Action |
|---|---|---|
| App logs | `pm2 logs jarvis-core --lines 100` | Check for crash loops |
| System load | `htop` / `uptime` | CPU >80% sustained = investigate |
| Memory | `free -h` | <500MB free = memory leak likely |
| Disk | `df -h /` | >90% full = rotate logs |
| DB health | `systemctl status postgresql` | Check if DB is running |
| Grading pipeline | `crontab -l \| grep grad` | Verify cron is set |
| Slack bot | Check #jarvis-admin for grade cards | Verify grading output |

## Recovery Procedures

### 1. pm2:jarvis-core Flapping

**Symptoms:** Frequent restarts, app unreachable, 502 from nginx

**Root cause candidates:**
- Memory exhaustion (OOM killer)
- Unhandled promise rejection in Next.js
- DB connection pool exhaustion
- Disk full (logs)

**Fix:**
```bash
# 1. Check logs
pm2 logs jarvis-core --lines 200 --nostream | grep -i "error\|fatal\|killed\|OOM"

# 2. Check memory usage
pm2 show jarvis-core | grep -E "memory|restarts"

# 3. Apply memory limit if missing
pm2 restart jarvis-core --max-memory-restart 512M

# 4. If DB pool exhaustion suspected
pm2 restart jarvis-core
# Check POSTGRES_URL max connections
grep POSTGRES_URL .env.local | head -1

# 5. If still flapping — full restart with increased limits
pm2 delete jarvis-core
pm2 start npm --name jarvis-core -- run start -- --max-old-space-size=1024
pm2 save
```

### 2. Grading Pipeline Dead

**Symptoms:** No grade cards in Slack, session_grades.db not updating

**Fix:**
```bash
# Check grades
sqlite3 /home/hermes/data/session_grades.db "SELECT COUNT(*), datetime(MAX(ts), 'unixepoch') FROM grades;"

# Manual backfill last 7 days
cd /home/hermes/brain/session_grader
python3 grade_session.py --since 7d --no-post

# Verify cron
crontab -l | grep grad
# If missing, re-add:
# (crontab -l; echo "7,37 * * * * cd /home/hermes/brain/session_grader && python3 grade_session.py --since 35m --no-post >> /home/hermes/data/grading_cron.log 2>&1") | crontab -
```

### 3. Postgres Connection Issues

**Fix:**
```bash
systemctl status postgresql
# If down:
systemctl restart postgresql
# Check connections
psql -c "SELECT count(*) FROM pg_stat_activity;"
# Kill hung connections if >50
psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle in transaction' AND age(now(), state_change) > interval '5 minutes';"
```

### 4. Disk Full

**Fix:**
```bash
# Find large files
du -sh /home/hermes/* | sort -rh | head -10
# Rotate logs >100MB
find /home/hermes/data -name "*.log" -size +100M -exec truncate -s 0 {} \;
# Clean Next.js cache
rm -rf /home/neptune/neptune-chat/.next/cache
# Clean old pm2 logs
pm2 flush
```

### 5. Slack Bot Unresponsive

**Fix:**
```bash
# Verify token
grep SLACK_BOT_TOKEN /home/neptune/neptune-chat/.env.local | head -1
# Test Slack API
curl -s -H "Authorization: Bearer $SLACK_BOT_TOKEN" "https://slack.com/api/auth.test" | jq .
# If token invalid, rotate in Slack admin and update .env.local
```

## Monitoring Health Checks

```bash
# Quick health dashboard (run from VPS)
curl -s http://localhost:3000/api/health | jq .
curl -s http://localhost:3000/api/admin/vps-health | jq .
```

## PM2 Memory Limits (Phase 15.E)

```
jarvis-core:
  max_memory_restart: 512M
  restart_delay: 5000ms
  max_restarts: 10 per hour

Recovery: If max_restarts exceeded, pm2 stops the process.
Manual restart: pm2 restart jarvis-core
```

## Scheduled Maintenance

- **Daily:** Check `pm2 status`, `df -h /`, grading cron output
- **Weekly:** Review `pm2 logs --lines 500` for patterns, check DB size
- **Monthly:** Full health audit, rotate SSL certs if applicable

## Emergency Contacts

- **Slack:** #jarvis-admin (C0AQDDC3HAB)
- **VPS Provider:** Hostinger dashboard
- **DB backup:** /home/hermes/data/backups/ (verify exists)
