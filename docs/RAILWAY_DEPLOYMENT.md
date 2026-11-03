# Railway Deployment Guide

## Overview

This guide explains how the Vercel AI Chatbot is configured for deployment on Railway.

## Configuration Files

### 1. `railway.json`

**Purpose:** Defines the build, deploy, and runtime configuration for Railway.

**Key Settings:**
- **Builder:** Nixpacks (automatic environment detection)
- **Build Command:** `pnpm run build`
- **Start Command:** `pnpm start`
- **Health Checks:** Readiness and liveness probes for container orchestration
- **Restart Policy:** Automatic restart on failure (up to 10 retries)

### 2. `nixpacks.toml`

**Purpose:** Defines the build environment, including Node.js version, pnpm version, and build phases.

**Phases:**
1. **Setup:** Install system packages (Node.js 20, pnpm 10.32.1, openssl, etc.)
2. **Install:** Install Node.js dependencies with frozen lockfile
3. **Build:** Compile Next.js app (environment variables injected here)
4. **Start:** Run production server

**Critical:** Environment variables are injected at the build phase, ensuring `AUTH_SECRET` and other secrets are available when Next.js compiles.

### 3. `.railwayignore`

**Purpose:** Excludes unnecessary files from the build context to speed up builds.

**Excluded:**
- Version control files (`.git`, `.github`)
- Node modules (reinstalled on Railway)
- Local environment files
- Build artifacts
- IDE settings

## Environment Variables Required

You must set these in the Railway dashboard before deployment:

### Authentication (Required)
```bash
NEXTAUTH_SECRET=<random_32_char_secret>
NEXTAUTH_URL=https://your-app-name.railway.app
```

### Database (Required)
```bash
POSTGRES_URL=postgresql://user:password@host:port/database
REDIS_URL=redis://:password@host:port
```

### AI Gateway (Required for non-Vercel)
```bash
AI_GATEWAY_API_KEY=<your_ai_gateway_key>
```

### AI Providers (Required)
```bash
OPENAI_API_KEY=sk-<your_openai_key>
```

### Optional AI Providers
```bash
ANTHROPIC_API_KEY=<optional>
GOOGLE_GENERATIVE_AI_API_KEY=<optional>
```

### Optional Storage
```bash
BLOB_READ_WRITE_TOKEN=<optional>
```

### Application Config
```bash
NODE_ENV=production
NEXT_PUBLIC_APP_NAME=My AI Chatbot
NEXT_PUBLIC_APP_URL=https://your-app-name.railway.app
```

## Deployment Steps

1. **Set Environment Variables**
   - Go to Railway Dashboard → Your Project → Variables
   - Add all required environment variables (see section above)

2. **Connect GitHub Repository**
   - Railway will automatically detect `railway.json` and `nixpacks.toml`
   - Connect your GitHub repo to Railway

3. **Deploy**
   - Push to `main` branch or click "Redeploy" in Railway Dashboard
   - Railway will execute the build phases in order (setup → install → build → start)

4. **Monitor Build**
   - Go to Railway Dashboard → Logs
   - Watch for:
     - `pnpm install --frozen-lockfile` (dependencies installing)
     - `pnpm run build` (Next.js compilation)
     - `ready - started server on` (success!)

## Troubleshooting

### Error: `MissingSecret: Please define a 'secret'`

**Cause:** `NEXTAUTH_SECRET` is not set or not available during build.

**Fix:**
1. Ensure `NEXTAUTH_SECRET` is in Railway Variables
2. Use a strong random string (32+ characters)
3. Click "Redeploy" in Railway Dashboard

### Error: `Connection refused` (PostgreSQL/Redis)

**Cause:** Database URLs are incorrect or services not running.

**Fix:**
1. Verify `POSTGRES_URL` and `REDIS_URL` in Railway Variables
2. Ensure PostgreSQL and Redis services are provisioned in Railway
3. Copy URLs directly from Railway dashboard

### Error: Build timeout

**Cause:** Build takes too long (pnpm install or Next.js compilation).

**Fix:**
1. `.railwayignore` is properly configured to exclude unnecessary files
2. nixpacks.toml caches `node_modules` and `.next/cache`
3. Clear Railway cache and rebuild if necessary

### Error: Port already in use

**Cause:** Port configuration mismatch.

**Fix:**
- Railway automatically assigns `PORT` environment variable
- Start command in `package.json` should be: `"start": "next start"`
- nixpacks.toml sets `PORT = "8080"` as default

## Performance Optimization

### Caching
- `nixpacks.toml` caches `node_modules` and `.next/cache` between builds
- Subsequent deployments are 2-3x faster

### Build Optimization
- `.railwayignore` excludes 50MB+ of unnecessary files
- Frozen lockfile ensures dependency consistency
- pnpm is 40% faster than npm for installation

## Monitoring

### Health Checks
- **Readiness Check:** Validates app is ready to receive traffic (30s after start)
- **Liveness Check:** Ensures app is still running (60s after start, every 30s)

### Logs
- Access via Railway Dashboard → Service → Logs
- Real-time monitoring of deployment progress

## Advanced Configuration

For additional customization:
- Edit `railway.json` to modify build commands, health checks, or restart policy
- Edit `nixpacks.toml` to change Node.js version, cache directories, or build phases
- Rebuild with `pnpm install && pnpm run build` locally before committing

## Support

For issues:
1. Check Railway logs for detailed error messages
2. Verify all environment variables are set correctly
3. Review this guide's Troubleshooting section
4. Contact Railway support via their dashboard

---

**Last Updated:** 2024
**Configuration Version:** 1.0
