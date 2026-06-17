/**
 * lib/discovery/multi-source-puller.ts
 * Phase 38 Stream 1 — Base44 + NMI + Warehouse Multi-Source Puller
 *
 * Pulls customer data from multiple sources:
 * 1. Base44 CRM entities (CustomerProfile, PaymentLog, SupportTicket, CallLog, etc.)
 * 2. NMI billing gateway (subscription state, recent transactions)
 * 3. Local warehouse (newleaf_360.db — Slack messages, historical data)
 *
 * Uses caching layer to avoid redundant API calls within a single run.
 * Designed to run on VPS with direct MCP tool access.
 */

import type {
  PullRequest,
  PulledCustomerData,
  Base44Snapshot,
  NmiSnapshot,
  CommsSnapshot,
  TicketSnapshot,
  ExtractedCustomerMention,
} from "./types";
import { getCachedPull, setCachedPull, getCachedNmi, setCachedNmi, getCachedBase44, setCachedBase44 } from "./caching";

// ── Types for MCP Bridge Calls ───────────────────────────────────

// These interfaces represent what we expect from MCP tool responses.
// The actual calls happen via the Base44 bridge which is available on VPS.

interface CustomerProfileRecord {
  id: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  enrollmentStatus?: string;
  billingStatus?: string;
  paymentAmount?: number;
  [key: string]: unknown;
}

interface PaymentLogRecord {
  id: string;
  customerId: string;
  amount?: number;
  status?: string;
  method?: string;
  createdAt?: string;
  [key: string]: unknown;
}

interface SupportTicketRecord {
  id: string;
  customerId: string;
  title?: string;
  status?: string;
  priority?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

interface CallLogRecord {
  id: string;
  customerId: string;
  direction?: string;
  duration?: number;
  disposition?: string;
  createdAt?: string;
  [key: string]: unknown;
}

interface NmiTransactionRecord {
  transactionId?: string;
  amount?: number;
  status?: string;
  type?: string;
  createdAt?: string;
  [key: string]: unknown;
}

interface NmiSubscriptionState {
  subscription_id?: string;
  status?: string;
  next_charge_date?: string;
  [key: string]: unknown;
}

// ── Puller Configuration ─────────────────────────────────────────

const NMI_RATE_LIMIT_MS = 6000; // max 10 NMI calls per minute = 6s between calls
const BATCH_SIZE = 25;
const NMI_TRANSACTION_DAYS_DEFAULT = 30;

let lastNmiCallTime = 0;

async function rateLimitNmi(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastNmiCallTime;
  if (elapsed < NMI_RATE_LIMIT_MS) {
    await new Promise((r) => setTimeout(r, NMI_RATE_LIMIT_MS - elapsed));
  }
  lastNmiCallTime = Date.now();
}

// ── Base44 Puller ────────────────────────────────────────────────

/**
 * Pull Base44 data for a list of customer IDs.
 * On VPS: uses mcp__base44_tools__b44_get for individual records
 * and b44_query for batch queries.
 */
export async function pullBase44Customers(
  customerIds: string[]
): Promise<Map<string, Base44Snapshot>> {
  const result = new Map<string, Base44Snapshot>();

  for (let i = 0; i < customerIds.length; i += BATCH_SIZE) {
    const batch = customerIds.slice(i, i + BATCH_SIZE);

    for (const customerId of batch) {
      // Check cache first
      const cached = getCachedBase44(customerId);
      if (cached) {
        result.set(customerId, cached);
        continue;
      }

      const snapshot: Base44Snapshot = {
        profile: null,
        enrollmentStatus: 'unknown',
        billingStatus: 'unknown',
        paymentAmount: 0,
        lastPayment: null,
        openTickets: [],
        recentCalls: [],
        adminNotifications: [],
      };

      try {
        // Pull CustomerProfile via cross_system_lookup (returns full dossier)
        // In VPS context, this is an MCP call
        const profile = await fetchCustomerProfile(customerId);
        if (profile) {
          snapshot.profile = profile as unknown as Record<string, unknown>;
          snapshot.enrollmentStatus =
            (profile.enrollmentStatus as string) || 'unknown';
          snapshot.billingStatus =
            (profile.billingStatus as string) || 'unknown';
          snapshot.paymentAmount =
            (profile.paymentAmount as number) || 0;
        }

        // Pull payment logs
        const payments = await fetchPaymentLogs(customerId);
        if (payments.length > 0) {
          snapshot.lastPayment = payments[0] as unknown as Record<string, unknown>;
        }

        // Pull support tickets
        snapshot.openTickets = (await fetchSupportTickets(
          customerId,
          'open'
        )) as unknown as Record<string, unknown>[];

        // Pull recent calls
        snapshot.recentCalls = (await fetchCallLogs(
          customerId
        )) as unknown as Record<string, unknown>[];

      } catch (err) {
        console.warn(
          `[multi-source-puller] Base44 pull failed for ${customerId}: ${err}`
        );
        snapshot.billingStatus = 'error';
      }

      setCachedBase44(customerId, snapshot);
      result.set(customerId, snapshot);
    }

    // Small delay between batches to avoid overwhelming Base44
    if (i + BATCH_SIZE < customerIds.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return result;
}

// ── NMI Puller ───────────────────────────────────────────────────

export async function pullNmiCustomers(
  customerIds: string[],
  transactionDays: number = NMI_TRANSACTION_DAYS_DEFAULT
): Promise<Map<string, NmiSnapshot>> {
  const result = new Map<string, NmiSnapshot>();

  for (const customerId of customerIds) {
    // Check cache first
    const cached = getCachedNmi(customerId);
    if (cached) {
      result.set(customerId, cached);
      continue;
    }

    const snapshot: NmiSnapshot = {
      subscriptionId: null,
      subscriptionStatus: 'none',
      lastTransaction: null,
      recentTransactions: [],
      nextChargeDate: null,
      cofCompliant: false,
    };

    try {
      await rateLimitNmi();

      // Query NMI customer vault
      const vaultData = await queryNmiVault(customerId);

      if (vaultData) {
        snapshot.subscriptionId =
          (vaultData.subscription_id as string) || null;
        const status = (vaultData.status as string) || 'none';
        snapshot.subscriptionStatus = mapNmiStatus(status);
        snapshot.cofCompliant = true; // Golden Vault architecture
        snapshot.nextChargeDate =
          (vaultData.next_charge_date as string) || null;

        // Query recent transactions
        const transactions = await queryNmiTransactions(
          customerId,
          transactionDays
        );
        if (transactions.length > 0) {
          snapshot.lastTransaction = transactions[0] as unknown as Record<string, unknown>;
          snapshot.recentTransactions = transactions as unknown as Record<string, unknown>[];
        }
      }
    } catch (err) {
      console.warn(
        `[multi-source-puller] NMI pull failed for ${customerId}: ${err}`
      );
      snapshot.subscriptionStatus = 'error';
      snapshot.error = err instanceof Error ? err.message : 'Unknown NMI error';
    }

    setCachedNmi(customerId, snapshot);
    result.set(customerId, snapshot);
  }

  return result;
}

function mapNmiStatus(
  status: string
): NmiSnapshot['subscriptionStatus'] {
  switch (status?.toLowerCase()) {
    case 'active':
      return 'active';
    case 'cancelled':
    case 'canceled':
      return 'cancelled';
    case 'declining':
    case 'declined':
      return 'declining';
    case 'none':
    case '':
      return 'none';
    default:
      return 'error';
  }
}

// ── Comms Puller ─────────────────────────────────────────────────

export async function pullCustomerComms(
  customerIds: string[]
): Promise<Map<string, CommsSnapshot>> {
  const result = new Map<string, CommsSnapshot>();

  for (const customerId of customerIds) {
    const snapshot: CommsSnapshot = {
      recentCalls: [],
      recentEmails: [],
      recentSms: [],
      slackMentions: [],
    };

    try {
      // Pull from warehouse for historical comms
      snapshot.recentCalls = (await fetchCallLogs(
        customerId,
        5
      )) as unknown as Record<string, unknown>[];
      snapshot.recentEmails = (await fetchEmails(
        customerId,
        5
      )) as unknown as Record<string, unknown>[];
      snapshot.recentSms = (await fetchSmsMessages(
        customerId,
        5
      )) as unknown as Record<string, unknown>[];
    } catch (err) {
      console.warn(
        `[multi-source-puller] Comms pull failed for ${customerId}: ${err}`
      );
    }

    result.set(customerId, snapshot);
  }

  return result;
}

// ── Ticket Puller ────────────────────────────────────────────────

export async function pullCustomerTickets(
  customerIds: string[]
): Promise<Map<string, TicketSnapshot>> {
  const result = new Map<string, TicketSnapshot>();

  for (const customerId of customerIds) {
    const snapshot: TicketSnapshot = {
      open: [],
      resolved: [],
      stale: [],
    };

    try {
      const tickets = (await fetchSupportTickets(
        customerId
      )) as unknown as SupportTicketRecord[];

      for (const ticket of tickets) {
        const status = (ticket.status || '').toLowerCase();
        const updatedAt = ticket.updatedAt
          ? new Date(ticket.updatedAt).getTime()
          : Date.now();
        const isStale =
          Date.now() - updatedAt > 48 * 60 * 60 * 1000; // 48h

        if (status === 'open' || status === 'pending' || status === 'in_progress') {
          if (isStale) {
            snapshot.stale.push(ticket as unknown as Record<string, unknown>);
          } else {
            snapshot.open.push(ticket as unknown as Record<string, unknown>);
          }
        } else if (
          status === 'resolved' ||
          status === 'closed' ||
          status === 'completed'
        ) {
          snapshot.resolved.push(ticket as unknown as Record<string, unknown>);
        } else {
          snapshot.open.push(ticket as unknown as Record<string, unknown>);
        }
      }
    } catch (err) {
      console.warn(
        `[multi-source-puller] Ticket pull failed for ${customerId}: ${err}`
      );
    }

    result.set(customerId, snapshot);
  }

  return result;
}

// ── Composite Puller ─────────────────────────────────────────────

export async function pullCustomerData(
  request: PullRequest
): Promise<Map<string, PulledCustomerData>> {
  const result = new Map<string, PulledCustomerData>();
  const { customerIds, includeNmi, includeBase44, includeComms, includeTickets, nmiTransactionDays } = request;

  if (customerIds.length === 0) return result;

  // Pull all sources in parallel
  const [base44Data, nmiData, commsData, ticketData] = await Promise.all([
    includeBase44
      ? pullBase44Customers(customerIds)
      : Promise.resolve(new Map<string, Base44Snapshot>()),
    includeNmi
      ? pullNmiCustomers(customerIds, nmiTransactionDays)
      : Promise.resolve(new Map<string, NmiSnapshot>()),
    includeComms
      ? pullCustomerComms(customerIds)
      : Promise.resolve(new Map<string, CommsSnapshot>()),
    includeTickets
      ? pullCustomerTickets(customerIds)
      : Promise.resolve(new Map<string, TicketSnapshot>()),
  ]);

  // Assemble composite data
  for (const customerId of customerIds) {
    const cached = getCachedPull(customerId);
    if (cached) {
      result.set(customerId, cached);
      continue;
    }

    const pulled: PulledCustomerData = {
      customerId,
      base44: base44Data.get(customerId) || null,
      nmi: nmiData.get(customerId) || null,
      comms: commsData.get(customerId) || {
        recentCalls: [],
        recentEmails: [],
        recentSms: [],
        slackMentions: [],
      },
      tickets: ticketData.get(customerId) || {
        open: [],
        resolved: [],
        stale: [],
      },
      pulledAt: new Date().toISOString(),
    };

    setCachedPull(customerId, pulled);
    result.set(customerId, pulled);
  }

  return result;
}

// ── MCP Bridge Call Stubs ────────────────────────────────────────
// These are the actual calls to MCP tools. They will be invoked
// from VPS context where MCP tools are available.
// The stubs below document the expected interface.
// In production, these are replaced with actual MCP calls.

async function fetchCustomerProfile(
  customerId: string
): Promise<CustomerProfileRecord | null> {
  try {
    // mcp__base44_tools__b44_get({ entity: 'CustomerProfile', id: customerId })
    // For now, return null (will be wired in Stream 8 with real MCP calls)
    return null;
  } catch {
    return null;
  }
}

async function fetchPaymentLogs(
  customerId: string,
  limit: number = 5
): Promise<PaymentLogRecord[]> {
  try {
    // mcp__base44_tools__b44_query({ entity: 'PaymentLog', filter: { customerId }, sort: '-createdAt', limit })
    return [];
  } catch {
    return [];
  }
}

async function fetchSupportTickets(
  customerId: string,
  status?: string
): Promise<SupportTicketRecord[]> {
  try {
    // mcp__base44_tools__b44_query({ entity: 'SupportTicket', filter: { customerId, ...(status ? {status} : {}) }, sort: '-createdAt', limit: 20 })
    return [];
  } catch {
    return [];
  }
}

async function fetchCallLogs(
  customerId: string,
  limit: number = 10
): Promise<CallLogRecord[]> {
  try {
    // mcp__base44_tools__query_warehouse({ table: 'agent_calls', where: `customer_id = '${customerId}'`, limit })
    return [];
  } catch {
    return [];
  }
}

async function fetchEmails(
  customerId: string,
  limit: number = 5
): Promise<Record<string, unknown>[]> {
  try {
    // mcp__base44_tools__query_warehouse({ table: 'emails', where: `customer_id = '${customerId}'`, limit })
    return [];
  } catch {
    return [];
  }
}

async function fetchSmsMessages(
  customerId: string,
  limit: number = 5
): Promise<Record<string, unknown>[]> {
  try {
    // mcp__base44_tools__query_warehouse({ table: 'sms_messages', where: `customer_id = '${customerId}'`, limit })
    return [];
  } catch {
    return [];
  }
}

async function queryNmiVault(
  customerId: string
): Promise<NmiSubscriptionState | null> {
  try {
    // mcp__base44_tools__nmi_mcp_bridge({ action: 'customer_vault_query', payload: { customerId } })
    return null;
  } catch {
    return null;
  }
}

async function queryNmiTransactions(
  customerId: string,
  days: number
): Promise<NmiTransactionRecord[]> {
  try {
    // mcp__base44_tools__nmi_mcp_bridge({ action: 'transaction_query', payload: { customerId, days } })
    return [];
  } catch {
    return [];
  }
}

// ── Export the MCP stubs for external wiring ─────────────────────

export const mcpStubs = {
  fetchCustomerProfile,
  fetchPaymentLogs,
  fetchSupportTickets,
  fetchCallLogs,
  fetchEmails,
  fetchSmsMessages,
  queryNmiVault,
  queryNmiTransactions,
};
