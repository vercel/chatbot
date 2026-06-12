# Vapi Voice AI API Reference — U2.3.E Comprehensive

## Overview

Vapi is the voice AI platform powering NewLeaf's automated customer calls. This connector provides 16 actions across 5 categories using the Vapi REST API (`https://api.vapi.ai`).

## Categories

| Category | Count | Description |
|----------|-------|-------------|
| CALLS | 4 | Call lifecycle (list, get, create, end) |
| ASSISTANTS | 4 | AI assistant configuration and management |
| PHONE NUMBERS | 1 | Phone number inventory |
| ANALYTICS | 3 | Call analytics, lead funnel, quality metrics |
| TRANSFERS | 2 | Call transfer tracking and outcomes |
| TOOLS | 2 | Assistant tool configuration |

## CALL Actions

| Action | Description | Required Args |
|--------|-------------|---------------|
| `list_calls` | List calls with filters | (optional) `limit`, `assistantId`, `status` |
| `get_call` | Get single call details with transcript | `callId` |
| `create_call` | Initiate outbound call | `assistantId`, `phoneNumberId`, `customerNumber` |
| `end_call` | End active call | `callId` |

## ASSISTANT Actions

| Action | Description | Required Args |
|--------|-------------|---------------|
| `list_assistants` | List all AI assistants | (optional) `limit` |
| `get_assistant` | Get assistant details | `assistantId` |
| `create_assistant` | Create new assistant | `name`, (optional) `model`, `voice`, `firstMessage`, `systemPrompt` |
| `update_assistant` | Update assistant config | `assistantId`, any of: `name`, `model`, `voice`, `firstMessage`, `systemPrompt` |

## PHONE NUMBER Actions

| Action | Description | Required Args |
|--------|-------------|---------------|
| `list_phone_numbers` | List provisioned phone numbers | (optional) `limit` |

## ANALYTICS Actions

| Action | Description | Required Args |
|--------|-------------|---------------|
| `get_analytics_overview` | Call volume, duration, cost overview | (optional) `startDate`, `endDate` |
| `get_lead_funnel` | Lead conversion funnel by call outcome | (optional) `startDate`, `endDate` |
| `get_call_quality` | Call quality metrics for a specific call | `callId` |

## TRANSFER Actions

| Action | Description | Required Args |
|--------|-------------|---------------|
| `list_transfers` | List call transfers | (optional) `limit`, `callId` |
| `get_transfer_outcome` | Get transfer result | `transferId` |

## TOOL Actions

| Action | Description | Required Args |
|--------|-------------|---------------|
| `list_assistant_tools` | List tools configured on assistant | `assistantId` |
| `update_assistant_tools` | Update assistant tool configuration | `assistantId`, `tools` |

## Usage Pattern

```typescript
import { execute } from "@/connectors/vapi/client";

// List recent calls
const { data } = await execute({ action: "list_calls", args: { limit: 10 } });

// Create outbound call with Haley v3 assistant
await execute({
  action: "create_call",
  args: {
    assistantId: "asst_haley_v3",
    phoneNumberId: "pn_main",
    customerNumber: "+15551234567",
    metadata: { customerId: "cust_123", campaign: "credit_repair" }
  }
});

// Get lead funnel analytics
const funnel = await execute({
  action: "get_lead_funnel",
  args: { startDate: "2026-06-01", endDate: "2026-06-11" }
});
```

## Authentication

Uses `VAPI_PRIVATE_KEY` from `secrets.vapi.privateKey`. All requests are authenticated with:
```
Authorization: Bearer {VAPI_PRIVATE_KEY}
```

## Response Format

All actions return:
```typescript
{ success: boolean; data?: any; error?: string; action?: string; }
```

## Base URL

`https://api.vapi.ai` — all API calls go directly to Vapi's REST API.
