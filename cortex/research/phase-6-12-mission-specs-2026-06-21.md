# Phase 6: Neptune Chat Connector — 12 Mission Specs (Tier 1)
**Date:** 2026-06-21 03:45 UTC | **Status:** DRAFT | **Total Budget:** ~4,400 turns

---

## Tier Structure

| Tier | Missions | Budget | Priority |
|------|----------|--------|----------|
| Tier 1 | M-NC-1 through M-NC-4 | ~1,300t | P0 — Blocking |
| Tier 2 | M-NC-5 through M-NC-8 | ~1,350t | P1 — Important |
| Tier 3 | M-NC-9 through M-NC-12 | ~1,350t | P2 — Nice-to-have |

---

## M-NC-1: Base44 + Functions Connector (400t)

**Priority:** P0 | **Budget:** 400 turns | **Dependencies:** None

### Problem
Neptune Chat's Base44 connector uses `@base44/sdk` for entity reads but CANNOT invoke functions (`reportingHubQuery`, `crossSystemLookup`, `jarvisFileSystem`, `jarvisTaskManager`, MCP bridges) because functions endpoint returns 403 "Admin required" with current auth.

### Phases
1. **Auth Audit (50t)**: Test all 5 auth token types against Base44 functions endpoint. Determine which token (APP_API_KEY, NEPTUNE_INTERNAL_TOKEN, BASE44_API_KEY, etc.) grants admin scope for function invocation. Document working auth chain.

2. **Client Rewrite (150t)**: Rewrite `connectors/base44/client.ts` to support dual auth (entity reads via SDK, function invokes via admin token). Add health check endpoint. Follow hermes-vps `client.ts` pattern: `authHeaders()`, `callBase44Function()`, typed responses.

3. **Tool Expansion (100t)**: Add 20+ wrapped tools from inventory (currently 63 wrapped, 246 total). Focus on: `reporting_hub` (16 actions), `cross_system_lookup`, `b44_aggregate`, `b44_count`, `b44_stream`, `b44_customer_360`, `query_code_graph`, `query_cortex_graph`, `query_warehouse`, `emit_finding`, `emit_action`.

4. **MCP Bridge Delegate (50t)**: Fix `nmi_invoke`, `slack_invoke`, `ghl_invoke`, `vapi_invoke` delegates. They currently route through `base44Service.functions.invoke()` which fails. Provide fallback: direct VPS tools-bridge calls.

5. **Testing + Docs (50t)**: Test all 83 actions (63 existing + 20 new). Write `connectors/base44/SKILL.md` update. Deploy + verify.

### Deliverables
- Working Base44 connector with 83+ wrapped actions
- `connectors/base44/client.ts` v2 with dual auth
- `connectors/base44/SKILL.md` updated
- Slack #jarvis-admin summary

### Acceptance Criteria
- AC-1: `customer_360` returns Shirley Cassity's complete dossier
- AC-2: `reporting_overview` returns aggregate stats
- AC-3: `jarvis_file_read("jarvis/prd/...")` returns file content
- AC-4: `nmi_invoke({bridgeAction:"health_check"})` returns 200
- AC-5: All 83 actions documented in manifest capabilities

### Cardinals
- Slack #jarvis-admin C0AQDDC3HAB only
- No touching Twenty CRM, neptune-v2, hermes-vps
- No committing secrets to git
- Follow hermes-vps SKILL.md + client.ts + actions.ts pattern

---

## M-NC-2: NMI + Hyperswitch Connector (350t)

**Priority:** P0 | **Budget:** 350 turns | **Dependencies:** M-NC-1 (needs function invoke fix)

### Problem
NMI client routes through VPS tools-bridge (`https://jarvis.newleaf.financial/tools-bridge`) but bridge health is unverified. No fallback path. Hyperswitch connector is client-side only (localhost:8080) and not connected to production.

### Phases
1. **Bridge Health Verification (50t)**: Test `jarvis.newleaf.financial/tools-bridge/tool/nmi/healthCheck` with multiple auth tokens. If down, diagnose and restore. Test all 41 NMI actions through bridge.

2. **NMI Client Hardening (100t)**: Add health check before dispatch. Add retry with exponential backoff. Add fallback path through Base44 functions if bridge is down. Add `connectors/nmi/actions.ts` (follow hermes-vps pattern).

3. **Hyperswitch Production Integration (100t)**: Wire `HYPERSWITCH_PUBLIC_BASE_URL` (pay.newleaf.financial) for live payment links. Add API key rotation support. Add payment link creation + status tracking tools.

4. **Golden Vault Toolkit (50t)**: Ensure all 6 Golden Vault actions work (validate_card, create_vault, mit_charge, cit_charge, inspect, full_test). These are critical for recovery wizard.

5. **Testing + Docs (50t)**: Test all 41 NMI + 22 Hyperswitch actions end-to-end. Write `connectors/nmi/SKILL.md` and `connectors/hyperswitch/SKILL.md` updates.

### Deliverables
- Working NMI connector with all 41 actions through bridge
- Hyperswitch connector with live payment links
- Golden Vault toolkit verified
- `connectors/nmi/actions.ts`

### Acceptance Criteria
- AC-1: `nmi.health_check` returns success
- AC-2: `nmi.query_vault({vaultId: "..."})` returns Mary Nazworth's vault
- AC-3: `nmi.query_subscriptions_bulk` returns all active subscriptions
- AC-4: `hyperswitch.create_payment_link` generates a working URL
- AC-5: `nmi.gv_validate_card` validates a test card

### Cardinals
- NMI security key NEVER leaves VPS
- All NMI calls proxy through bridge, not direct
- MIT (card_auth=1 + dup_seconds=0) required per NMI CVV 225 fix
- No source_transaction_id (banned per Golden Vault Architecture)

---

## M-NC-3: Customer Identity Resolver (250t)

**Priority:** P0 | **Budget:** 250 turns | **Dependencies:** M-NC-1, M-NC-2

### Problem
Neptune Chat has no identity resolver. Users can't look up customers by name, email, or phone. Jarvis-Base44 can because MCP tools accept direct entity queries — Neptune Chat needs a fuzzy resolver.

### Phases
1. **Resolver Core (100t)**: Implement `lib/identity/resolver.ts` with multi-source search (Base44 + NMI + Slack). Fuzzy name matching (Levenshtein + regex). Confidence scoring. Phase A (candidate fetch) + Phase B (enrichment).

2. **Connector Package (80t)**: Create `connectors/customer-identity/` following hermes-vps pattern: `SKILL.md`, `client.ts`, `actions.ts`, `manifest.ts`, `tools/resolve.ts`. Register in `lib/connectors/init.ts`.

3. **NLU Integration (40t)**: Wire into Neptune Chat's intent router. When a user says "look up <name>" or "find <phone>", route to identity resolver. Display `IdentityMatchCard` with confidence score + vault/sub data.

4. **Testing (30t)**: Test with live data: Mary Nazworth, Zachary Taylor, Larry Shaw, Carolyn Wickerson. Verify fuzzy typo tolerance. Measure response time.

### Deliverables
- `lib/identity/resolver.ts` — core resolver
- `connectors/customer-identity/` — full connector package
- `components/chat/identity-match-card.tsx` — result renderer
- Full design doc: `cortex/research/phase-4-customer-identity-resolver-design-2026-06-21.md` (ALREADY WRITTEN)

### Acceptance Criteria
Per Phase 4 design — 7 AC items defined.

---

## M-NC-4: Reporting Hub + Slack Connector (300t)

**Priority:** P0 | **Budget:** 300 turns | **Dependencies:** M-NC-1

### Problem
Reporting hub actions fail because functions endpoint returns 403. Slack connector exists but has 27 wrapped actions out of 27 possible — needs discoverability improvements and better search/dispatch patterns.

### Phases
1. **Reporting Hub Activation (100t)**: Once M-NC-1 fixes function auth, activate all 16 reporting actions. Build `connectors/base44/tools/reportingHub.ts` with structured output renderers (tables, cards).

2. **Slack Deep Search (80t)**: Add `search_all_channels` action (parallel search across all channels). Add `pull_thread_context` (pull thread + parent message). Add `user_activity_timeline` (last N messages by user).

3. **Discovery Workflow Hooks (70t)**: Wire reporting + Slack into Discovery workflows. "Morning pulse" → reporting.overview + Slack summary. "Customer comms audit" → customer_comms + slack_messages.

4. **Testing + Docs (50t)**: Test all 16 reporting + 27 Slack actions. Verify channel name→ID resolution. Test #jarvis-admin posting.

### Deliverables
- Reporting hub with all 16 actions working
- Slack connector with 30+ actions (27 existing + 3 new)
- Discovery workflow integration

### Acceptance Criteria
- AC-1: `reporting.overview` returns aggregate counts across all entities
- AC-2: `reporting.morning_pulse` returns morning snapshot
- AC-3: `slack.search_all_channels("Mary Nazworth")` finds messages across channels
- AC-4: `slack.pull_thread_context` returns full thread with context

---

## M-NC-5: GHL + Vapi + Freshcaller Connector (450t)

**Priority:** P1 | **Budget:** 450 turns | **Dependencies:** M-NC-1

### Problem
GHL connector has only 5 wrapped tools (out of 10 possible). Vapi has 16 wrapped (out of 16 possible — good). No Freshcaller connector exists at all. These are critical for customer communication tracking.

### Phases
1. **GHL Expansion (150t)**: Add 5 remaining tools: pipeline_opportunities, email_templates, campaign_analytics, conversation_history, contact_merge. Wire GHL_API_KEY + GHL_LOCATION_ID (both placeholders in .env.local — need real values).

2. **Vapi Hardening (100t)**: Verify all 16 Vapi actions work. Add call transcript search. Add sentiment analysis from call transcripts. Add Vapi webhook handler for real-time call events.

3. **Freshcaller Connector (200t)**: NEW connector. Follow hermes-vps pattern. Actions: list_calls, get_call_details, search_calls, list_agents, get_agent_status, create_call_notes. Auth via FRESHCALLER_API_KEY. Store in `connectors/freshcaller/`.

### Deliverables
- GHL connector with 10 wrapped tools
- Vapi connector with 16 tools verified + 2 new
- Freshcaller connector (new) with 6 tools
- `connectors/freshcaller/` package

### Acceptance Criteria
- AC-1: `ghl.get_contact({email})` returns GHL contact for a customer
- AC-2: `vapi.get_call_transcript({callId})` returns full transcript
- AC-3: `freshcaller.search_calls({phone})` returns call history
- AC-4: Cross-connector: customer 360 includes GHL + Vapi + Freshcaller data

---

## M-NC-6: Forth + Twilio + Resend Connector (350t)

**Priority:** P1 | **Budget:** 350 turns | **Dependencies:** None (independent HTTP APIs)

### Problem
Forth connector has 5 wrapped tools (out of 8) with placeholder API key. No Twilio connector exists. Resend connector has API key set but no wrapped tools.

### Phases
1. **Forth Completion (100t)**: Add 3 remaining tools: dispute_status_tracker, evidence_upload, bureau_response_handler. Replace PLACEHOLDER_SET_BY_USER with real Forth DPP API key.

2. **Twilio Connector (150t)**: NEW connector. Follow hermes-vps pattern. Actions: send_sms, get_message_status, list_messages, get_phone_number, lookup_carrier. Auth via TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN. Store in `connectors/twilio/`.

3. **Resend Connector (100t)**: Create `connectors/resend/` with wrapped tools: send_email, get_email_status, list_emails, create_template. Auth via RESEND_API_KEY (already set: `re_Cbz6U1iR_...`).

### Deliverables
- Forth connector with 8 wrapped tools
- Twilio connector (new) with 5 tools
- Resend connector (new) with 4 tools
- `connectors/twilio/`, `connectors/resend/`

### Acceptance Criteria
- AC-1: `forth.get_dispute_status({disputeId})` returns current status
- AC-2: `twilio.send_sms({to, body})` sends real SMS
- AC-3: `resend.send_email({to, subject, html})` sends real email

---

## M-NC-7: GitHub + Vercel + Linear Connector (400t)

**Priority:** P1 | **Budget:** 400 turns | **Dependencies:** None

### Problem
GitHub (6/15 wrapped), Vercel (5/12, missing token), Linear (4/8) connectors exist but are incomplete. Vercel token is empty in .env.example. These are critical for code-deploy workflows.

### Phases
1. **GitHub Expansion (120t)**: Add 9 remaining tools: create_pr, merge_pr, get_pr_reviews, list_prs, get_commit, compare_branches, create_issue, label_issue, workflow_dispatch. GITHUB_TOKEN already set in .env.local.

2. **Vercel Completion (150t)**: Set VERCEL_TOKEN (from user/admin). Add 7 remaining tools: create_deployment, list_projects, get_project_env, set_project_env, get_deployment_events, cancel_deployment, get_domains. Follow existing `lib/deploy/vercel-verify.ts` patterns.

3. **Linear Expansion (80t)**: Add 4 remaining tools: search_issues, get_cycle, list_projects, create_project. LINEAR_API_KEY already set (`lin_api_4c9iD...`).

4. **Integration Testing (50t)**: Test cross-connector workflow: create GitHub issue → create Linear task → deploy fix via Vercel → post result to Slack.

### Deliverables
- GitHub connector with 15 wrapped tools
- Vercel connector with 12 wrapped tools
- Linear connector with 8 wrapped tools
- Cross-connector workflow test

### Acceptance Criteria
- AC-1: `github.create_pr({title, body, head, base})` creates real PR
- AC-2: `vercel.get_deployment_events({deployId})` returns build events
- AC-3: `linear.search_issues({query})` returns matching issues

---

## M-NC-8: Twenty CRM Connector (300t)

**Priority:** P1 | **Budget:** 300 turns | **Dependencies:** None
**⚠️ CARDINAL EXCEPTION:** This is spec creation ONLY. DO NOT implement or touch Twenty CRM until explicitly approved. The cardinal `e7129f554293` explicitly blocks touching Twenty CRM.

### Problem
No Twenty CRM connector exists. Twenty CRM is a critical data hub for NewLeaf operations. However, cardinals block touching it. This mission creates the SPEC only — implementation is gated on cardinal removal.

### Phases
1. **API Research (80t)**: Research Twenty CRM REST API. Document endpoints for: workspaces, people, companies, opportunities, activities, notes, tasks, webhooks.

2. **Spec Writing (120t)**: Write complete connector spec following hermes-vps pattern. Document all tool signatures, auth patterns, env vars, data models.

3. **Integration Map (50t)**: Document how Twenty CRM data flows to/from other connectors (Base44 sync, Slack → Twenty activity, n8n workflows).

4. **Gate Document (50t)**: Write implementation gate document explaining why cardinal blocks implementation, what needs to change, and risk assessment.

### Deliverables
- `connectors/twenty/TWENTY-CONNECTOR-SPEC.md` — full spec
- `connectors/twenty/integration-map.md` — data flow map
- `connectors/twenty/IMPLEMENTATION-GATE.md` — cardinal-gate doc
- NO CODE — spec only

### Acceptance Criteria
- AC-1: Spec documents all 15+ Twenty CRM API endpoints
- AC-2: All tool signatures defined with Zod schemas
- AC-3: Implementation gate doc explains cardinal blocks clearly

---

## M-NC-9: n8n Native MCP Connector (250t)

**Priority:** P2 | **Budget:** 250 turns | **Dependencies:** None

### Problem
n8n API key exists in .env.local but no n8n connector in Neptune Chat. n8n has 4 existing n8n-workflows for Slack→Twenty and Linear→Twenty integrations. Need to expose n8n workflows as callable tools.

### Phases
1. **n8n API Research (50t)**: Research n8n REST API (workflows, executions, credentials, webhooks). Document auth pattern (API key in header).

2. **Connector Package (120t)**: Create `connectors/n8n/` following hermes-vps pattern. Actions: list_workflows, get_workflow, execute_workflow, get_execution_status, list_executions, create_webhook, manage_credentials.

3. **Existing Workflow Migration (50t)**: Document 4 existing n8n workflows from `connector-skills/n8n-workflows/`. Map them to n8n connector actions.

4. **Testing (30t)**: Test workflow execution through connector. Verify N8N_API_KEY works (already set: `eyJhbG...`).

### Deliverables
- `connectors/n8n/` — full connector package
- 4 existing workflows mapped to connector actions
- Workflow execution tested

### Acceptance Criteria
- AC-1: `n8n.list_workflows()` returns all workflows
- AC-2: `n8n.execute_workflow({workflowId, data})` triggers execution
- AC-3: `n8n.get_execution_status({executionId})` returns status

---

## M-NC-10: Composio + Smithery Connector (300t)

**Priority:** P2 | **Budget:** 300 turns | **Dependencies:** Phase 3 research

### Problem
No Composio or Smithery connectors. Both are MCP tool registries that could expose hundreds of tools to Neptune Chat. SMITHERY_API_KEY exists in .env.local (`b9d10f33-...`).

### Phases
1. **Research Synthesis (50t)**: Absorb Phase 3 research findings. Understand Composio MCP server + Smithery registry APIs.

2. **Smithery Connector (120t)**: Create `connectors/smithery/` following hermes-vps pattern. Actions: list_servers, get_server, search_tools, connect_server, disconnect_server, get_server_health. Auth via SMITHERY_API_KEY.

3. **Composio Connector (100t)**: Create `connectors/composio/` following hermes-vps pattern. Actions: list_tools, search_tools, execute_tool, get_tool_schema, list_integrations. Auth via COMPOSIO_API_KEY.

4. **Context-Safe Tool Exposure (30t)**: Implement tool grouping to prevent 50+ tools from flooding agent context. Each MCP server exposes only top-5 most used tools by default. Explicit "search" needed for others.

### Deliverables
- `connectors/smithery/` — full connector package
- `connectors/composio/` — full connector package
- Context-safe tool grouping pattern
- `lib/connectors/tool-grouper.ts` — shared utility

### Acceptance Criteria
- AC-1: `smithery.list_servers()` returns registered MCP servers
- AC-2: `composio.search_tools({query: "payment"})` returns relevant tools
- AC-3: Context stays under limit when 50+ tools registered

---

## M-NC-11: AI Gateway Model Roster (350t)

**Priority:** P2 | **Budget:** 350 turns | **Dependencies:** None

### Problem
Neptune Chat uses Vercel AI Gateway but model roster is implicit. No way to query available models, compare costs, or route prompts to optimal model. AI_GATEWAY_API_KEY is set but not leveraged for model discovery.

### Phases
1. **Model Roster Builder (100t)**: Create `connectors/ai-gateway/` that queries Vercel AI Gateway for available models. Actions: list_models, get_model_info, compare_models, get_pricing.

2. **Cost-Aware Router (120t)**: Implement cost-aware model routing. Define routing rules: simple queries → haiku ($0.80/M), medium → sonnet ($3/M), complex → opus ($15/M). Track usage per model.

3. **Model Health Monitor (80t)**: Monitor availability/latency of each model provider. Fall back to alternate provider if primary is slow/down.

4. **Testing (50t)**: Benchmark all models. Document cost/latency trade-offs. Write `connectors/ai-gateway/MODEL-ROSTER.md`.

### Deliverables
- `connectors/ai-gateway/` — model roster connector
- Cost-aware routing middleware
- `connectors/ai-gateway/MODEL-ROSTER.md` — model comparison doc

### Acceptance Criteria
- AC-1: `ai_gateway.list_models()` returns all available models
- AC-2: Simple query routes to haiku, complex query routes to sonnet
- AC-3: Model health tracked with fallback on failure

---

## M-NC-12: Discovery Workflow Library (400t)

**Priority:** P2 | **Budget:** 400 turns | **Dependencies:** M-NC-1 through M-NC-4 (needs working base connectors)

### Problem
Discovery workflows exist in `lib/workflow/` but are template-based, not dynamic. Can't chain: "Find all customers with failed payments this week → show their Slack messages → create support tickets for the top 5".

### Phases
1. **Workflow Engine (150t)**: Create `lib/workflow/engine.ts` — dynamic workflow builder. Users chain connector actions: `base44.customer_profile_query → nmi.query_subscription → slack.search_messages`. Type-safe action chaining with Zod schema validation between steps.

2. **Template Library (100t)**: Define 10 discovery templates:
   - "Morning Pulse" (reporting.overview + slack.summary)
   - "Failed Payment Triage" (nmi.query + base44.360 + freshdesk.create)
   - "Customer Health Scan" (profile + vault + sub + tickets + messages)
   - "Dispute Response Pipeline" (forth.disputes + base44.negative_items)
   - "Enrollment Funnel" (ghl.contacts + base44.enrollment_status)
   - "Agent Productivity" (vapi.calls + freshcaller.calls + linear.tasks)
   - "Comms Audit" (slack + resend + twilio + ghl.messages)
   - "Code Deploy Chain" (github.pr + vercel.deploy + slack.post)
   - "Billing Recovery" (nmi.declines + base44.profiles + smart_retry)
   - "Weekly Report" (all 16 reporting actions aggregated)

3. **Discovery UI (100t)**: `components/discovery/workflow-builder.tsx` — drag-drop action chaining. `DiscoveryTemplateCard` for one-click template execution. Results rendered as connected cards.

4. **Testing (50t)**: Test all 10 templates end-to-end. Measure success rate. Document failure modes.

### Deliverables
- `lib/workflow/engine.ts` — dynamic workflow engine
- 10 discovery workflow templates
- `components/discovery/workflow-builder.tsx`
- `components/discovery/discovery-template-card.tsx`

### Acceptance Criteria
- AC-1: "Morning Pulse" template runs and returns aggregate data
- AC-2: User can chain 3+ connector actions into a custom workflow
- AC-3: Failed Payment Triage creates support tickets for top 5 decline cases
- AC-4: All 10 templates documented with sample output

---

## Dependency Graph

```
M-NC-1 (Base44+Functions)
  ├─→ M-NC-2 (NMI+Hyperswitch)
  ├─→ M-NC-3 (Identity Resolver) ← needs M-NC-1 + M-NC-2
  ├─→ M-NC-4 (Reporting+Slack)
  ├─→ M-NC-5 (GHL+Vapi+Freshcaller)
  └─→ M-NC-12 (Discovery Workflows) ← needs M-NC-1 through M-NC-4

M-NC-6  (Forth+Twilio+Resend) — independent
M-NC-7  (GitHub+Vercel+Linear) — independent
M-NC-8  (Twenty CRM) — spec only, gated
M-NC-9  (n8n MCP) — independent
M-NC-10 (Composio+Smithery) — independent
M-NC-11 (AI Gateway) — independent
```

## Execution Order

1. **Tier 1 (P0)**: M-NC-1 → M-NC-2 || M-NC-4 → M-NC-3 (~1,300t)
2. **Tier 2 (P1)**: M-NC-5 || M-NC-6 || M-NC-7 || M-NC-8 (~1,350t)
3. **Tier 3 (P2)**: M-NC-9 || M-NC-10 || M-NC-11 → M-NC-12 (~1,350t)
