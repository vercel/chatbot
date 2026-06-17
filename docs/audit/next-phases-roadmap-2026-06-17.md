# Gap Analysis + Next Phases Roadmap
**Date:** 2026-06-17 | **Auditor:** Hermès V5 · Stream 5  
**Scope:** Synthesis of Streams 0–4 (Neptune Chat, Neptune V2, Twenty CRM, VPS Infra, Integrations)  
**Decision Framework:** Impact/Effort/Risk × Agent Unblock Value

---

## 1. Critical Gaps — Blocking Sales Agents Today

### 1.1 Twenty CRM Sign-In Flow (P0 — BLOCKER)
**Current State:** Twenty CRM is running healthy at `crm.newleaf.financial` but has ZERO deployed custom objects, no API key, and `IS_SIGN_UP_ENABLED=true` (open registration).

**What Agents Need:**
- Single sign-on from Neptune Chat → Twenty CRM iframe
- Role propagation (agent sees only their customers)
- Custom objects (Subscription, PaymentRecord, CreditDispute, Enrollment, Activity, SupportTicket) deployed and populated

**Blocked By:**
1. Custom objects NOT published to Twenty workspace
2. No API key created — Chat cannot authenticate
3. No data migration from Base44 → Twenty
4. No iframe auth integration (token passthrough)

**Impact:** Without this, the Command Center is an empty shell. Agents cannot manage customers.

### 1.2 Auth Alignment (P0 — BLOCKER)
**Current State:** Dual auth providers — Clerk (test keys) + NextAuth v5. Twenty uses password auth. V2 uses Better Auth (Vercel + GitHub OAuth).

**What Needs to Happen:**
1. Rotate Clerk test keys to production keys
2. Align auth across Chat + Twenty (shared session or token passthrough)
3. Email allowlist for Twenty (`IS_SIGN_UP_ENABLED=false`, invite-only)

### 1.3 Twenty Data Migration (P0 — BLOCKER)
**Current State:** Zero customer data in Twenty. Base44 has 256 fields per customer. The data-model.md maps everything, but no sync has run.

**What Needs to Happen:**
1. Deploy custom objects to Twenty workspace
2. Create API key
3. Run bulk sync: Base44 CustomerProfile → Twenty Person + custom objects
4. Validate agent can view customers in Twenty with all fields

---

## 2. Performance Concerns

### 2.1 Twenty Resource Usage
| Concern | Current | Target |
|---------|---------|--------|
| Server RAM | 621 MB | < 400 MB (optimize NestJS) |
| Worker RAM | 585 MB | < 300 MB (tune BullMQ) |
| Redis disk I/O | 12.3 GB writes | Monitor AOF growth |

**Action:** Post-migration, profile and tune Twenty for the 50-customer load. Consider `TAG` pinning to stable version.

### 2.2 Vercel Cold Starts
**Neptune Chat** (100K LOC TypeScript) on serverless functions will have cold start latency.
**Mitigation:** Use Vercel Edge Functions where possible, keep warm with health checks.

### 2.3 Cloudflare WAF
**Status:** Cloudflare tunnel active for `claude-agent-api`. WAF rules not explicitly configured for the CRM domain.
**Action:** Review WAF rules for `crm.newleaf.financial` — ensure rate limiting and bot protection without blocking legitimate API calls.

### 2.4 VPS CPU Headroom
**Current:** 73% sustained CPU usage with only 23% idle.
**Risk:** Under a bulk migration or spike in agent activity, CPU could saturate.
**Action:** Profile top CPU consumers (likely dream worker + Claude agent API). Consider CPU quotas.

---

## 3. Security Gaps

### 3.1 Environment Variable Sprawl (HIGH)
**Issue:** 11 `.env` files, 79 secrets in `/etc/newleaf/.env`, overlapping credentials.

**Action Plan:**
1. Consolidate to single source of truth (Vault, Doppler, or `/etc/newleaf/.env` with symlinks)
2. Document required secrets per service
3. Implement rotation schedule (90-day for API keys, 180-day for DB passwords)

### 3.2 Internal Service Exposure (HIGH)
**Issue:** 5 PostgreSQL + 4 Redis instances on `0.0.0.0`. Agent APIs on `0.0.0.0`.

**Action Plan:**
1. Bind PostgreSQL to Docker internal networks
2. Bind Redis to `127.0.0.1` or Docker networks
3. Bind agent APIs to `127.0.0.1` (they're behind nginx)
4. Audit UFW rules

### 3.3 Webhook Signature Validation
**Status:** Neptune V2 has HMAC-SHA256 webhook emitter ✅  
**Gap:** Twenty CRM webhooks not configured. Chat inbound webhook validation not verified for all connectors.

**Action Plan:**
1. Configure Twenty webhooks with `WEBHOOK_SIGNING_SECRET`
2. Verify HMAC validation on all inbound webhook endpoints (Chat `/api/webhooks/*`)
3. Add replay protection (timestamp + nonce)

### 3.4 No Swap Configured
**Issue:** 15.6 GB RAM with 9.3 GB used and 0 swap.
**Risk:** OOM kill of critical processes under load spike.
**Action:** Add 4 GB swap file.

---

## 4. Feature Gaps

### 4.1 Real-Time Iframe Sync (MEDIUM)
Current: Twenty iframe is static. Changes in Chat don't reflect in Twenty and vice versa.

**Solution:** WebSocket or SSE bridge between Chat and Twenty. When an agent updates a customer in Chat, it pushes to Twenty via API and the iframe refreshes.

### 4.2 Offline Mode (LOW)
No offline support. Entire stack requires internet.

**Solution:** Service Worker + IndexedDB for read-only customer data cache in Chat.

### 4.3 Bulk Operations UI (MEDIUM)
Agents need to perform bulk actions (enroll 10 customers, send 20 SMS, tag 50 disputes).

**Solution:** Bulk action panel in Command Center with Twenty batch API.

### 4.4 Reporting Dashboard (MEDIUM)
No unified reporting. Data lives in Base44 (operational) and Twenty (CRM view) separately.

**Solution:** Reporting dashboard that queries both sources and presents unified metrics.

---

## 5. Recommended Next Phases (Ranked)

### Phase 32: UI Polish + Critical Fixes
| Attribute | Value |
|-----------|-------|
| **Priority** | P0 (NOW) |
| **Impact** | HIGH — Unblocks agents |
| **Effort** | 3–5 days |
| **Risk** | LOW |
| **Dependencies** | None |

**Scope:**
1. Deploy Twenty custom objects (`npx twenty app:publish`)
2. Create Twenty API key
3. Set `IS_SIGN_UP_ENABLED=false` + invite-only
4. Rotate Clerk keys to production
5. Add 4 GB swap to VPS
6. Bind exposed services to localhost/Docker networks
7. Pin Twenty `TAG` from `latest` to specific version

**Acceptance Criteria:**
- Agent can log into Twenty via invite
- Custom objects visible in Twenty UI
- `/etc/newleaf/.env` services bound to localhost
- `free -h` shows swap configured

---

### Phase 33: Bulk Migration Wave 2 (50 Customers)
| Attribute | Value |
|-----------|-------|
| **Priority** | P0 |
| **Impact** | HIGH — Populates CRM for agent use |
| **Effort** | 5–7 days |
| **Risk** | MEDIUM (data integrity) |
| **Dependencies** | Phase 32 |

**Scope:**
1. Run bulk sync: Base44 → Twenty (50 customers)
2. Validate field mapping for all 7 custom objects
3. Verify subscription + payment history accuracy
4. Set up incremental sync (Base44 changes → Twenty updates)
5. Configure Twenty webhooks → Neptune Chat

**Acceptance Criteria:**
- 50 customer Person records in Twenty with all custom fields
- Subscription + PaymentRecord objects populated
- Agent can search and filter customers in Twenty
- Webhook events flowing from Twenty → Chat

---

### Phase 34: Notifications System
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Impact** | MEDIUM — Agent awareness |
| **Effort** | 3–4 days |
| **Risk** | LOW |
| **Dependencies** | Phase 33 |

**Scope:**
1. Configure Resend for transactional emails
2. Slack notifications for key events (payment failed, dispute opened, enrollment complete)
3. In-app notification bell in Command Center
4. Twenty email driver switch from `logger` to Resend

**Acceptance Criteria:**
- Agent receives email on payment failure
- Slack notification when dispute status changes
- Notification dot visible in Command Center

---

### Phase 35: Reporting Dashboard
| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Impact** | MEDIUM — Business visibility |
| **Effort** | 5–7 days |
| **Risk** | LOW |
| **Dependencies** | Phase 33 |

**Scope:**
1. Unified reporting page in Command Center
2. Queries across Base44 + Twenty
3. Metrics: MRR, churn rate, dispute resolution rate, agent performance
4. Export to CSV/PDF
5. Scheduled reports via Slack

**Acceptance Criteria:**
- Dashboard shows MRR, churn, dispute metrics
- Agent can filter by date range
- CSV export works

---

### Phase 36: Mobile App (PWA)
| Attribute | Value |
|-----------|-------|
| **Priority** | P2 |
| **Impact** | MEDIUM — Agent mobility |
| **Effort** | 7–10 days |
| **Risk** | LOW |
| **Dependencies** | Phase 33 |

**Scope:**
1. PWA wrapper for Neptune Chat
2. Offline customer data cache (Service Worker + IndexedDB)
3. Push notifications for critical events
4. Mobile-optimized Command Center views

**Acceptance Criteria:**
- Installable on iOS/Android home screen
- Offline customer lookup works
- Push notification received on payment failure

---

### Phase 37: Voice Agent Integration (VAPI)
| Attribute | Value |
|-----------|-------|
| **Priority** | P2 |
| **Impact** | MEDIUM — Support automation |
| **Effort** | 5–7 days |
| **Risk** | MEDIUM (voice quality) |
| **Dependencies** | Phase 33, VAPI connector active |

**Scope:**
1. VAPI voice agent for payment collection
2. VAPI voice agent for dispute status check
3. Call transcription → Twenty Activity timeline
4. Live call handoff to human agent

**Acceptance Criteria:**
- Customer can check payment status via phone
- Call appears in Twenty Activity timeline
- Agent can take over from AI mid-call

---

### Phase 38: Email Integration (Resend)
| Attribute | Value |
|-----------|-------|
| **Priority** | P2 |
| **Impact** | MEDIUM — Customer communication |
| **Effort** | 3–4 days |
| **Risk** | LOW |
| **Dependencies** | Phase 34 |

**Scope:**
1. Transactional email templates (welcome, payment receipt, dispute update)
2. Email open/click tracking → Twenty Activity
3. Bulk email send via Resend
4. Email → Twenty timeline sync

**Acceptance Criteria:**
- Customer receives payment receipt email
- Email activity visible in Twenty timeline
- Agent can trigger bulk email from Command Center

---

### Phase 39: Knowledge Base for AI
| Attribute | Value |
|-----------|-------|
| **Priority** | P2 |
| **Impact** | MEDIUM — Agent self-service |
| **Effort** | 5–7 days |
| **Risk** | LOW |
| **Dependencies** | Phase 33 |

**Scope:**
1. Structured knowledge base in Twenty Wiki or standalone
2. AI-powered search across playbooks + connector docs + troubleshooting
3. "Ask Jarvis" widget in Command Center
4. Auto-generated FAQ from support ticket patterns

**Acceptance Criteria:**
- Agent types question, gets AI answer with source citation
- FAQ page auto-updated weekly

---

### Phase 40: Multi-Tenancy
| Attribute | Value |
|-----------|-------|
| **Priority** | P3 |
| **Impact** | LOW (current) — Future scale |
| **Effort** | 10–14 days |
| **Risk** | HIGH (data isolation) |
| **Dependencies** | Phase 33 |

**Scope:**
1. Workspace isolation in Twenty (already enabled: `IS_MULTIWORKSPACE_ENABLED=true`)
2. Agent role scoping (agent sees assigned customers only)
3. Audit log per workspace
4. Cross-workspace reporting for admin

**Acceptance Criteria:**
- Agent A cannot see Agent B's customers
- Admin can view all workspaces
- Audit log shows who accessed what

---

## 6. Phase Dependency Graph

```
Phase 32 (UI Polish + Critical Fixes) ──┬── Phase 33 (Bulk Migration 50 Cust)
                                        │       │
                                        │       ├── Phase 34 (Notifications)
                                        │       │       │
                                        │       │       └── Phase 38 (Email/Resend)
                                        │       │
                                        │       ├── Phase 35 (Reporting Dashboard)
                                        │       │
                                        │       ├── Phase 36 (PWA Mobile App)
                                        │       │
                                        │       ├── Phase 37 (VAPI Voice Agent)
                                        │       │
                                        │       ├── Phase 39 (Knowledge Base AI)
                                        │       │
                                        │       └── Phase 40 (Multi-Tenancy)
                                        │
                                        └── (Infra hardening: swap, port binding, env consolidation)
```

---

## 7. Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Twenty migration corrupts Base44 data | Low | CRITICAL | Run on read replica first, validate 10 pilot customers |
| Agent adoption fails due to UX | Medium | HIGH | Phase 32 polish + agent shadowing session |
| VPS OOM during migration | Medium | HIGH | Add swap, profile memory before migration |
| Clerk production key rotation breaks auth | Low | HIGH | Test in staging, keep test key as fallback for 24h |
| Custom objects fail to publish | Medium | MEDIUM | Test with `--dry-run` flag first |
| Cloudflare WAF blocks Twenty API calls | Low | MEDIUM | Whitelist Chat server IP in WAF |

---

## 8. Resource Budget Estimate

| Phase | Days | People | Key Skill |
|-------|------|--------|-----------|
| 32: UI Polish + Fixes | 3–5 | 1 (Jarvis) | DevOps + Twenty admin |
| 33: Bulk Migration | 5–7 | 1 (Jarvis) | Data engineering |
| 34: Notifications | 3–4 | 1 (Jarvis) | Backend + Resend |
| 35: Reporting | 5–7 | 1 (Jarvis) | Frontend + SQL |
| 36: PWA Mobile | 7–10 | 1 (Jarvis) | Frontend + Service Workers |
| 37: VAPI Voice | 5–7 | 1 (Jarvis) | Voice AI + VAPI |
| 38: Email/Resend | 3–4 | 1 (Jarvis) | Email templates |
| 39: Knowledge Base | 5–7 | 1 (Jarvis) | AI + Content |
| 40: Multi-Tenancy | 10–14 | 1 (Jarvis) | Full-stack + Auth |
| **Total** | **46–65 days** | | |

---

## 9. Immediate Actions (Next 48 Hours)

1. **TODAY:** Deploy Twenty custom objects (Phase 32)
2. **TODAY:** Bind exposed services to localhost
3. **TODAY:** Add swap to VPS
4. **TOMORROW:** Create Twenty API key + test auth
5. **TOMORROW:** Run pilot migration (10 customers)
6. **DAY 3:** Full migration (50 customers) if pilot validates

---

*Generated by Hermès V5 · Stream 5 of comprehensive audit · 2026-06-17*
