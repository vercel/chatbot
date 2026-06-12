/**
 * NMI Comprehensive Client — U2.3.C (41 actions)
 *
 * Wraps all NMI payment gateway operations behind a typed action router.
 * Proxies through VPS tools bridge (NMI security key stays on VPS).
 *
 * Actions:
 *   READ:          health_check, query_transactions, get_transaction,
 *                  query_vault, query_subscription, query_subscriptions_bulk
 *   VAULT:         create_vault_from_token, update_vault, delete_card_from_vault,
 *                  set_primary_card
 *   SUBSCRIPTIONS: create_subscription, update_subscription, delete_subscription,
 *                  pause_subscription, reactivate_subscription
 *   CHARGES:       one_time_charge, cit_vault_sale, day_zero_auth, recover_charge
 *   REFUNDS:       refund_transaction
 *   COF:           cof_health_scan, cof_get_results, cof_deep_inspect, cof_recover,
 *                  cof_relink_sub, cof_fix_mit_flags, cof_link_day_zero, cof_provision_token
 *   GOLDEN VAULT:  gv_validate_card, gv_create_vault, gv_mit_charge, gv_cit_charge,
 *                  gv_inspect, gv_full_test
 *   INVOICING:     create_invoice, send_invoice, close_invoice
 *   PRODUCTS:      create_product, update_product, delete_product
 *   TXT2PAY:       send_txt2pay
 *
 * Usage:
 *   import { execute } from "@/connectors/nmi/client";
 *   const result = await execute({ action: "health_check", args: {} });
 */

import { secrets } from "@/secrets";

// ── Bridge Config ─────────────────────────────────────────────────────────────

const BRIDGE_URL = secrets.vps.toolsBridgeUrl;
const BASE44_KEY = secrets.base44.apiKey;

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

// ── Bridge Helper ─────────────────────────────────────────────────────────────

async function bridgeCall(
  nmiAction: string,
  actionName: string,
  payload: Record<string, unknown> = {}
): Promise<ActionResponse> {
  if (!BRIDGE_URL) {
    return { success: false, error: "VPS_TOOLS_BRIDGE_URL not configured" };
  }
  try {
    const res = await fetch(`${BRIDGE_URL}/tool/nmi/${nmiAction}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${BASE44_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      return {
        success: false,
        error: `NMI bridge returned ${res.status}: ${res.statusText}`,
        action: actionName,
      };
    }
    const data = await res.json();
    return { success: true, action: actionName, data };
  } catch (err) {
    return {
      success: false,
      error: `NMI bridge unavailable: ${err instanceof Error ? err.message : "Unknown"}`,
      action: actionName,
    };
  }
}

// ── READ Actions ──────────────────────────────────────────────────────────────

async function healthCheck(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("healthCheck", "health_check", args || {});
}

async function queryTransactions(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("queryTransactions", "query_transactions", args || {});
}

async function getTransaction(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("getTransaction", "get_transaction", args || {});
}

async function queryVault(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("getVault", "query_vault", args || {});
}

async function querySubscription(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("getSubscription", "query_subscription", args || {});
}

async function querySubscriptionsBulk(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("querySubscriptionsBulk", "query_subscriptions_bulk", args || {});
}

// ── VAULT Actions ─────────────────────────────────────────────────────────────

async function createVaultFromToken(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("createVaultFromToken", "create_vault_from_token", args || {});
}

async function updateVault(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("updateVault", "update_vault", args || {});
}

async function deleteCardFromVault(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("deleteCardFromVault", "delete_card_from_vault", args || {});
}

async function setPrimaryCard(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("setPrimaryCard", "set_primary_card", args || {});
}

// ── SUBSCRIPTION Actions ──────────────────────────────────────────────────────

async function createSubscription(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("createSubscription", "create_subscription", args || {});
}

async function updateSubscription(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("updateSubscription", "update_subscription", args || {});
}

async function deleteSubscription(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("deleteSubscription", "delete_subscription", args || {});
}

async function pauseSubscription(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("pauseSubscription", "pause_subscription", args || {});
}

async function reactivateSubscription(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("reactivateSubscription", "reactivate_subscription", args || {});
}

// ── CHARGE Actions ────────────────────────────────────────────────────────────

async function oneTimeCharge(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("oneTimeCharge", "one_time_charge", args || {});
}

async function citVaultSale(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("citVaultSale", "cit_vault_sale", args || {});
}

async function dayZeroAuth(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("dayZeroAuth", "day_zero_auth", args || {});
}

async function recoverCharge(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("recoverCharge", "recover_charge", args || {});
}

// ── REFUND Actions ────────────────────────────────────────────────────────────

async function refundTransaction(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("refundTransaction", "refund_transaction", args || {});
}

// ── CoF (Card on File) Actions ────────────────────────────────────────────────

async function cofHealthScan(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("cofHealthScan", "cof_health_scan", args || {});
}

async function cofGetResults(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("cofGetResults", "cof_get_results", args || {});
}

async function cofDeepInspect(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("cofDeepInspect", "cof_deep_inspect", args || {});
}

async function cofRecover(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("cofRecover", "cof_recover", args || {});
}

async function cofRelinkSub(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("cofRelinkSub", "cof_relink_sub", args || {});
}

async function cofFixMitFlags(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("cofFixMitFlags", "cof_fix_mit_flags", args || {});
}

async function cofLinkDayZero(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("cofLinkDayZero", "cof_link_day_zero", args || {});
}

async function cofProvisionToken(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("cofProvisionToken", "cof_provision_token", args || {});
}

// ── GOLDEN VAULT Actions ──────────────────────────────────────────────────────

async function gvValidateCard(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("gvValidateCard", "gv_validate_card", args || {});
}

async function gvCreateVault(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("gvCreateVault", "gv_create_vault", args || {});
}

async function gvMitCharge(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("gvMitCharge", "gv_mit_charge", args || {});
}

async function gvCitCharge(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("gvCitCharge", "gv_cit_charge", args || {});
}

async function gvInspect(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("gvInspect", "gv_inspect", args || {});
}

async function gvFullTest(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("gvFullTest", "gv_full_test", args || {});
}

// ── INVOICING Actions ─────────────────────────────────────────────────────────

async function createInvoice(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("createInvoice", "create_invoice", args || {});
}

async function sendInvoice(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("sendInvoice", "send_invoice", args || {});
}

async function closeInvoice(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("closeInvoice", "close_invoice", args || {});
}

// ── PRODUCT Actions ───────────────────────────────────────────────────────────

async function createProduct(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("createProduct", "create_product", args || {});
}

async function updateProduct(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("updateProduct", "update_product", args || {});
}

async function deleteProduct(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("deleteProduct", "delete_product", args || {});
}

// ── TXT2PAY Action ────────────────────────────────────────────────────────────

async function sendTxt2pay(args?: Record<string, unknown>): Promise<ActionResponse> {
  return bridgeCall("sendTxt2pay", "send_txt2pay", args || {});
}

// ── Main Action Router ────────────────────────────────────────────────────────

export async function execute(req: ActionRequest): Promise<ActionResponse> {
  const { action, args } = req;

  switch (action) {
    // READ
    case "health_check": return healthCheck(args);
    case "query_transactions": return queryTransactions(args);
    case "get_transaction": return getTransaction(args);
    case "query_vault": return queryVault(args);
    case "query_subscription": return querySubscription(args);
    case "query_subscriptions_bulk": return querySubscriptionsBulk(args);
    // VAULT
    case "create_vault_from_token": return createVaultFromToken(args);
    case "update_vault": return updateVault(args);
    case "delete_card_from_vault": return deleteCardFromVault(args);
    case "set_primary_card": return setPrimaryCard(args);
    // SUBSCRIPTIONS
    case "create_subscription": return createSubscription(args);
    case "update_subscription": return updateSubscription(args);
    case "delete_subscription": return deleteSubscription(args);
    case "pause_subscription": return pauseSubscription(args);
    case "reactivate_subscription": return reactivateSubscription(args);
    // CHARGES
    case "one_time_charge": return oneTimeCharge(args);
    case "cit_vault_sale": return citVaultSale(args);
    case "day_zero_auth": return dayZeroAuth(args);
    case "recover_charge": return recoverCharge(args);
    // REFUNDS
    case "refund_transaction": return refundTransaction(args);
    // CoF
    case "cof_health_scan": return cofHealthScan(args);
    case "cof_get_results": return cofGetResults(args);
    case "cof_deep_inspect": return cofDeepInspect(args);
    case "cof_recover": return cofRecover(args);
    case "cof_relink_sub": return cofRelinkSub(args);
    case "cof_fix_mit_flags": return cofFixMitFlags(args);
    case "cof_link_day_zero": return cofLinkDayZero(args);
    case "cof_provision_token": return cofProvisionToken(args);
    // GOLDEN VAULT
    case "gv_validate_card": return gvValidateCard(args);
    case "gv_create_vault": return gvCreateVault(args);
    case "gv_mit_charge": return gvMitCharge(args);
    case "gv_cit_charge": return gvCitCharge(args);
    case "gv_inspect": return gvInspect(args);
    case "gv_full_test": return gvFullTest(args);
    // INVOICING
    case "create_invoice": return createInvoice(args);
    case "send_invoice": return sendInvoice(args);
    case "close_invoice": return closeInvoice(args);
    // PRODUCTS
    case "create_product": return createProduct(args);
    case "update_product": return updateProduct(args);
    case "delete_product": return deleteProduct(args);
    // TXT2PAY
    case "send_txt2pay": return sendTxt2pay(args);

    default:
      return {
        success: false,
        error: `Unknown action: '${action}'. Available: ${availableActions.slice(0, 15).join(", ")}... (${availableActions.length} total)`,
      };
  }
}

// ── Available Actions Registry ────────────────────────────────────────────────

export const availableActions: string[] = [
  // READ
  "health_check", "query_transactions", "get_transaction",
  "query_vault", "query_subscription", "query_subscriptions_bulk",
  // VAULT
  "create_vault_from_token", "update_vault", "delete_card_from_vault", "set_primary_card",
  // SUBSCRIPTIONS
  "create_subscription", "update_subscription", "delete_subscription",
  "pause_subscription", "reactivate_subscription",
  // CHARGES
  "one_time_charge", "cit_vault_sale", "day_zero_auth", "recover_charge",
  // REFUNDS
  "refund_transaction",
  // CoF
  "cof_health_scan", "cof_get_results", "cof_deep_inspect", "cof_recover",
  "cof_relink_sub", "cof_fix_mit_flags", "cof_link_day_zero", "cof_provision_token",
  // GOLDEN VAULT
  "gv_validate_card", "gv_create_vault", "gv_mit_charge", "gv_cit_charge",
  "gv_inspect", "gv_full_test",
  // INVOICING
  "create_invoice", "send_invoice", "close_invoice",
  // PRODUCTS
  "create_product", "update_product", "delete_product",
  // TXT2PAY
  "send_txt2pay",
];

export default { execute, availableActions };
