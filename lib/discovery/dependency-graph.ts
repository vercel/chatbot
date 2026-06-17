/**
 * lib/discovery/dependency-graph.ts
 * Phase 38 Stream 2 — Dependency Graph Builder ("Inception Knowledge")
 *
 * Builds a directed graph from customer discovery contexts:
 * - Nodes: Customer, Agent, Ticket, Payment, Subscription, Action, Call
 * - Edges: ACTIVE_SUBSCRIPTION, HAS_OPEN_TICKET, REQUESTED_BY,
 *          REQUIRES_ACTION, LAST_CALL, SHOULD_BE_CHARGED,
 *          PROMISED_TO, ESCALATED_TO, MENTIONED_IN
 *
 * Detects: cycles (churn risk, stale action, billing loop, escalation loop),
 * chains (action chains from start to resolution or stall).
 */

import type {
  CustomerDiscoveryContext,
  DependencyGraph,
  GraphNode,
  GraphEdge,
  GraphCycle,
  ActionChain,
  ScrapedSlackMessage,
} from "./types";

// ── Node ID Helpers ──────────────────────────────────────────────

function customerNodeId(customerId: string): string {
  return `customer:${customerId}`;
}
function agentNodeId(agentName: string): string {
  return `agent:${agentName.replace(/\s+/g, '_').toLowerCase()}`;
}
function ticketNodeId(ticketId: string): string {
  return `ticket:${ticketId}`;
}
function subscriptionNodeId(subId: string): string {
  return `subscription:${subId}`;
}
function actionNodeId(action: string): string {
  return `action:${action.replace(/\s+/g, '_').toLowerCase()}`;
}

// ── Build Graph from Customer Contexts ───────────────────────────

export function buildDependencyGraph(
  contexts: CustomerDiscoveryContext[],
  slackMessages: ScrapedSlackMessage[] = []
): DependencyGraph {
  const nodeMap = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const cycles: GraphCycle[] = [];
  const chains: ActionChain[] = [];

  for (const ctx of contexts) {
    // ── Customer Node ──
    const custId = customerNodeId(ctx.customerId);
    if (!nodeMap.has(custId)) {
      nodeMap.set(custId, {
        id: custId,
        type: 'customer',
        label: ctx.name || ctx.customerId,
        data: { customerId: ctx.customerId, name: ctx.name, phone: ctx.phone, email: ctx.email },
      });
    }

    // ── Subscription Node + Edge ──
    if (ctx.nmi.subscriptionId) {
      const subId = subscriptionNodeId(ctx.nmi.subscriptionId);
      if (!nodeMap.has(subId)) {
        nodeMap.set(subId, {
          id: subId,
          type: 'subscription',
          label: `Sub ${ctx.nmi.subscriptionId}`,
          data: {
            subscriptionId: ctx.nmi.subscriptionId,
            status: ctx.nmi.subscriptionStatus,
            nextCharge: ctx.nmi.nextChargeDate,
          },
        });
      }
      edges.push({
        from: custId,
        to: subId,
        type: 'ACTIVE_SUBSCRIPTION',
        metadata: { status: ctx.nmi.subscriptionStatus },
      });

      // SHOULD_BE_CHARGED edge (future-dated next charge)
      if (ctx.nmi.nextChargeDate && ctx.nmi.subscriptionStatus === 'active') {
        const nextCharge = new Date(ctx.nmi.nextChargeDate);
        if (nextCharge > new Date()) {
          const chargeActionId = actionNodeId(`charge_${ctx.customerId}`);
          if (!nodeMap.has(chargeActionId)) {
            nodeMap.set(chargeActionId, {
              id: chargeActionId,
              type: 'action',
              label: `Charge ${ctx.name} on ${ctx.nmi.nextChargeDate}`,
              data: { type: 'charge', date: ctx.nmi.nextChargeDate },
            });
          }
          edges.push({
            from: subId,
            to: chargeActionId,
            type: 'SHOULD_BE_CHARGED',
            timestamp: ctx.nmi.nextChargeDate,
          });
        }
      }
    }

    // ── Ticket Nodes + Edges ──
    for (const ticket of ctx.base44.openTickets) {
      const ticketData = ticket as Record<string, unknown>;
      const ticketId = ticketData.id as string;
      const tNodeId = ticketNodeId(ticketId);

      if (!nodeMap.has(tNodeId)) {
        nodeMap.set(tNodeId, {
          id: tNodeId,
          type: 'ticket',
          label: `Ticket ${ticketData.title || ticketId}`,
          data: { ticketId, status: ticketData.status, priority: ticketData.priority, createdAt: ticketData.createdAt },
        });
      }
      edges.push({
        from: custId,
        to: tNodeId,
        type: 'HAS_OPEN_TICKET',
        timestamp: ticketData.createdAt as string,
      });

      // Check if ticket is stale (>48h)
      const updatedAt = ticketData.updatedAt
        ? new Date(ticketData.updatedAt as string).getTime()
        : new Date(ticketData.createdAt as string).getTime();
      if (Date.now() - updatedAt > 48 * 60 * 60 * 1000) {
        const actionId = actionNodeId(`stale_${ticketId}`);
        if (!nodeMap.has(actionId)) {
          nodeMap.set(actionId, {
            id: actionId,
            type: 'action',
            label: `Stale: ${ticketData.title || ticketId}`,
            data: { type: 'stale_ticket', ticketId, hoursSinceUpdate: Math.floor((Date.now() - updatedAt) / 3600000) },
          });
        }
        edges.push({
          from: tNodeId,
          to: actionId,
          type: 'REQUIRES_ACTION',
          metadata: { reason: 'stale', hoursSinceUpdate: Math.floor((Date.now() - updatedAt) / 3600000) },
        });
      }
    }

    // ── Payment Node + Edge ──
    if (ctx.base44.lastPayment) {
      const payment = ctx.base44.lastPayment as Record<string, unknown>;
      const paymentId = (payment.id as string) || `pay_${ctx.customerId}`;
      const pNodeId = `payment:${paymentId}`;
      if (!nodeMap.has(pNodeId)) {
        nodeMap.set(pNodeId, {
          id: pNodeId,
          type: 'payment',
          label: `$${payment.amount || '?'} ${payment.status || ''}`,
          data: { paymentId, amount: payment.amount, status: payment.status, createdAt: payment.createdAt },
        });
      }
      edges.push({
        from: custId,
        to: pNodeId,
        type: 'SHOULD_BE_CHARGED',
        timestamp: payment.createdAt as string,
      });

      // If payment declined, this is a recovery signal
      if (payment.status === 'declined' || payment.status === 'failed') {
        const recoveryActionId = actionNodeId(`recover_${ctx.customerId}`);
        if (!nodeMap.has(recoveryActionId)) {
          nodeMap.set(recoveryActionId, {
            id: recoveryActionId,
            type: 'action',
            label: `Recover: ${ctx.name} $${payment.amount}`,
            data: { type: 'recovery', amount: payment.amount, declinedAt: payment.createdAt },
          });
        }
        edges.push({
          from: pNodeId,
          to: recoveryActionId,
          type: 'REQUIRES_ACTION',
          metadata: { reason: 'payment_declined', amount: payment.amount },
        });
      }
    }

    // ── Agent Nodes + Edges ──
    for (const agentName of ctx.slack.agentsWhoMentioned) {
      const aNodeId = agentNodeId(agentName);
      if (!nodeMap.has(aNodeId)) {
        nodeMap.set(aNodeId, {
          id: aNodeId,
          type: 'agent',
          label: agentName,
          data: { agentName },
        });
      }
      edges.push({
        from: aNodeId,
        to: custId,
        type: 'MENTIONED_IN',
        metadata: { context: 'slack' },
      });

      // Check for promises
      const promised = detectAgentPromise(ctx, agentName);
      if (promised) {
        const promiseActionId = actionNodeId(`promise_${ctx.customerId}_${agentName.replace(/\s+/g, '_')}`);
        if (!nodeMap.has(promiseActionId)) {
          nodeMap.set(promiseActionId, {
            id: promiseActionId,
            type: 'action',
            label: `Promise: ${promised}`,
            data: { type: 'agent_promise', agent: agentName, promise: promised },
          });
        }
        edges.push({
          from: aNodeId,
          to: promiseActionId,
          type: 'PROMISED_TO',
          metadata: { promise: promised },
        });
        edges.push({
          from: promiseActionId,
          to: custId,
          type: 'REQUIRES_ACTION',
          metadata: { promise: promised },
        });
      }
    }

    // ── Call Nodes ──
    for (const call of ctx.base44.recentCalls) {
      const callData = call as Record<string, unknown>;
      const callId = (callData.id as string) || `call_${ctx.customerId}`;
      const cNodeId = `call:${callId}`;
      if (!nodeMap.has(cNodeId)) {
        nodeMap.set(cNodeId, {
          id: cNodeId,
          type: 'call',
          label: `${callData.direction || 'call'} (${callData.duration || '?'}s)`,
          data: callData,
        });
      }
      edges.push({
        from: custId,
        to: cNodeId,
        type: 'LAST_CALL',
        timestamp: callData.createdAt as string,
      });
    }
  }

  // ── Detect Cycles ──
  const detectedCycles = detectCycles(nodeMap, edges);
  cycles.push(...detectedCycles);

  // ── Detect Action Chains ──
  const detectedChains = detectActionChains(nodeMap, edges);
  chains.push(...detectedChains);

  return { nodes: nodeMap, edges, cycles, chains };
}

// ── Agent Promise Detection ──────────────────────────────────────

const PROMISE_PATTERNS: RegExp[] = [
  /I'?ll\s+(call|follow\s*up|reach\s*out|get\s*back|check|look\s*into|handle|take\s*care)/i,
  /let\s*me\s+(check|look|see|find\s*out|get\s*back)/i,
  /will\s+(call|follow\s*up|reach\s*out|handle|take\s*care)/i,
  /(assign|hand|transfer)(ed|ing)?\s*(this|it|over)?\s*to\s*(me|myself)/i,
  /I'?m\s+(on\s*it|looking\s*into|handling|taking\s*care)/i,
  /(I|we)\s+(will|can|should)\s+(resolve|fix|handle|address)/i,
];

function detectAgentPromise(
  ctx: CustomerDiscoveryContext,
  agentName: string
): string | null {
  for (const msg of ctx.slack.mentions) {
    const msgAgent = msg.userName || msg.userId;
    if (msgAgent === agentName) {
      for (const pattern of PROMISE_PATTERNS) {
        const match = msg.text.match(pattern);
        if (match) {
          return match[0].trim();
        }
      }
    }
  }
  return null;
}

// ── Cycle Detection (DFS-based) ──────────────────────────────────

function detectCycles(
  nodes: Map<string, GraphNode>,
  edges: GraphEdge[]
): GraphCycle[] {
  const cycles: GraphCycle[] = [];
  const adj = new Map<string, string[]>();

  for (const edge of edges) {
    if (!adj.has(edge.from)) adj.set(edge.from, []);
    adj.get(edge.from)!.push(edge.to);
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();
  const path: string[] = [];

  function dfs(nodeId: string): void {
    if (cycles.length >= 20) return; // limit cycles detected

    visited.add(nodeId);
    inStack.add(nodeId);
    path.push(nodeId);

    const neighbors = adj.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else if (inStack.has(neighbor)) {
        // Found cycle
        const cycleStart = path.indexOf(neighbor);
        const cyclePath = path.slice(cycleStart);

        const cycleNode = nodes.get(neighbor);
        const type = classifyCycle(cyclePath, nodes);
        cycles.push({
          path: cyclePath,
          type,
          severity: severityFromCycleType(type),
          description: describeCycle(cyclePath, nodes, type),
        });
      }
    }

    path.pop();
    inStack.delete(nodeId);
  }

  for (const nodeId of nodes.keys()) {
    if (!visited.has(nodeId)) {
      dfs(nodeId);
    }
  }

  return cycles;
}

function classifyCycle(
  path: string[],
  nodes: Map<string, GraphNode>
): GraphCycle['type'] {
  const nodeTypes = path.map((id) => nodes.get(id)?.type);

  if (nodeTypes.includes('payment') && nodeTypes.includes('action')) {
    return 'billing_loop';
  }
  if (nodeTypes.includes('ticket') && nodeTypes.includes('action') && path.length >= 4) {
    return 'stale_action';
  }
  if (nodeTypes.includes('agent') && path.length >= 3) {
    return 'escalation_loop';
  }
  return 'churn_risk';
}

function severityFromCycleType(
  type: GraphCycle['type']
): GraphCycle['severity'] {
  switch (type) {
    case 'billing_loop':
      return 'critical';
    case 'stale_action':
      return 'high';
    case 'escalation_loop':
      return 'medium';
    case 'churn_risk':
      return 'medium';
    default:
      return 'medium';
  }
}

function describeCycle(
  path: string[],
  nodes: Map<string, GraphNode>,
  type: GraphCycle['type']
): string {
  const labels = path.map((id) => nodes.get(id)?.label || id);
  switch (type) {
    case 'billing_loop':
      return `Billing cycle detected: ${labels.join(' → ')}. Payment may be looping or stuck.`;
    case 'stale_action':
      return `Stale action chain: ${labels.join(' → ')}. Action required but not progressing.`;
    case 'escalation_loop':
      return `Escalation loop: ${labels.join(' → ')}. Issue may be bouncing between agents.`;
    case 'churn_risk':
      return `Churn risk pattern: ${labels.join(' → ')}. Customer showing warning signals.`;
    default:
      return `Cycle: ${labels.join(' → ')}`;
  }
}

// ── Action Chain Detection ───────────────────────────────────────

function detectActionChains(
  nodes: Map<string, GraphNode>,
  edges: GraphEdge[]
): ActionChain[] {
  const chains: ActionChain[] = [];

  // Find action nodes and trace backward to customer, forward to resolution
  const actionNodes = [...nodes.values()].filter((n) => n.type === 'action');
  const adj = new Map<string, string[]>();
  const revAdj = new Map<string, string[]>();

  for (const edge of edges) {
    if (!adj.has(edge.from)) adj.set(edge.from, []);
    adj.get(edge.from)!.push(edge.to);
    if (!revAdj.has(edge.to)) revAdj.set(edge.to, []);
    revAdj.get(edge.to)!.push(edge.from);
  }

  for (const actionNode of actionNodes) {
    // Trace back to find start (customer node)
    const visited = new Set<string>();
    const queue = [actionNode.id];
    let startNode = actionNode.id;
    const fullChain: string[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      fullChain.push(current);

      const parents = revAdj.get(current) || [];
      for (const parent of parents) {
        const parentNode = nodes.get(parent);
        if (parentNode?.type === 'customer') {
          startNode = parent;
          break;
        }
        queue.push(parent);
      }
    }

    // Trace forward to find end (resolution or terminal)
    let endNode = actionNode.id;
    const fwdQueue = [actionNode.id];
    const fwdVisited = new Set<string>();

    while (fwdQueue.length > 0) {
      const current = fwdQueue.shift()!;
      if (fwdVisited.has(current)) continue;
      fwdVisited.add(current);

      const children = adj.get(current) || [];
      if (children.length === 0) {
        endNode = current;
        break;
      }
      for (const child of children) {
        fwdQueue.push(child);
        endNode = child;
      }
    }

    // Determine status
    const endNodeObj = nodes.get(endNode);
    let status: ActionChain['status'] = 'in_progress';
    let stalledReason: string | undefined;

    if (endNodeObj?.type === 'customer') {
      status = 'completed';
    } else if (
      actionNode.data &&
      typeof actionNode.data === 'object' &&
      'hoursSinceUpdate' in actionNode.data &&
      (actionNode.data as Record<string, unknown>).hoursSinceUpdate as number > 48
    ) {
      status = 'stalled';
      stalledReason = `No progress for ${(actionNode.data as Record<string, unknown>).hoursSinceUpdate}h`;
    }

    chains.push({
      steps: [startNode, actionNode.id, endNode],
      startNode,
      endNode,
      status,
      stalledReason,
    });
  }

  return chains;
}

// ── Graph Summary ────────────────────────────────────────────────

export interface GraphSummary {
  nodeCounts: Record<string, number>;
  edgeCounts: Record<string, number>;
  cycleCount: number;
  chainCount: number;
  criticalCycles: number;
  stalledChains: number;
  topConnectedCustomers: Array<{ id: string; label: string; connections: number }>;
}

export function summarizeGraph(graph: DependencyGraph): GraphSummary {
  const nodeCounts: Record<string, number> = {};
  const edgeCounts: Record<string, number> = {};

  for (const node of graph.nodes.values()) {
    nodeCounts[node.type] = (nodeCounts[node.type] || 0) + 1;
  }
  for (const edge of graph.edges) {
    edgeCounts[edge.type] = (edgeCounts[edge.type] || 0) + 1;
  }

  // Find most-connected customers
  const customerConnections = new Map<string, { id: string; label: string; connections: number }>();
  for (const node of graph.nodes.values()) {
    if (node.type === 'customer') {
      const connCount =
        graph.edges.filter((e) => e.from === node.id || e.to === node.id).length;
      customerConnections.set(node.id, {
        id: node.id,
        label: node.label,
        connections: connCount,
      });
    }
  }

  return {
    nodeCounts,
    edgeCounts,
    cycleCount: graph.cycles.length,
    chainCount: graph.chains.length,
    criticalCycles: graph.cycles.filter((c) => c.severity === 'critical').length,
    stalledChains: graph.chains.filter((c) => c.status === 'stalled').length,
    topConnectedCustomers: [...customerConnections.values()]
      .sort((a, b) => b.connections - a.connections)
      .slice(0, 10),
  };
}
