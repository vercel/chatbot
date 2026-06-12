/**
 * VAPI Comprehensive Client — U2.3.E (16 actions)
 *
 * Wraps Vapi voice AI platform operations behind a typed action router.
 * Uses Vapi REST API directly with secrets.vapi.privateKey.
 *
 * Actions:
 *   CALLS:       list_calls, get_call, create_call, end_call
 *   ASSISTANTS:  list_assistants, get_assistant, create_assistant, update_assistant
 *   PHONE NUMS:  list_phone_numbers
 *   ANALYTICS:   get_analytics_overview, get_lead_funnel, get_call_quality
 *   TRANSFERS:   list_transfers, get_transfer_outcome
 *   TOOLS:       list_assistant_tools, update_assistant_tools
 *
 * Usage:
 *   import { execute } from "@/connectors/vapi/client";
 *   const result = await execute({ action: "list_calls", args: { limit: 10 } });
 */

import { secrets } from "@/secrets";

// ── API Config ────────────────────────────────────────────────────────────────

const VAPI_BASE_URL = "https://api.vapi.ai";
const VAPI_KEY = secrets.vapi.privateKey;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ActionRequest {
  action: string;
  args?: Record<string, unknown>;
}

export interface ActionResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  action?: string;
}

// ── API Helper ────────────────────────────────────────────────────────────────

async function vapiFetch(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  queryParams?: Record<string, string>
): Promise<ActionResponse> {
  if (!VAPI_KEY) {
    return { success: false, error: "VAPI_PRIVATE_KEY not configured" };
  }
  try {
    let url = `${VAPI_BASE_URL}${path}`;
    if (queryParams && Object.keys(queryParams).length > 0) {
      const sp = new URLSearchParams(queryParams);
      url += `?${sp.toString()}`;
    }
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${VAPI_KEY}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: `Vapi API returned ${res.status}: ${(data as Record<string, unknown>)?.message || res.statusText}`,
        data,
      };
    }
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: `Vapi API unavailable: ${err instanceof Error ? err.message : "Unknown"}`,
    };
  }
}

function vapiGet(path: string, queryParams?: Record<string, string>): Promise<ActionResponse> {
  return vapiFetch("GET", path, undefined, queryParams);
}

function vapiPost(path: string, body: Record<string, unknown>): Promise<ActionResponse> {
  return vapiFetch("POST", path, body);
}

function vapiPatch(path: string, body: Record<string, unknown>): Promise<ActionResponse> {
  return vapiFetch("PATCH", path, body);
}

function vapiDelete(path: string): Promise<ActionResponse> {
  return vapiFetch("DELETE", path);
}

// ── CALL Actions ──────────────────────────────────────────────────────────────

async function listCalls(args?: Record<string, unknown>): Promise<ActionResponse> {
  const params: Record<string, string> = {};
  if (args?.limit) params.limit = String(args.limit);
  if (args?.assistantId) params.assistantId = args.assistantId as string;
  if (args?.status) params.status = args.status as string;
  const result = await vapiGet("/call", Object.keys(params).length ? params : undefined);
  return { ...result, action: "list_calls" };
}

async function getCall(args?: Record<string, unknown>): Promise<ActionResponse> {
  const callId = args?.callId as string;
  if (!callId) return { success: false, error: "Missing required arg: callId" };
  const result = await vapiGet(`/call/${callId}`);
  return { ...result, action: "get_call" };
}

async function createCall(args?: Record<string, unknown>): Promise<ActionResponse> {
  const assistantId = args?.assistantId as string;
  const phoneNumberId = args?.phoneNumberId as string;
  const customerNumber = args?.customerNumber as string;
  if (!assistantId || !phoneNumberId || !customerNumber) {
    return { success: false, error: "Missing required args: assistantId, phoneNumberId, customerNumber" };
  }
  const result = await vapiPost("/call", {
    assistantId,
    phoneNumberId,
    customer: { number: customerNumber },
    ...(args?.metadata ? { metadata: args.metadata as Record<string, unknown> } : {}),
  });
  return { ...result, action: "create_call" };
}

async function endCall(args?: Record<string, unknown>): Promise<ActionResponse> {
  const callId = args?.callId as string;
  if (!callId) return { success: false, error: "Missing required arg: callId" };
  const result = await vapiPost(`/call/${callId}/actions/end`, {});
  return { ...result, action: "end_call" };
}

// ── ASSISTANT Actions ─────────────────────────────────────────────────────────

async function listAssistants(args?: Record<string, unknown>): Promise<ActionResponse> {
  const params: Record<string, string> = {};
  if (args?.limit) params.limit = String(args.limit);
  const result = await vapiGet("/assistant", Object.keys(params).length ? params : undefined);
  return { ...result, action: "list_assistants" };
}

async function getAssistant(args?: Record<string, unknown>): Promise<ActionResponse> {
  const assistantId = args?.assistantId as string;
  if (!assistantId) return { success: false, error: "Missing required arg: assistantId" };
  const result = await vapiGet(`/assistant/${assistantId}`);
  return { ...result, action: "get_assistant" };
}

async function createAssistant(args?: Record<string, unknown>): Promise<ActionResponse> {
  const name = args?.name as string;
  const model = (args?.model as string) || "gpt-4o";
  const voice = (args?.voice as string) || "nova";
  const firstMessage = (args?.firstMessage as string) || "Hello, how can I help you today?";
  if (!name) return { success: false, error: "Missing required arg: name" };
  const result = await vapiPost("/assistant", {
    name,
    model: { provider: "openai", model },
    voice: { provider: "openai", voiceId: voice },
    firstMessage,
    ...(args?.systemPrompt ? { systemPrompt: args.systemPrompt as string } : {}),
    ...(args?.metadata ? { metadata: args.metadata as Record<string, unknown> } : {}),
  });
  return { ...result, action: "create_assistant" };
}

async function updateAssistant(args?: Record<string, unknown>): Promise<ActionResponse> {
  const assistantId = args?.assistantId as string;
  if (!assistantId) return { success: false, error: "Missing required arg: assistantId" };
  const updates: Record<string, unknown> = {};
  if (args?.name) updates.name = args.name;
  if (args?.firstMessage) updates.firstMessage = args.firstMessage;
  if (args?.systemPrompt) updates.systemPrompt = args.systemPrompt;
  if (args?.model) updates.model = { provider: "openai", model: args.model };
  if (args?.voice) updates.voice = { provider: "openai", voiceId: args.voice };
  const result = await vapiPatch(`/assistant/${assistantId}`, updates);
  return { ...result, action: "update_assistant" };
}

// ── PHONE NUMBER Actions ──────────────────────────────────────────────────────

async function listPhoneNumbers(args?: Record<string, unknown>): Promise<ActionResponse> {
  const params: Record<string, string> = {};
  if (args?.limit) params.limit = String(args.limit);
  const result = await vapiGet("/phone-number", Object.keys(params).length ? params : undefined);
  return { ...result, action: "list_phone_numbers" };
}

// ── ANALYTICS Actions ─────────────────────────────────────────────────────────

async function getAnalyticsOverview(args?: Record<string, unknown>): Promise<ActionResponse> {
  const params: Record<string, string> = {};
  if (args?.startDate) params.start = args.startDate as string;
  if (args?.endDate) params.end = args.endDate as string;
  const result = await vapiGet("/analytics", Object.keys(params).length ? params : undefined);
  return { ...result, action: "get_analytics_overview" };
}

async function getLeadFunnel(args?: Record<string, unknown>): Promise<ActionResponse> {
  const params: Record<string, string> = {};
  if (args?.startDate) params.start = args.startDate as string;
  if (args?.endDate) params.end = args.endDate as string;
  const result = await vapiGet("/analytics/lead-funnel", Object.keys(params).length ? params : undefined);
  return { ...result, action: "get_lead_funnel" };
}

async function getCallQuality(args?: Record<string, unknown>): Promise<ActionResponse> {
  const callId = args?.callId as string;
  if (!callId) return { success: false, error: "Missing required arg: callId" };
  const result = await vapiGet(`/call/${callId}/quality`);
  return { ...result, action: "get_call_quality" };
}

// ── TRANSFER Actions ──────────────────────────────────────────────────────────

async function listTransfers(args?: Record<string, unknown>): Promise<ActionResponse> {
  const params: Record<string, string> = {};
  if (args?.limit) params.limit = String(args.limit);
  if (args?.callId) params.callId = args.callId as string;
  const result = await vapiGet("/transfer", Object.keys(params).length ? params : undefined);
  return { ...result, action: "list_transfers" };
}

async function getTransferOutcome(args?: Record<string, unknown>): Promise<ActionResponse> {
  const transferId = args?.transferId as string;
  if (!transferId) return { success: false, error: "Missing required arg: transferId" };
  const result = await vapiGet(`/transfer/${transferId}`);
  return { ...result, action: "get_transfer_outcome" };
}

// ── TOOL Actions (Assistant Tools) ────────────────────────────────────────────

async function listAssistantTools(args?: Record<string, unknown>): Promise<ActionResponse> {
  const assistantId = args?.assistantId as string;
  if (!assistantId) return { success: false, error: "Missing required arg: assistantId" };
  const result = await vapiGet(`/assistant/${assistantId}/tools`);
  return { ...result, action: "list_assistant_tools" };
}

async function updateAssistantTools(args?: Record<string, unknown>): Promise<ActionResponse> {
  const assistantId = args?.assistantId as string;
  const tools = args?.tools;
  if (!assistantId || !tools) return { success: false, error: "Missing required args: assistantId and tools" };
  const result = await vapiPost(`/assistant/${assistantId}/tools`, { tools });
  return { ...result, action: "update_assistant_tools" };
}

// ── Main Action Router ────────────────────────────────────────────────────────

export async function execute(req: ActionRequest): Promise<ActionResponse> {
  const { action, args } = req;

  switch (action) {
    // CALLS
    case "list_calls": return listCalls(args);
    case "get_call": return getCall(args);
    case "create_call": return createCall(args);
    case "end_call": return endCall(args);
    // ASSISTANTS
    case "list_assistants": return listAssistants(args);
    case "get_assistant": return getAssistant(args);
    case "create_assistant": return createAssistant(args);
    case "update_assistant": return updateAssistant(args);
    // PHONE NUMBERS
    case "list_phone_numbers": return listPhoneNumbers(args);
    // ANALYTICS
    case "get_analytics_overview": return getAnalyticsOverview(args);
    case "get_lead_funnel": return getLeadFunnel(args);
    case "get_call_quality": return getCallQuality(args);
    // TRANSFERS
    case "list_transfers": return listTransfers(args);
    case "get_transfer_outcome": return getTransferOutcome(args);
    // TOOLS
    case "list_assistant_tools": return listAssistantTools(args);
    case "update_assistant_tools": return updateAssistantTools(args);

    default:
      return {
        success: false,
        error: `Unknown action: '${action}'. Available: ${availableActions.slice(0, 12).join(", ")}... (${availableActions.length} total)`,
      };
  }
}

// ── Available Actions Registry ────────────────────────────────────────────────

export const availableActions: string[] = [
  // CALLS
  "list_calls", "get_call", "create_call", "end_call",
  // ASSISTANTS
  "list_assistants", "get_assistant", "create_assistant", "update_assistant",
  // PHONE NUMBERS
  "list_phone_numbers",
  // ANALYTICS
  "get_analytics_overview", "get_lead_funnel", "get_call_quality",
  // TRANSFERS
  "list_transfers", "get_transfer_outcome",
  // TOOLS
  "list_assistant_tools", "update_assistant_tools",
];

export default { execute, availableActions };
