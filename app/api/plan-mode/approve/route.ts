/**
 * app/api/plan-mode/approve/route.ts
 * U5.4 — Plan Mode Approval API
 *
 * POST: Accepts a proposal ID and a decision (approve/modify/cancel).
 * On approve: marks the proposal as approved and triggers execution.
 * On modify: applies modifications and returns updated proposal.
 * On cancel: marks the proposal as cancelled.
 *
 * Used by: PlanModeProposal component on decision.
 */
import { NextResponse } from "next/server";
import { collectAnnotation } from "@/connectors/neptune/functions/annotation-collector";

// ── Types ──────────────────────────────────────────────────────────────────

import type { PlanProposal } from "../propose/route";

// ── Access the shared proposal store ───────────────────────────────────────

declare global {
  var __planProposals: Map<string, PlanProposal> | undefined;
}

function getProposals(): Map<string, PlanProposal> {
  if (!globalThis.__planProposals) {
    globalThis.__planProposals = new Map<string, PlanProposal>();
  }
  return globalThis.__planProposals;
}

// ── POST: Execute Decision ─────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      proposalId,
      decision,
      modifications,
    } = body;

    if (!proposalId || typeof proposalId !== "string") {
      return NextResponse.json(
        { error: "Missing required field: proposalId" },
        { status: 400 }
      );
    }

    if (!["approve", "modify", "cancel"].includes(decision)) {
      return NextResponse.json(
        { error: "decision must be one of: approve, modify, cancel" },
        { status: 400 }
      );
    }

    const proposals = getProposals();
    const proposal = proposals.get(proposalId);

    if (!proposal) {
      return NextResponse.json(
        { error: `Proposal '${proposalId}' not found` },
        { status: 404 }
      );
    }

    if (proposal.status !== "pending") {
      return NextResponse.json(
        {
          error: `Proposal '${proposalId}' is already ${proposal.status}. Cannot ${decision}.`,
        },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    let outcome: "success" | "partial" | "failure" = "failure";
    let learning = "Unknown decision";

    switch (decision) {
      case "approve": {
        proposal.status = "executing";
        proposal.updatedAt = now;
        outcome = "success";
        learning = `Plan approved: ${proposalId}, ${proposal.phases.length} phases, ${proposal.totalBudget}t budget`;
        break;
      }
      case "modify": {
        proposal.status = "modified";
        proposal.modifications = modifications || "";
        proposal.updatedAt = now;
        outcome = "partial";
        learning = `Plan modified: ${proposalId}, changes: ${(modifications || "").slice(0, 100)}`;
        break;
      }
      case "cancel": {
        proposal.status = "cancelled";
        proposal.updatedAt = now;
        outcome = "partial";
        learning = `Plan cancelled: ${proposalId}`;
        break;
      }
    }

    proposals.set(proposalId, proposal);

    // Annotate the decision
    collectAnnotation({
      domain: "planning-research",
      playbook: "playbooks/planning-research/playbook-planning-research.md",
      skillOrWorkflow: `plan-mode-${decision}`,
      outcome,
      durationMs: 0,
      learning,
      toolsUsed: ["plan-mode-approve-api"],
    });

    // Build the execution plan if approved
    const executionPlan =
      decision === "approve"
        ? {
            proposalId,
            phases: proposal.phases.map((p, i) => ({
              index: i + 1,
              name: p.name,
              goal: p.goal,
              turnBudget: p.turnBudget,
              deliverables: p.deliverables,
              status: i === 0 ? "ready" : "blocked",
              blockedBy: i > 0 ? [`phase_${i}`] : [],
            })),
            readyToExecute: true,
            totalBudget: proposal.totalBudget,
            estimatedDuration: `${Math.ceil(proposal.totalBudget / 60)} minutes`,
          }
        : null;

    return NextResponse.json({
      decision,
      proposal,
      executionPlan,
      message:
        decision === "approve"
          ? `Plan approved! ${proposal.phases.length} phases ready for execution.`
          : decision === "modify"
            ? "Plan modifications recorded. Awaiting re-approval."
            : "Plan execution cancelled.",
      timestamp: now,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to process plan decision" },
      { status: 500 }
    );
  }
}

// ── GET: Execution Status ──────────────────────────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const proposalId = searchParams.get("id");

  if (!proposalId) {
    return NextResponse.json(
      { error: "Missing query parameter: id" },
      { status: 400 }
    );
  }

  const proposals = getProposals();
  const proposal = proposals.get(proposalId);

  if (!proposal) {
    return NextResponse.json(
      { error: `Proposal '${proposalId}' not found` },
      { status: 404 }
    );
  }

  return NextResponse.json({
    proposalId,
    status: proposal.status,
    phaseCount: proposal.phases.length,
    totalBudget: proposal.totalBudget,
    approvedAt: proposal.status === "executing" ? proposal.updatedAt : null,
  });
}
