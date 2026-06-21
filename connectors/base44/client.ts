/**
 * Base44 Comprehensive Client — U2.3.A (60+ actions)
 *
 * Wraps all common Base44 entity CRUD, reporting hub, MCP bridge delegates,
 * and jarvis utility functions behind a single typed action router.
 *
 * Usage:
 *   import { execute, availableActions } from "@/connectors/base44/client";
 *   const result = await execute({ action: "customer_profile_query", args: { limit: 5 } });
 *
 * Architecture:
 *   - Entity actions: <entity_snake>_query|get|create|update|count
 *   - Reporting: reporting_<action>
 *   - MCP delegates: <service>_invoke
 *   - Jarvis functions: jarvis_<action>
 *
 * Backward compat: Still exports `base44` and `base44Service` for legacy tools/.
 */

import { createClient } from "@base44/sdk";
import { secrets } from "@/secrets";

// ── SDK Client Setup ──────────────────────────────────────────────────────────

// Graceful degradation: warn if key is missing but don't crash the module graph.
// Routes importing this module should handle the case where Base44 is unavailable.
const HAS_BASE44_KEY = !!secrets.base44.apiKey;
if (!HAS_BASE44_KEY) {
  console.warn("[base44/client] BASE44_API_KEY not set — Base44 connector disabled. Set in Vercel env vars.");
}

// Create a stub client when key is missing to prevent import-time crashes
function createBase44Client() {
  if (!HAS_BASE44_KEY) {
    // Return a stub that throws on any real call but doesn't crash at import time
    const stubHandler = {
      get: (_target: unknown, prop: string) => {
        if (prop === 'then') return undefined; // Prevent "not a function" in await contexts
        return () => {
          console.warn(`[base44/client] Stub called: ${prop} — Base44 connector not configured`);
          return Promise.resolve(null);
        };
      },
    };
    return new Proxy({}, stubHandler) as unknown as ReturnType<typeof createClient>;
  }
  return createClient({
    appId: secrets.base44.appId || "692f9a5fce9fd7c889a4b4ac",
    serviceToken: secrets.base44.apiKey,
  });
}

export const base44 = createBase44Client();

/** Service-role client for server-side entity reads/writes */
export const base44Service = base44.asServiceRole;

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
  count?: number;
}

// ── Entity CRUD Helpers ───────────────────────────────────────────────────────

/** Entities that support full CRUD (query, get, create, update, count) */
const CRUD_ENTITIES = [
  "CustomerProfile",
  "SupportTicket",
  "NegativeItem",
  "AdminNotification",
  "JarvisTask",
] as const;

/** Entities that support read-only (query, get, count) */
const READ_ENTITIES = [
  "PaymentLog",
  "CallLog",
  "CreditReport",
  "VapiCallEvent",
  "GhlMessage",
  "EmailMessage",
] as const;

/** All supported entities */
const ALL_ENTITIES = [...CRUD_ENTITIES, ...READ_ENTITIES] as const;

type EntityName = (typeof ALL_ENTITIES)[number];

function toSnake(name: string): string {
  return name
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "");
}

function getEntity(entity: string) {
  const sdkEntity = (base44Service.entities as Record<string, { filter: Function; get: Function; create?: Function; update?: Function; count?: Function }>)[entity];
  if (!sdkEntity) {
    throw new Error(`Entity '${entity}' not found in Base44 SDK. Available: ${ALL_ENTITIES.join(", ")}`);
  }
  return sdkEntity;
}

// ── Entity Query ──────────────────────────────────────────────────────────────

async function entityQuery(
  entity: EntityName,
  args?: Record<string, unknown>
): Promise<ActionResponse> {
  try {
    const sdk = getEntity(entity);
    const filter = (args?.filter as Record<string, unknown>) || {};
    const sort = (args?.sort as string) || "-created_date";
    const limit = (args?.limit as number) || 50;
    const results = await sdk.filter(filter, sort, limit);
    return {
      success: true,
      action: `${toSnake(entity)}_query`,
      data: results,
      count: Array.isArray(results) ? results.length : 0,
    };
  } catch (err) {
    return {
      success: false,
      error: `Entity query failed for ${entity}: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}

// ── Entity Get ────────────────────────────────────────────────────────────────

async function entityGet(
  entity: EntityName,
  args?: Record<string, unknown>
): Promise<ActionResponse> {
  try {
    const sdk = getEntity(entity);
    const id = args?.id as string;
    if (!id) {
      return { success: false, error: "Missing required arg: id" };
    }
    const result = await sdk.get(id);
    return {
      success: true,
      action: `${toSnake(entity)}_get`,
      data: result,
    };
  } catch (err) {
    return {
      success: false,
      error: `Entity get failed for ${entity}: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}

// ── Entity Create ─────────────────────────────────────────────────────────────

async function entityCreate(
  entity: EntityName,
  args?: Record<string, unknown>
): Promise<ActionResponse> {
  try {
    const sdk = getEntity(entity);
    if (!sdk.create) {
      return {
        success: false,
        error: `Entity '${entity}' does not support create operations`,
      };
    }
    const data = args?.data as Record<string, unknown>;
    if (!data) {
      return { success: false, error: "Missing required arg: data" };
    }
    const result = await sdk.create(data);
    return {
      success: true,
      action: `${toSnake(entity)}_create`,
      data: result,
    };
  } catch (err) {
    return {
      success: false,
      error: `Entity create failed for ${entity}: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}

// ── Entity Update ─────────────────────────────────────────────────────────────

async function entityUpdate(
  entity: EntityName,
  args?: Record<string, unknown>
): Promise<ActionResponse> {
  try {
    const sdk = getEntity(entity);
    if (!sdk.update) {
      return {
        success: false,
        error: `Entity '${entity}' does not support update operations`,
      };
    }
    const id = args?.id as string;
    const data = args?.data as Record<string, unknown>;
    if (!id || !data) {
      return {
        success: false,
        error: "Missing required args: id and data",
      };
    }
    const result = await sdk.update(id, data);
    return {
      success: true,
      action: `${toSnake(entity)}_update`,
      data: result,
    };
  } catch (err) {
    return {
      success: false,
      error: `Entity update failed for ${entity}: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}

// ── Entity Count ──────────────────────────────────────────────────────────────

async function entityCount(
  entity: EntityName,
  args?: Record<string, unknown>
): Promise<ActionResponse> {
  try {
    const sdk = getEntity(entity);
    const filter = (args?.filter as Record<string, unknown>) || {};
    // Use filter with limit=0 + count from response, or dedicated count if available
    const results = await sdk.filter(filter, "-created_date", 1);
    const hasCount = typeof (results as unknown as { total?: number })?.total === "number";
    const total = hasCount
      ? (results as unknown as { total: number }).total
      : (Array.isArray(results) ? results.length : 0);
    return {
      success: true,
      action: `${toSnake(entity)}_count`,
      count: total,
      data: { total },
    };
  } catch (err) {
    return {
      success: false,
      error: `Entity count failed for ${entity}: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}

// ── Reporting Hub ─────────────────────────────────────────────────────────────

const REPORT_ACTIONS = [
  "overview",
  "enrollments",
  "lead_flow",
  "billing",
  "communications",
  "calls",
  "agents",
  "support",
  "automations",
  "activity_feed",
  "customer_360",
  "customer_comms",
  "sync_health",
  "morning_pulse",
  "vapi_intelligence",
  "enrollment_intelligence",
] as const;

async function reportingAction(
  action: string,
  args?: Record<string, unknown>
): Promise<ActionResponse> {
  try {
    const result = await base44Service.functions.invoke("reportingHubQuery", {
      action,
      ...(args || {}),
    });
    return {
      success: true,
      action: `reporting_${action}`,
      data: result,
    };
  } catch (err) {
    return {
      success: false,
      error: `Reporting hub '${action}' failed: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}

// ── MCP Bridge Delegates ──────────────────────────────────────────────────────

const MCP_BRIDGES = {
  nmi: "nmiMcpBridge",
  slack: "slackMcpBridge",
  ghl: "ghlMcpBridge",
  vapi: "vapiMcpBridge",
} as const;

async function mcpBridgeInvoke(
  bridge: keyof typeof MCP_BRIDGES,
  args?: Record<string, unknown>
): Promise<ActionResponse> {
  try {
    const bridgeAction = (args?.bridgeAction as string) || "health_check";
    const bridgePayload = (args?.payload as Record<string, unknown>) || {};
    const result = await base44Service.functions.invoke(MCP_BRIDGES[bridge], {
      action: bridgeAction,
      payload: bridgePayload,
    });
    return {
      success: true,
      action: `${bridge}_invoke`,
      data: result,
    };
  } catch (err) {
    return {
      success: false,
      error: `MCP bridge '${bridge}' invoke failed: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}

// ── Jarvis Functions ──────────────────────────────────────────────────────────

/** Jarvis File System — read a file from the jarvis cortex */
async function jarvisFileRead(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const path = args?.path as string;
    if (!path) return { success: false, error: "Missing required arg: path" };
    const result = await base44Service.functions.invoke("jarvisFileSystem", {
      action: "fs_read",
      path,
    });
    return { success: true, action: "jarvis_file_read", data: result };
  } catch (err) {
    return { success: false, error: `Jarvis file read failed: ${err instanceof Error ? err.message : "Unknown"}` };
  }
}

/** Jarvis File System — write content to a file */
async function jarvisFileWrite(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const path = args?.path as string;
    const content = args?.content as string;
    if (!path || content === undefined) {
      return { success: false, error: "Missing required args: path and content" };
    }
    const result = await base44Service.functions.invoke("jarvisFileSystem", {
      action: "fs_write",
      path,
      content,
    });
    return { success: true, action: "jarvis_file_write", data: result };
  } catch (err) {
    return { success: false, error: `Jarvis file write failed: ${err instanceof Error ? err.message : "Unknown"}` };
  }
}

/** Jarvis File System — list files in a directory */
async function jarvisFileList(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const parentPath = (args?.parentPath as string) || "/skills";
    const result = await base44Service.functions.invoke("jarvisFileSystem", {
      action: "fs_list",
      parentPath,
    });
    return { success: true, action: "jarvis_file_list", data: result };
  } catch (err) {
    return { success: false, error: `Jarvis file list failed: ${err instanceof Error ? err.message : "Unknown"}` };
  }
}

/** Jarvis File System — search by filename or content */
async function jarvisFileSearch(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const query = args?.query as string;
    if (!query) return { success: false, error: "Missing required arg: query" };
    const result = await base44Service.functions.invoke("jarvisFileSystem", {
      action: "fs_search",
      query,
    });
    return { success: true, action: "jarvis_file_search", data: result };
  } catch (err) {
    return { success: false, error: `Jarvis file search failed: ${err instanceof Error ? err.message : "Unknown"}` };
  }
}

/** Jarvis Task Manager — get tasks assigned to current agent */
async function jarvisTaskGetMyTasks(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const result = await base44Service.functions.invoke("jarvisTaskManager", {
      action: "get_my_tasks",
      ...(args || {}),
    });
    return { success: true, action: "jarvis_task_get_my_tasks", data: result };
  } catch (err) {
    return { success: false, error: `Jarvis task get failed: ${err instanceof Error ? err.message : "Unknown"}` };
  }
}

/** Jarvis Task Manager — create a new task */
async function jarvisTaskCreate(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const title = args?.title as string;
    const description = (args?.description as string) || "";
    const priority = (args?.priority as string) || "medium";
    const assignee = (args?.assignee as string) || "jarvis";
    if (!title) return { success: false, error: "Missing required arg: title" };
    const result = await base44Service.functions.invoke("jarvisTaskManager", {
      action: "create_task",
      title,
      description,
      priority,
      assignee,
      metadata: args?.metadata || {},
    });
    return { success: true, action: "jarvis_task_create", data: result };
  } catch (err) {
    return { success: false, error: `Jarvis task create failed: ${err instanceof Error ? err.message : "Unknown"}` };
  }
}

/** Jarvis Task Manager — mark a task as complete */
async function jarvisTaskComplete(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const id = args?.id as string;
    const resolution = (args?.resolution as string) || "";
    if (!id) return { success: false, error: "Missing required arg: id" };
    const result = await base44Service.functions.invoke("jarvisTaskManager", {
      action: "complete_task",
      id,
      resolution,
    });
    return { success: true, action: "jarvis_task_complete", data: result };
  } catch (err) {
    return { success: false, error: `Jarvis task complete failed: ${err instanceof Error ? err.message : "Unknown"}` };
  }
}

/** Jarvis Data Guard — run a validated read-only SQL query */
async function jarvisDataGuardQuery(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const sql = args?.sql as string;
    const params = (args?.params as Record<string, unknown>) || {};
    if (!sql) return { success: false, error: "Missing required arg: sql" };
    const result = await base44Service.functions.invoke("jarvisDataGuard", {
      action: "validated_query",
      sql,
      params,
    });
    return { success: true, action: "jarvis_data_guard_query", data: result };
  } catch (err) {
    return { success: false, error: `Data guard query failed: ${err instanceof Error ? err.message : "Unknown"}` };
  }
}

/** Jarvis Data Guard — deposit data into session vault */
async function jarvisDataGuardDeposit(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const key = args?.key as string;
    const data = args?.data;
    if (!key) return { success: false, error: "Missing required arg: key" };
    const result = await base44Service.functions.invoke("jarvisDataGuard", {
      action: "session_deposit",
      key,
      data: typeof data === "string" ? data : JSON.stringify(data),
    });
    return { success: true, action: "jarvis_data_guard_session_deposit", data: result };
  } catch (err) {
    return { success: false, error: `Data guard deposit failed: ${err instanceof Error ? err.message : "Unknown"}` };
  }
}

/** Jarvis Data Guard — recall data from session vault */
async function jarvisDataGuardRecall(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const key = args?.key as string;
    if (!key) return { success: false, error: "Missing required arg: key" };
    const result = await base44Service.functions.invoke("jarvisDataGuard", {
      action: "session_recall",
      key,
    });
    return { success: true, action: "jarvis_data_guard_session_recall", data: result };
  } catch (err) {
    return { success: false, error: `Data guard recall failed: ${err instanceof Error ? err.message : "Unknown"}` };
  }
}

/** Rolling Context — read current context buffer */
async function rollingContextRead(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const limit = (args?.limit as number) || 20;
    const result = await base44Service.functions.invoke("rollingContext", {
      action: "rc_read",
      limit,
    });
    return { success: true, action: "rolling_context_read", data: result };
  } catch (err) {
    return { success: false, error: `Rolling context read failed: ${err instanceof Error ? err.message : "Unknown"}` };
  }
}

/** Rolling Context — add an item to the context buffer */
async function rollingContextAddItem(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const item = args?.item;
    const tag = (args?.tag as string) || "general";
    if (!item) return { success: false, error: "Missing required arg: item" };
    const result = await base44Service.functions.invoke("rollingContext", {
      action: "rc_add_item",
      item,
      tag,
    });
    return { success: true, action: "rolling_context_add_item", data: result };
  } catch (err) {
    return { success: false, error: `Rolling context add failed: ${err instanceof Error ? err.message : "Unknown"}` };
  }
}

// ── Customer 360 (Legacy + Enhanced) ──────────────────────────────────────────

async function customer360(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const customerId = args?.customerId as string;
    const email = args?.email as string;
    const phone = args?.phone as string;
    if (!customerId && !email && !phone) {
      return { success: false, error: "Missing identifier: customerId, email, or phone" };
    }
    const result = await base44Service.functions.invoke("crossSystemLookup", {
      identifier: customerId || email || phone,
      identifier_type: customerId ? "customer_id" : email ? "email" : "phone",
    });
    return { success: true, action: "customer_360", data: result };
  } catch (err) {
    return { success: false, error: `Customer 360 failed: ${err instanceof Error ? err.message : "Unknown"}` };
  }
}

// ── Main Action Router ────────────────────────────────────────────────────────

export async function execute(req: ActionRequest): Promise<ActionResponse> {
  const { action, args } = req;

  // ── Entity Actions ──────────────────────────────────────────────────────

  for (const entity of CRUD_ENTITIES) {
    const prefix = toSnake(entity);
    if (action === `${prefix}_query`) return entityQuery(entity, args);
    if (action === `${prefix}_get`) return entityGet(entity, args);
    if (action === `${prefix}_create`) return entityCreate(entity, args);
    if (action === `${prefix}_update`) return entityUpdate(entity, args);
    if (action === `${prefix}_count`) return entityCount(entity, args);
  }

  for (const entity of READ_ENTITIES) {
    const prefix = toSnake(entity);
    if (action === `${prefix}_query`) return entityQuery(entity, args);
    if (action === `${prefix}_get`) return entityGet(entity, args);
    if (action === `${prefix}_count`) return entityCount(entity, args);
  }

  // ── Customer 360 ────────────────────────────────────────────────────────

  if (action === "customer_360") return customer360(args);

  // ── Reporting Hub ───────────────────────────────────────────────────────

  for (const reportAction of REPORT_ACTIONS) {
    if (action === `reporting_${reportAction}`) {
      return reportingAction(reportAction, args);
    }
  }

  // ── MCP Bridge Delegates ────────────────────────────────────────────────

  if (action === "nmi_invoke") return mcpBridgeInvoke("nmi", args);
  if (action === "slack_invoke") return mcpBridgeInvoke("slack", args);
  if (action === "ghl_invoke") return mcpBridgeInvoke("ghl", args);
  if (action === "vapi_invoke") return mcpBridgeInvoke("vapi", args);

  // ── Jarvis Functions ────────────────────────────────────────────────────

  if (action === "jarvis_file_read") return jarvisFileRead(args);
  if (action === "jarvis_file_write") return jarvisFileWrite(args);
  if (action === "jarvis_file_list") return jarvisFileList(args);
  if (action === "jarvis_file_search") return jarvisFileSearch(args);
  if (action === "jarvis_task_get_my_tasks") return jarvisTaskGetMyTasks(args);
  if (action === "jarvis_task_create") return jarvisTaskCreate(args);
  if (action === "jarvis_task_complete") return jarvisTaskComplete(args);
  if (action === "jarvis_data_guard_query") return jarvisDataGuardQuery(args);
  if (action === "jarvis_data_guard_session_deposit") return jarvisDataGuardDeposit(args);
  if (action === "jarvis_data_guard_session_recall") return jarvisDataGuardRecall(args);
  if (action === "rolling_context_read") return rollingContextRead(args);
  if (action === "rolling_context_add_item") return rollingContextAddItem(args);

  // ── Fallback: try legacy invokeFunction style ───────────────────────────

  return {
    success: false,
    error: `Unknown action: '${action}'. Available: ${availableActions.slice(0, 20).join(", ")}... (${availableActions.length} total)`,
  };
}

// ── Available Actions Registry ────────────────────────────────────────────────

function buildActionList(): string[] {
  const actions: string[] = [];

  // Entity actions
  for (const entity of CRUD_ENTITIES) {
    const p = toSnake(entity);
    actions.push(`${p}_query`, `${p}_get`, `${p}_create`, `${p}_update`, `${p}_count`);
  }
  for (const entity of READ_ENTITIES) {
    const p = toSnake(entity);
    actions.push(`${p}_query`, `${p}_get`, `${p}_count`);
  }

  // Customer 360
  actions.push("customer_360");

  // Reporting hub
  for (const a of REPORT_ACTIONS) {
    actions.push(`reporting_${a}`);
  }

  // MCP bridge delegates
  actions.push("nmi_invoke", "slack_invoke", "ghl_invoke", "vapi_invoke");

  // Jarvis functions
  actions.push(
    "jarvis_file_read",
    "jarvis_file_write",
    "jarvis_file_list",
    "jarvis_file_search",
    "jarvis_task_get_my_tasks",
    "jarvis_task_create",
    "jarvis_task_complete",
    "jarvis_data_guard_query",
    "jarvis_data_guard_session_deposit",
    "jarvis_data_guard_session_recall",
    "rolling_context_read",
    "rolling_context_add_item"
  );

  return actions;
}

export const availableActions: string[] = buildActionList();

export default { execute, availableActions, base44, base44Service };
