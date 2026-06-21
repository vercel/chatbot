# Twenty CRM — Self-Hosting

## System Requirements
- Minimum 2GB RAM (4GB recommended for production)
- Docker + Docker Compose (up-to-date)
- PostgreSQL 16, Redis 7, Node.js 20+
- SSL certificate (required for clipboard API)

## Installation Methods

### One-Line Install
```bash
bash <(curl -sL https://raw.githubusercontent.com/twentyhq/twenty/main/packages/twenty-docker/scripts/install.sh)
```

### Version Pinning
```bash
VERSION=v3.0.0 bash <(curl -sL ...)
BRANCH=main bash <(curl -sL ...)
```

### Manual Setup
1. Download `.env.example` from `twenty-docker` package
2. Generate `ENCRYPTION_KEY`: `openssl rand -base64 32`
3. Set `PG_DATABASE_PASSWORD` (no special characters)
4. Download `docker-compose.yml`
5. `docker compose up -d`
6. Access at `http://localhost:3000`

## Critical Environment Variables
| Variable | Purpose | Warning |
|----------|---------|---------|
| `ENCRYPTION_KEY` | Encrypts DB secrets (OAuth, TOTP, app vars) | NEVER lose — means losing ALL stored secrets |
| `FALLBACK_ENCRYPTION_KEY` | Previous key during rotation | For zero-downtime rotation |
| `PG_DATABASE_URL` | Postgres connection string | No special chars in password |
| `SERVER_URL` | Public-facing URL | Must match reverse proxy |
| `REDIS_URL` | Redis connection | Custom port supported |
| `STORAGE_TYPE` | `local` or `S3` | File storage backend |
| `LOGIC_FUNCTION_TYPE` | `DISABLED`/`LOCAL`/`LAMBDA` | Logic function execution |
| `CODE_INTERPRETER_TYPE` | `DISABLED`/`LOCAL`/`E2B` | AI code execution sandbox |
| `IS_MULTIWORKSPACE_ENABLED` | Multi-tenant toggle | `false` for single tenant |

## NewLeaf Production Config
```env
SERVER_URL=https://crm.newleaf.financial
IS_MULTIWORKSPACE_ENABLED=false
STORAGE_TYPE=local
LOGIC_FUNCTION_TYPE=LOCAL
CODE_INTERPRETER_TYPE=DISABLED
```

## Reverse Proxy (nginx)
```nginx
server {
    listen 443 ssl http2;
    server_name crm.newleaf.financial;
    
    ssl_certificate /etc/letsencrypt/live/crm.newleaf.financial/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/crm.newleaf.financial/privkey.pem;
    
    location / {
        proxy_pass http://localhost:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP $remote_addr;
        
        # Required for webhooks
        proxy_set_header X-Twenty-Webhook-Signature $http_x_twenty_webhook_signature;
        proxy_set_header X-Twenty-Webhook-Timestamp $http_x_twenty_webhook_timestamp;
    }
    
    client_max_body_size 50M;  # For file uploads
}
```

## Docker Compose (NewLeaf Production)
```yaml
services:
  twenty-newleaf-server:
    image: twentyhq/twenty-server:latest
    ports:
      - "3002:3000"
    environment:
      - PG_DATABASE_URL=${PG_DATABASE_URL}
      - REDIS_URL=redis://twenty-newleaf-redis:6379
      - SERVER_URL=${SERVER_URL}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
      - IS_MULTIWORKSPACE_ENABLED=false
    depends_on:
      twenty-newleaf-db:
        condition: service_healthy
      twenty-newleaf-redis:
        condition: service_healthy

  twenty-newleaf-worker:
    image: twentyhq/twenty-worker:latest
    environment:
      - PG_DATABASE_URL=${PG_DATABASE_URL}
      - REDIS_URL=redis://twenty-newleaf-redis:6379
      - DISABLE_DB_MIGRATIONS=true
    depends_on:
      - twenty-newleaf-server

  twenty-newleaf-db:
    image: postgres:16
    ports:
      - "5434:5432"
    environment:
      - POSTGRES_USER=twenty
      - POSTGRES_PASSWORD=${PG_DATABASE_PASSWORD}
      - POSTGRES_DB=twenty
    volumes:
      - twenty_pgdata:/var/lib/postgresql/data

  twenty-newleaf-redis:
    image: redis:7
    ports:
      - "6382:6379"

volumes:
  twenty_pgdata:
```

## Backup Strategy
```bash
# Backup
docker exec twenty-newleaf-db pg_dump -U twenty twenty > backup_$(date +%Y%m%d_%H%M).sql

# Daily cron (2 AM)
0 2 * * * docker exec twenty-newleaf-db pg_dump -U twenty twenty > /backups/twenty_$(date +\%Y\%m\%d).sql

# Restore
docker compose stop twenty-newleaf-server twenty-newleaf-worker
docker exec -i twenty-newleaf-db psql -U twenty twenty < backup.sql
docker compose up -d
```

## Upgrade Procedure
1. **Back up database** — always first
2. Check release notes for breaking changes
3. `docker compose pull` (new images)
4. `docker compose down`
5. `docker compose up -d`
6. Monitor logs: `docker logs twenty-newleaf-server -f`
7. Smoke test: `curl http://localhost:3002/healthz`

## Troubleshooting
| Issue | Fix |
|-------|-----|
| Container won't start | Check logs: `docker logs twenty-newleaf-server` |
| DB connection refused | Verify `PG_DATABASE_URL`, check DB is healthy |
| Encryption errors | `ENCRYPTION_KEY` changed? Restore previous key |
| Storage full | Clean Docker: `docker system prune -a` |
| Port conflict | Change port mapping in docker-compose.yml |
