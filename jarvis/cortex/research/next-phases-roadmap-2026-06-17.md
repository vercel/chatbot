---
type: "research"
name: "Next Phases Roadmap 2026 06 17"
description: "Auto-generated description for Next Phases Roadmap 2026 06 17"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# Gap Analysis & Next Phases Roadmap — 2026-06-17

> **Source audits:** Neptune Chat, Neptune V2, Twenty CRM, VPS Infrastructure, Integrations  
> **Methodology:** 5-stream audit → gap extraction → ranked phases by impact/effort/risk  
> **Target audience:** NewLeaf engineering leadership (Jarvis + Swami)

---

## SECTION A: CRITICAL GAPS (BLOCKING SALES AGENTS)

### A1. Twenty CRM Iframe Auth (🔴 Critical)
**Problem:** Neptune Chat embeds Twenty CRM in an iframe at `/command-center`, but there's no authentication bridge. Sales agents see a login screen, not their CRM dashboard.

**Impact:** Sales agents cannot use the unified workspace. Twenty is shelfware.

**Root cause:** No token passthrough or OAuth flow between Chat (Better Auth) and Twenty (password auth). Twenty expects either password login or Bearer token, but the iframe doesn't pass credentials.

**Fix:** Implement Twenty OAuth/token passthrough:
1. Chat generates a short-lived Twenty API token on session start
2. Token injected into iframe via `?token=xxx` query param or postMessage
3. Twenty validates the token and auto-authenticates the user

### A2. Twenty Custom Objects Not Deployed (🔴 Critical)
**Problem:** 6 custom objects (109 fields, 8 relations) are drafted at `/home/neptune/twenty-newleaf-extensions/` but never built or published to the running Twenty instance. The CRM is an empty shell.

**Impact:** No Subscription records, no PaymentRecords, no CreditDisputes, no Enrollments. Twenty is unusable.

**Fix:** Run deployment pipeline:
```bash
cd /home/neptune/twenty-newleaf-extensions
npx twenty dev:build
npx twenty app:publish
```

### A3. Twenty API Key Missing (🔴 Critical)
**Problem:** No API key exists for Neptune Chat ↔ Twenty communication. All 18 connector functions are dead code.

**Fix:** Create API key in Twenty Settings → API & Webhooks, add to `/etc/newleaf/.env` as `TWENTY_API_KEY`.

### A4. Twenty Sign-Ups Open (🟠 High)
**Problem:** `IS_SIGN_UP_ENABLED=true` — anyone can create a workspace on crm.newleaf.financial.

**Fix:** Set `IS_SIGN_UP_ENABLED=false` in `.env`, restart Twenty container.

### A5. hermes-api Crash Loop (🟠 High)
**Problem:** PM2 process `hermes-api` (PID 1) has 62 restarts in 10 minutes. Service is unstable.

**Fix:** Investigate `/home/hermes/logs/hermes-api-error.log`, fix root cause, stabilize.

---

## SECTION B: PERFORMANCE & RELIABILITY

### B1. Vercel Cold Starts (🟡 Medium)
153K LOC + 17 DB migrations at build time = slow cold starts. Neptune Chat could benefit from:
- Route segment splitting (break `/admin`, `/library`, `/harness` into separate route groups)
- Migrations as a separate build step (not in `prebuild`)
- Edge caching for static pages

### B2. Twenty Resource Optimization (🟡 Medium)
Twenty server + worker combined: 1.2 GiB RAM. At scale (50+ agents), this grows linearly.
- Tune BullMQ worker concurrency
- Consider moving worker to separate host
- Redis maxmemory policy review

### B3. DB Port Exposure (🟠 High)
5 PostgreSQL + 4 Redis instances on 0.0.0.0 — accessible from anywhere with correct credentials.
- Move to Docker internal networks
- Add iptables rules limiting to localhost
- Enable PostgreSQL `pg_hba.conf` host restrictions

### B4. No Swap Configuration (🟠 High)
0 swap = OOM killer terminates processes under memory pressure. 15 GiB RAM but no safety net.
- Add 4 GiB swapfile

---

## SECTION C: SECURITY HARDENING

### C1. Secret Sprawl (🟡 Medium)
79 secrets in `/etc/newleaf/.env`, 94 in Vercel, 88 in `.env.local`, scattered across docker-compose files.
- **Phase 40 target:** HashiCorp Vault or Doppler for centralized secret management
- **Near-term:** At minimum, document which secrets are in which location

### C2. Webhook Signature Validation (🟡 Medium)
V2 has HMAC-SHA256 webhook signing. Chat has `WEBHOOK_SIGNING_SECRET` but enforcement coverage is unclear.
- Audit all webhook receivers for signature validation
- Twenty webhooks need signing configured

### C3. Docker Image Pinning (🟢 Low)
Several containers use `:latest` tags (n8n, Twenty, FalkorDB, Hyperswitch control-center). A breaking upstream change could take down production.
- Pin all images to specific SHAs

### C4. No DB Backups (🟠 High)
No pg_dump or wal-g backup cron found for any of the 5 PostgreSQL instances.
- Add nightly pg_dump for all instances
- Store in `/home/hermes/data/backups/` with 7-day retention

---

## SECTION D: FEATURE GAPS

### D1. No Email (Resend) (🟡 Medium)
Resend API key exists but Twenty is set to `EMAIL_DRIVER=logger` — no transactional emails.
- Wire Resend SMTP in Twenty config
- Set up welcome email, payment receipt, dispute update templates

### D2. n8n Underutilized (🟡 Medium)
n8n is running with 0 workflows. It's an expensive Docker stack doing nothing.
- Minimum: CRM sync workflow (Base44 → Twenty nightly)
- Next: Billing alert workflow (NMI failure → Slack #jarvis-admin)

### D3. No Voice Agents (🟡 Medium)
VAPI key exists, connector skill exists, but no voice agents are deployed.
- Agent outbound calls for payment reminders
- Inbound IVR for customer support

### D4. Chat Testing Gap (🟡 Medium)
Neptune Chat: only Playwright E2E tests. No Vitest/Jest unit tests for 100K TypeScript lines.
- Add Vitest to Chat
- Target: 30% coverage on critical paths (auth, db, routing)

### D5. Real-Time Iframe Sync (🟡 Medium)
Twenty iframe in Chat doesn't reflect real-time changes. No webhook-driven refresh.
- Configure Twenty webhooks → Chat `/api/twenty-webhooks`
- Implement postMessage bridge for iframe state refresh

---

## SECTION E: RECOMMENDED PHASES (RANKED)

### 🥇 Phase 33: **Twenty CRM Foundation** (IMPACT: Critical | EFFORT: 2 weeks)
**Blocked by:** Nothing — all prerequisites ready

**Scope:**
- Deploy custom objects (subscription, payment, dispute, enrollment, activity, ticket)
- Create Twenty API key + configure in VPS env
- Set `IS_SIGN_UP_ENABLED=false`
- Implement iframe auth bridge (token passthrough)
- Deploy Resend SMTP for transactional emails
- Set up nightly Base44 → Twenty sync via n8n workflow

**Acceptance Criteria:**
- [x] Sales agents log into Neptune Chat and see their CRM data in iframe
- [x] 6 custom objects visible in Twenty with sample data
- [x] API key functional — connector can query/create records
- [x] Welcome email sent via Resend on new customer
- [x] Sign-ups disabled on production

**ETA:** 2 weeks  
**Dependencies:** None  
**Risk:** Low — all infrastructure running, just needs configuration

---

### 🥈 Phase 34: **VPS Hardening** (IMPACT: High | EFFORT: 1 week)

**Scope:**
- Fix hermes-api crash loop (62 restarts/10min)
- Firewall DB ports (5 PG + 4 Redis to localhost only)
- Add 4 GiB swapfile
- Add nightly pg_dump cron for all 5 PG instances
- Pin Docker images to SHA digests
- Add iptables rules restricting non-essential ports
- Audit and remove unused integrations (Smithey, TwentyFirst, Swami, Affy)

**Acceptance Criteria:**
- [x] hermes-api stable (0 restarts in 24 hours)
- [x] No DB ports accessible from public internet
- [x] Swap configured and active
- [x] Nightly backups running
- [x] All Docker images pinned

**ETA:** 1 week  
**Dependencies:** None  
**Risk:** Low — configuration changes only, no code

---

### 🥉 Phase 35: **Bulk Migration Wave 2 (50 Customers)** (IMPACT: High | EFFORT: 1 week)

**Scope:**
- Run Base44 → Twenty bulk sync for 50 customers
- Validate data integrity: Person fields, Subscription amounts, Payment history
- Generate sync report with discrepancies
- Create reconciliation dashboard
- Set up webhook-driven real-time sync for ongoing updates

**Acceptance Criteria:**
- [x] 50 customer records synced with <1% error rate
- [x] Sync report generated with actionable discrepancies
- [x] Webhook sync active for creates, updates, deletes

**ETA:** 1 week  
**Dependencies:** Phase 33 (Twenty Foundation)  
**Risk:** Medium — data migration always has edge cases

---

### 4. Phase 36: **Notifications System** (IMPACT: Medium | EFFORT: 2 weeks)

**Scope:**
- Resend email templates: welcome, payment receipt, payment failed, dispute update, account cancelled
- Slack notifications: failed payment → #jarvis-admin, new enrollment → sales channel
- SMS fallback via GHL for payment reminders
- In-app notifications in Neptune Chat (toast + bell icon)

**Acceptance Criteria:**
- [x] 5 email templates live in Resend
- [x] Slack alerts firing on payment failures
- [x] SMS reminders trigger when email bounces
- [x] In-app notification bell functional

**ETA:** 2 weeks  
**Dependencies:** Phase 33 (Resend SMTP), GHL integration  
**Risk:** Low

---

### 5. Phase 37: **VAPI Voice Agent** (IMPACT: Medium | EFFORT: 2 weeks)

**Scope:**
- Configure VAPI outbound agent for payment reminders
- Inbound IVR: "Press 1 for billing, 2 for support, 3 for enrollment"
- Call outcome → Twenty activity log
- Integration with NMI for "pay by phone" flow
- Use Vercel AI Gateway BYOK for voice model routing

**Acceptance Criteria:**
- [x] Outbound payment reminder calls working
- [x] Inbound IVR routing correctly
- [x] Call transcripts stored in Twenty Activity
- [x] "Pay by phone" processes NMI transaction

**ETA:** 2 weeks  
**Dependencies:** VAPI API key (exists), NMI connector (exists)  
**Risk:** Medium — voice UX requires careful flow design

---

### 6. Phase 38: **Reporting Dashboard** (IMPACT: Medium | EFFORT: 3 weeks)

**Scope:**
- Revenue dashboard: MRR, churn, collections rate
- Agent performance: enrollments, calls, tickets closed
- Dispute tracking: rounds, bureau response rates
- Pipeline health: enrollment funnel conversion
- Export to CSV/PDF

**Acceptance Criteria:**
- [x] 5 dashboard tabs with live data
- [x] Date range filters working
- [x] CSV export functional
- [x] Dashboard accessible from Neptune Chat `/reports`

**ETA:** 3 weeks  
**Dependencies:** Phase 35 (bulk migration — needs data in Twenty)  
**Risk:** Medium — reporting data aggregation complexity

---

### 7. Phase 39: **Mobile PWA** (IMPACT: Medium | EFFORT: 3 weeks)

**Scope:**
- Neptune Chat PWA with offline support
- Service worker for caching
- Push notifications via Web Push API
- Mobile-optimized Twenty iframe
- Offline queue: actions sync when online
- Install prompt on iOS/Android

**Acceptance Criteria:**
- [x] PWA installable on iOS + Android
- [x] Offline mode shows cached data
- [x] Push notifications working
- [x] Lighthouse PWA score > 90

**ETA:** 3 weeks  
**Dependencies:** Phase 36 (notifications system)  
**Risk:** Medium — PWA requires significant frontend work

---

### 8. Phase 40: **Multi-Tenancy** (IMPACT: Medium | EFFORT: 4 weeks)

**Scope:**
- Twenty multi-workspace setup per partner/affiliate
- Role-based access: admin, agent, viewer
- Data isolation between workspaces
- Cross-workspace reporting for admins
- Billing per workspace

**Acceptance Criteria:**
- [x] 3 workspaces with isolated data
- [x] Role-based permissions enforced
- [x] Admin can view all workspaces
- [x] Workspace-level billing functional

**ETA:** 4 weeks  
**Dependencies:** Phase 33 (Twenty Foundation)  
**Risk:** High — multi-tenancy touches auth, data, billing

---

### 9. Phase 41: **Customer Portal v2** (IMPACT: Medium | EFFORT: 3 weeks)

**Scope:**
- Customer-facing portal: view subscription, payment history, dispute status
- Self-service: update payment method, download statements
- Chat support widget
- Document upload for disputes

**Acceptance Criteria:**
- [x] Customer login working
- [x] Payment method update functional (NMI vault)
- [x] Statement download
- [x] Chat widget connected to Neptune Chat

**ETA:** 3 weeks  
**Dependencies:** Phase 33, Phase 36  
**Risk:** Medium — customer-facing means security-critical

---

### 10. Phase 42: **Compliance & Audit** (IMPACT: Low | EFFORT: 2 weeks)

**Scope:**
- SOC 2 audit preparation
- PCI DSS compliance review (NMI scope)
- Data retention policies
- Access audit logs
- Secret rotation automation
- GDPR data export/deletion

**Acceptance Criteria:**
- [x] Audit log export functional
- [x] Secret rotation script written
- [x] Data retention policy documented
- [x] GDPR export endpoint functional

**ETA:** 2 weeks  
**Dependencies:** Phase 34 (VPS hardening)  
**Risk:** Low — mostly documentation + scripts

---

## SECTION F: PHASE DEPENDENCY GRAPH

```
Phase 33 (Twenty Foundation) ─────┬──▶ Phase 35 (Bulk Migration)
                                  │
                                  ├──▶ Phase 36 (Notifications) ──▶ Phase 39 (PWA)
                                  │
                                  ├──▶ Phase 37 (VAPI Voice)
                                  │
                                  ├──▶ Phase 40 (Multi-Tenancy)
                                  │
                                  └──▶ Phase 41 (Customer Portal)

Phase 34 (VPS Hardening) ─────────────▶ Phase 42 (Compliance)

Phase 38 (Reporting) ─── depends on ──▶ Phase 35 (Bulk Migration)
```

---

## SECTION G: RISK MATRIX

| Phase | Impact | Effort | Risk | Priority Score |
|-------|--------|--------|------|----------------|
| 33 — Twenty Foundation | 🔴 Critical | 2w | Low | **10** |
| 34 — VPS Hardening | 🟠 High | 1w | Low | **9** |
| 35 — Bulk Migration Wave 2 | 🟠 High | 1w | Medium | **8** |
| 36 — Notifications | 🟡 Medium | 2w | Low | **6** |
| 37 — VAPI Voice | 🟡 Medium | 2w | Medium | **5** |
| 38 — Reporting | 🟡 Medium | 3w | Medium | **4** |
| 39 — Mobile PWA | 🟡 Medium | 3w | Medium | **3** |
| 40 — Multi-Tenancy | 🟡 Medium | 4w | High | **2** |
| 41 — Customer Portal | 🟡 Medium | 3w | Medium | **3** |
| 42 — Compliance | 🟢 Low | 2w | Low | **2** |

*(Priority Score = Impact × (1/Effort) × (1/Risk) — higher is better)*

---

## SECTION H: TOP 10 FINDINGS (Executive Summary)

1. **Twenty CRM is shelfware** — running but unusable (no objects, no API key, no auth bridge)
2. **hermes-api is crash-looping** — 62 restarts in 10 minutes, needs immediate fix
3. **9 databases exposed** to the public internet (5 PG + 4 Redis on 0.0.0.0)
4. **0 swap** — OOM = process killed, no safety net
5. **100 secrets in 6 locations** — no rotation, no audit, no centralized management
6. **0 n8n workflows** — expensive Docker stack doing nothing
7. **Resend API key exists but unused** — no transactional emails anywhere
8. **VAPI key exists but no voice agents** — missed automation opportunity
9. **Neptune Chat has 0 unit tests** — 100K TypeScript, only Playwright E2E
10. **V2 webhook signing is solid** — HMAC-SHA256, retry, dead letter — but Chat coverage unknown

---

*Generated 2026-06-17 · Gap Analysis & Next Phases Roadmap · Stream 5 of 7 · Read-only*
