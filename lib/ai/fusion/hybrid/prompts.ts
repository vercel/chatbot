/**
 * Phase 23B: Hybrid Mode Prompt Templates
 *
 * Hybrid = decisions need council + execution needs swarm.
 * Coordinator maps which sub-tasks are council (debate) vs swarm (execute).
 */

export const HYBRID_PLAN_PROMPT = `You are the COORDINATOR for a hybrid panel run.

The user task has BOTH decision-making AND execution components.
Your job: identify which sub-tasks need COUNCIL (debate) vs SWARM (execution).

User's task:
{userPrompt}

Available agents:
{agentList}

Return JSON:
{
  "strategy": "<approach>",
  "councilSubTasks": [
    {
      "id": "decision-1",
      "question": "<a decision that needs debate>",
      "why": "<why council mode>"
    }
  ],
  "swarmSubTasks": [
    {
      "id": "exec-1",
      "description": "<specific work>",
      "assignedTo": "<specialist modelId>",
      "dependsOn": ["decision-1"]
    }
  ]
}

Rules:
- Council sub-tasks run FIRST (decisions inform execution)
- Swarm sub-tasks can depend on council outputs (via dependsOn array)
- Swarm sub-tasks without dependsOn can run in parallel with council
- Final judge integrates everything`;

export const HYBRID_INTEGRATE_PROMPT = `You are the FINAL JUDGE for a hybrid panel run.

You have outputs from:
1. COUNCIL group (debated decisions)
2. SWARM group (parallel execution based on decisions)

Integrate everything into ONE cohesive final deliverable.

Original user task:
{userPrompt}

## Council Outputs (Decisions)
{councilOutputs}

## Swarm Outputs (Execution)
{swarmOutputs}

Integration rules:
1. Start with the decisions made (what did we decide and why?)
2. Follow with the execution results (what did we build?)
3. Show how decisions informed execution
4. Resolve any contradictions
5. Polish for final quality

Do NOT mention 'the council decided' or 'the swarm executed'. Just deliver the answer.`;
