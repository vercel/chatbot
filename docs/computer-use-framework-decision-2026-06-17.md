# Computer Use Framework Decision — Phase 40
**Date:** 2026-06-17 | **Author:** abhiswami2121@gmail.com  
**Status:** RESEARCH COMPLETE — Framework validated, backend selected

## Executive Summary

Phase 40 requires a browser automation framework for authenticated UI testing. Three frameworks were evaluated:

| Framework | Status | Decision |
|-----------|--------|----------|
| **agent-browser v0.28.0** (Vercel Labs) | ✅ Installed, binary verified | **Secondary backend** — daemon mode challenging in VPS runtime |
| **Playwright v1.51.0** (Microsoft) | ✅ Installed, tested, working | **Primary backend** — proven, reliable, already in CI |
| **Anthropic Computer Use** | ❌ Too expensive | Not for web testing ($4,500-9,000/month vs $52/month) |

## 1. agent-browser v0.28.0 — Installed But Runtime-Limited

### What Works
- `npm install -g agent-browser` succeeds (79.5MB Rust binary)
- Binary executes: `agent-browser --version` → `0.28.0`
- Chrome launches headless via snap Chromium 149
- User data isolation: `/tmp/agent-browser-chrome-{uuid}/` per session
- Accessibility tree snapshots with `@eN` refs (~93% token savings vs raw HTML)
- Full CLI surface: 50+ commands (open, click, fill, snapshot, screenshot, etc.)

### Runtime Limitation
The Rust daemon process blocks on `agent-browser open` — it stays running to maintain session state. In the VPS Bash execution environment, this causes timeout/failure when chaining commands sequentially. The daemon is designed for interactive terminal use or MCP server mode.

### Resolution
agent-browser remains available as a **secondary backend** via its Node.js MCP server mode or direct invocation for specific use cases. The wrapper (`lib/testing/browser-agent.ts`) will support agent-browser as an alternative backend with a feature flag.

## 2. Playwright v1.51.0 — Primary Backend (VERIFIED)

### Verification Results
```
✅ Browser launch: headless Chromium, <3s cold start
✅ Navigation: neptune-chat-ashy.vercel.app loaded successfully
✅ Auth detection: Redirected to /login (Clerk auth working)
✅ Accessibility tree: Full snapshot via page.accessibility.snapshot()
✅ Screenshots: 1280×720 PNG, 48KB (typical), saved to /tmp
✅ Browser cleanup: graceful close, no zombie processes
```

### Why Playwright Wins for Phase 40
1. **Already integrated**: Phase 38 e2e tests use Playwright, GitHub Actions CI uses it
2. **Reliable process model**: Launch → use → close, no persistent daemon state issues
3. **Full API**: accessibility snapshots, screenshots, network monitoring, console capture
4. **Headless by default**: No Xvfb or display needed on VPS
5. **Isolated profiles**: `chromium.launchPersistentContext(userDataDir)` per test run
6. **Network control**: Route interception, request blocking (block billing domains)
7. **Cost**: $0 (open source, no per-use fees)

### Token Equivalence
Playwright accessibility snapshots provide the same `@eN`-style structured output as agent-browser. Our wrapper will parse `page.accessibility.snapshot()` into the same compact format, achieving the ~93% token savings documented in the agent-browser PRD.

## 3. Resource Assessment (from VPS Research)

| Resource | Available | Phase 40 Usage | Headroom |
|----------|-----------|----------------|----------|
| CPU | 4 vCPUs (AMD EPYC 9354P) | 1-2 vCPUs | 2 vCPUs |
| RAM | 15GB (11GB avail) | 2-4GB | 7GB |
| Disk | 84GB free | 20GB cap (screenshots) | 64GB |
| Node.js | v24.15.0 | ✅ | — |
| Chromium | snap 149 / Playwright 1223 | Both available | — |
| Xvfb | Installed | Not needed (headless) | — |
| Docker | 29.4.1 | Optional Tier 2 isolation | — |

**Concurrency**: Max 2 concurrent browser sessions (4 vCPUs / 2 per browser). Each Chrome instance: ~500MB-1GB RAM.

## 4. Cost Model (Confirmed)

### Per-Test Cost (Playwright + DeepSeek V4 Pro)
| Phase | Tokens | Cost |
|-------|--------|------|
| Snapshot parsing | 200-400 input | $0.00011-0.00022 |
| LLM analysis | 800-1500 input | $0.00044-0.00083 |
| Action generation | 200-500 output | $0.00044-0.00110 |
| **Per-step total** | **1,200-2,400** | **~$0.001-0.002** |
| **10-step smoke test** | **12K-24K** | **~$0.01-0.02** |

### Monthly Projection
- 50 smoke tests/day: $1/day
- 10 regression suites/day: $0.60/day
- 5 visual diff analyses/day: $0.15/day
- **Monthly: ~$52.50** vs Anthropic Computer Use: ~$4,500-9,000/month

## 5. Architecture Decision

```
lib/testing/
├── browser-agent.ts    → Unified interface (Playwright primary, agent-browser secondary)
├── agent-chat.ts       → LLM-driven interaction (AI Gateway → DeepSeek V4 Pro)
├── session.ts          → Browser lifecycle (launch → work → close, auto-cleanup)
├── credentials.ts      → Secure credential loader (never logs passwords)
├── permissions.ts      → RBAC enforcement matrix
├── playbook-parser.ts  → NKS markdown → executable scenarios
├── playbook-executor.ts → Runs scenarios via browser-agent
├── orchestrator.ts     → Queue, concurrency semaphore, reporting
├── visual-diff.ts      → Pixel diff + regression detection
└── types.ts            → Shared TypeScript types
```

## 6. Cardinal Decisions

1. **Playwright primary**, agent-browser secondary (feature flag: `TEST_BACKEND=agent-browser`)
2. **No Anthropic Computer Use** for web testing (100-300× expensive)
3. **All browsers headless** on VPS (no Xvfb needed with Playwright)
4. **Isolated user data dirs** per test run (`/tmp/test-chrome-{runId}/`)
5. **Network isolation**: iptables blocks billing domains from test browser
6. **Max 2 concurrent browsers**: concurrency semaphore enforces

---

**NEXT**: Stream 1 — Test User Provisioning + Security Infrastructure
