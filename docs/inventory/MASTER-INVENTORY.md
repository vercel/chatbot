---
type: "concept"
name: "MASTER INVENTORY"
description: "Auto-generated description for MASTER INVENTORY"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# Neptune Chat — Master Function Inventory

**Date:** 2026-06-11  
**Mission:** U1.3 Comprehensive Function Inventory  
**Purpose:** Single source of truth for all wrapped vs available functions across all surfaces.
Drives U2 wrapping plan and /connectors UI accuracy.

---

## Summary Table

| # | Connector | Wrapped (Neptune) | Available (Backend) | Gap | Priority |
|---|-----------|-------------------|---------------------|-----|----------|
| 1 | Base44 CRM | 6 | 246+ | 240+ | **P0** |
| 2 | Slack | 5 | 20+ | 15+ | **P0** |
| 3 | NMI Payments | 4 | 30+ | 26+ | **P0** |
| 4 | Vapi Voice AI | 2 | 15+ | 13+ | **P0** |
| 5 | GHL CRM | 5 | 10+ | 5+ | **P0** |
| 6 | GitHub | 6 | 15+ | 9+ | P1 |
| 7 | Vercel | 5 | 12+ | 7+ | P1 |
| 8 | Hyperswitch | 3 | 8+ | 5+ | P1 |
| 9 | Forth Credit | 5 | 8+ | 3+ | P1 |
| 10 | Affy Chargebacks | 4 | 6+ | 2+ | P2 |
| 11 | Linear | 4 | 8+ | 4+ | P2 |
| 12 | Wiki | 5 | 6+ | 1+ | P2 |
| 13 | MCP Hub | 3 | 5+ | 2+ | P2 |
| 14 | VPS | 0 | 15+ | 15+ | P1 |
| **TOTAL** | | **57** | **404+** | **347+** | |

---

## 1. Base44 CRM (P0 — THE BIG ONE)

### Neptune Wrapped (6 tools)
- `base44.queryEntity` — Query any entity
- `base44.createEntity` — Create entity record
- `base44.updateEntity` — Update entity by ID
- `base44.invokeFunction` — Call any backend function
- `base44.reportingHub` — Operational reports (16 actions)
- `base44.customer360` — Complete customer dossier

### Base44 Backend — Entity CRUD (91 entities × 4 ops = 364 theoretical)
91 entities available: CustomerProfile, PaymentLog, SupportTicket, CallLog, CreditReport, AdminNotification, SlackSubmission, VapiCallEvent, BillingQueue, RecoveryItem, Subscription, NmiTransaction, EmailMessage, GhlMessage, Workflow, Vault, AgentMemory, JarvisFile, JarvisTask, etc. (full list at docs/inventory/base44-entities.md)

### Base44 MCP Bridges (40 tools)
- **Entity CRUD:** b44_query, b44_query_all, b44_stream, b44_get, b44_create, b44_update, b44_count, b44_aggregate (8)
- **Legacy read:** read_customer_profile, read_payment_log, read_support_ticket, read_call_log, read_vapi_call_event, read_admin_notification (6)
- **Cross-system:** cross_system_lookup, b44_customer_360 (2)
- **Action queue:** emit_action, emit_finding (2)
- **File system:** fs_list, fs_read, fs_search, fs_write, jarvis_fs (5)
- **NMI bridge:** nmi_mcp_bridge (1)
- **Slack bridge:** slack_mcp_bridge (1)
- **Reporting:** reporting_hub (1)
- **Schema:** schema_describe, schema_list_entities (2)
- **Validated query:** validated_query, query_warehouse (2)
- **Knowledge graph:** query_code_graph, query_cortex_graph (2)
- **Web search:** web_search (1)
- **Context management:** rc_add_item, rc_read, session_deposit (3)
- **Task management:** create_task, complete_task (2)
- **Cognitive:** jarvis_brain_relay (1)
- **Function invoke:** b44_invoke (1)

### Base44 reportingHub Actions (16)
overview, enrollments, lead_flow, billing, communications, calls, agents, support, automations, activity_feed, customer_360, customer_comms, sync_health, morning_pulse, vapi_intelligence, enrollment_intelligence

### P0 Wrap Targets (U2)
1. All 40 MCP bridge tools as Neptune connector tools
2. Top 20 entity CRUD operations (CustomerProfile, PaymentLog, SupportTicket, CallLog, etc.)
3. reportingHub all 16 actions as individual tools
4. nmiMcpBridge, slackMcpBridge passthrough tools
5. jarvisFileSystem, jarvisTaskManager full actions

---

## 2. Slack Communications (P0)

### Neptune Wrapped (5 tools)
- `slack.pullMessages`
- `slack.postMessage`
- `slack.searchChannels`
- `slack.listChannels`
- `slack.reactionAdd`

### Slack MCP Bridge Available (20 actions)
**Read:** health_check, list_channels, get_channel, channel_history, thread_replies, search_messages, list_users, get_user, get_user_by_email, get_reactions  
**Write:** send_message, send_thread_reply, send_dm, add_reaction, remove_reaction, update_message, delete_message, set_topic, set_purpose, schedule_message

### P0 Wrap Targets (U2)
All 20 slackMcpBridge actions as individual Neptune tools

---

## 3. NMI Payments (P0)

### Neptune Wrapped (4 tools)
- `nmi.queryTransactions`
- `nmi.getVault`
- `nmi.getSubscription`
- `nmi.refund`

### NMI MCP Bridge Available (30+ actions)
charge, refund, void, vault_create, vault_update, subscription_create, subscription_cancel, transaction_query, customer_vault_query, + CoF audit, golden vault, invoicing, products, txt2pay

### P0 Wrap Targets (U2)
All nmiMcpBridge actions as individual Neptune tools + CoF toolkit (health-scan, deep-inspect, recover, relink, provision-token), Golden Vault toolkit (validate-card, create-vault, mit-charge, cit-charge)

---

## 4. Vapi Voice AI (P0)

### Neptune Wrapped (2 tools)
- `vapi.getCallLogs`
- `vapi.getTranscript`

### Vapi MCP Bridge Available (15+ actions)
call_logs, transcripts, agent_analytics, call_outcomes, cost_reports, etc.

### P0 Wrap Targets (U2)
Full vapiMcpBridge passthrough

---

## 5. GHL CRM (P0)

### Neptune Wrapped (5 tools)
- `ghl.createContact`
- `ghl.sendSms`
- `ghl.sendEmail`
- `ghl.queryConversations`
- `ghl.getOpportunity`

### GHL MCP Bridge Available (10+ actions)
Contacts, SMS, email, conversations, pipeline, opportunities, campaigns

### P0 Wrap Targets (U2)
Full ghlMcpBridge passthrough

---

## 6. GitHub (P1)

### Neptune Wrapped (6 tools)
- `github.searchCode`
- `github.getFile`
- `github.listPRs`
- `github.createPR`
- `github.listRepos`
- `github.spawnCodingAgent`

### Available (15+ actions)
Issue CRUD, label management, branch operations, workflow dispatch, repo settings

---

## 7. Vercel Deploy (P1)

### Neptune Wrapped (5 tools)
- `vercel.listDeploys`
- `vercel.getDeployLog`
- `vercel.listProjects`
- `vercel.createProject`
- `vercel.redeploy`

### Available (12+ endpoints)
/v9/projects/{id}/env, /v9/projects/{id}/domains, /v6/deployments, /v1/integrations, /v4/usage

---

## 8–13. Other Connectors

| Connector | Wrapped | Available Backend |
|-----------|---------|-------------------|
| Hyperswitch | 3 (createPaymentLink, listPayments, refundPayment) | 8+ |
| Forth Credit | 5 (getDisputes, updateDispute, queryContact, pullCreditReport, listEnrollments) | 8+ |
| Affy | 4 (getChargebacks, submitEvidence, generateAffidavit, trackDispute) | 6+ |
| Linear | 4 (listIssues, createIssue, searchIssues, listProjects) | 8+ |
| Wiki | 5 (ingestSource, queryWiki, lintWiki, writeWikiPage, updateIndex) | 6+ |
| MCP Hub | 3 (listServers, connectServer, listTools) | 5+ |

---

## 14. VPS Functions (P1)

### Currently Wrapped: 0

### Available (15+)
- hostingerBridge: run_command, get_job, list_jobs (via b44_invoke)
- claude-agent-api: /v1/dispatch, /v1/sessions, /v1/runtimes, /v1/code/{file}
- hermes-api: /health, /status
- pm2: status, list, logs (read-only)
- file operations: read, write, list (via hostingerBridge)

---

## 15. Vercel REST API Endpoints

### Currently Wrapped: 5 (via vercel connector)
### Available (12+)
- GET /v6/deployments
- GET /v9/projects
- POST /v10/projects
- GET /v9/projects/{id}/env
- POST /v9/projects/{id}/env
- GET /v9/projects/{id}/domains
- GET /v1/deployments/{id}/events (build logs)
- GET /v4/now/teams
- GET /v1/integrations
- POST /v13/deployments
- DELETE /v9/projects/{id}
- PATCH /v9/projects/{id}

---

## U2 Wrap Priority Order

1. **Base44** — 40 MCP tools + 16 reporting actions + top 20 entity CRUD
2. **Slack** — 20 slackMcpBridge actions
3. **NMI** — 30+ nmiMcpBridge actions + CoF + Golden Vault
4. **Vapi** — 15+ vapiMcpBridge actions
5. **GHL** — 10+ ghlMcpBridge actions
6. **VPS** — 15+ VPS functions
7. **Vercel** — 12+ REST endpoints
8. **GitHub** — 15+ actions

---

## Data Sources

- lib/connectors/registry.ts — all 13 Neptune connector manifests
- Base44 MCP tools — 40 tools verified via schema_list_entities + tool catalog
- Slack MCP bridge — 20 actions verified via slackMcpBridge downstreamResponse
- NMI MCP bridge — 9 confirmed + ~21 documented
- Vercel REST API — official docs
- VPS — hostingerBridge + claude-agent-api routes

**Generated:** 2026-06-11 by U1.3 inventory sweep  
**Next:** U2 will wrap top 5 P0 connectors comprehensively
