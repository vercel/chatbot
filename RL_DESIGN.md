# Rustra RL System — Design Record (v0, July 2026)

Basis: a deep-research sweep (July 2026) over 2025–mid-2026 agentic-RL
literature and industry practice; 25 primary sources fetched, 124 claims
extracted, top 25 adversarially verified (24 confirmed 3-0, 1 refuted).
Citations at the bottom. This document pins down what Rustra builds and —
just as deliberately — what it defers.

## The one-sentence verdict

**Build the trajectory schema and experience-collection pipeline first;
defer the training loop.** Every credible training method's data
requirements must be captured at serve time or the trajectories are
unusable later, while the algorithm frontier is churning quarterly
(GiGPO May 2025 → ARPO Jul 2025 → hindsight/counterfactual methods
Mar 2026 → G2PO Jun 2026) and can be chosen when we're ready to train.

## What the research established

1. **Agentic RL ≠ RLHF.** The field survey [1] frames agent training as
   temporally extended POMDPs (20–100+ turns, 100k–500k+ tokens, stochastic
   tool environments, partial observability) vs the degenerate single-step
   MDP of response-level RLHF. Training data must therefore be
   *trajectory-shaped*, not *response-shaped*.
2. **The bottleneck is credit assignment, not policy optimization.**
   GRPO-family methods (the dominant lineage: DAPO, GSPO, ProRL) broadcast
   one episode-level advantage to every token; gradient variance grows
   O(T·Var[R]) with horizon; sparse outcome rewards become uninformative
   on long tasks [1][2][3]. The verified frontier is finer-grained credit:
   turn-level rewards (MT-GRPO/PPO), step-level anchor-state grouping
   (GiGPO, +12%/+9% over GRPO on ALFWorld/WebShop [4]), entropy-triggered
   branching at tool boundaries (ARPO, ICLR 2026 [5]), global
   state-transition graphs (G2PO, up to +22.2% [3]), and turn-level
   hindsight/counterfactual credit (HCAPO, C3/CCPO, CARL [6]).
   **Every one of these consumes per-turn / per-tool-call structure; some
   consume token-level logprob/entropy at tool boundaries.**
3. **Verifiable execution feedback is the load-bearing reward.** Unit
   tests, symbolic verifiers, task-success checks [1]. A widely-repeated
   claim that process reward models are *generally* superior to
   outcome-only rewards was **refuted in verification (0-3)** — PRMs are
   an active complement, not established doctrine. Design the reward
   schema so outcome labels are primary and dense signals are optional.
4. **Logged successful trajectories alone are a sufficient substrate.**
   InversePRM learns dense process rewards purely from demonstrations
   marked "successful" — no outcome-label pipeline needed at training
   time (86.6% ALFWorld from 10k demos vs 63.4% SFT-on-same-demos) [7].
   This is the strongest argument for collection-first: the cheapest
   label we can write today ("this run succeeded / this run was
   approved") unlocks the strongest known training recipes later.
5. **The small-team path is open-weights.** 3B–14B open models
   (Llama 3.2, Qwen 2.5) fine-tuned with these methods beat *prompted*
   frontier models in-domain (88–91% vs 65.7% GPT-4o on ALFWorld) [4][7].
   Whether frontier API models can be RL-tuned on *multi-turn tool-use*
   trajectories at all remains an open question (provider RFT offerings
   are single-response-grader shaped) — do not couple the design to it.

## What Rustra captures at serve time (the schema, v0)

A new storage domain following the existing domain-trait pattern —
`ExperienceStore` — **separate from observability**. Spans are best-effort
by policy (recording must never fail the instrumented op); training data
is first-class and complete-or-absent. A trajectory that silently lost a
turn is worse than no trajectory.

- **`Trajectory`** — one per agent run: run/agent/user/model ids,
  start/end, terminal status, sampling flag, schema version.
- **`TrajectoryTurn`** — one per agent-loop step, in order:
  - the **exact `ModelRequest`** the model saw (context assembly is
    dynamic, so the assembled request must be snapshotted — message ids
    alone cannot reconstruct it);
  - the full `ModelResponse` content blocks (already Anthropic normal
    form — the least lossy shape we have);
  - **every tool call with complete input and result, including error
    results and timeouts** (POMDP stochasticity is signal, not noise);
  - a **canonical observation serialization + hash** per tool result
    (sorted-key JSON) — GiGPO/G2PO group by exact state identity;
    fuzzy matching is unproven (open question), so store raw + hash;
  - **optional `TokenStats`**: per-block logprobs/entropy where the
    provider exposes them (ARPO's branching signal). Anthropic's API
    does not; vLLM/OpenAI-compatible adapters (roadmap 2.4) do. The
    field is `Option` — capture-when-available, never blocking.
- **`RewardEvent`** — typed, provenance-tagged, attachable to a
  trajectory or a specific turn:
  - `TaskOutcome` (terminal success/failure — primary),
  - `HitlDecision` (**approve/reject from the interrupt system — we
    already persist `DecisionRecord`s; this is a join, not new
    plumbing**),
  - `VerifierResult` (execution feedback: test pass, symbolic check —
    the Scorer trait planned in roadmap Pillar 5 writes here),
  - `HumanLabel` (explicit thumbs/edits — API surface later),
  - `JudgeScore` (model-judged, kept distinct because judge rewards are
    hackable at scale — open question).

Retention/sampling config from day one (trajectories are heavy; the
retention machinery is roadmap 3b), and a **JSONL export API** as the
training-side contract. Rustra collects; training runs out-of-process
against the export.

## Phasing

- **E1 (M): schema + capture.** `ExperienceStore` domain (in-memory +
  SQLite first), capture hooks at the agent loop's existing step
  boundaries, HITL decision join, sampling/retention config.
- **E2 (S–M): labels + export.** Success/expert marking API, human-label
  endpoint, JSONL export, `TokenStats` plumbed through the
  OpenAI-compatible adapter when it lands (roadmap 2.4).
- **E3 (L, deferred): training pilot.** Open-weights (Qwen-class) +
  the then-current credit-assignment method (GiGPO/ARPO/G2PO-family),
  InversePRM from approved trajectories as the first dense-reward
  experiment. Decision point deliberately deferred — the method table
  is being rewritten quarterly.

## Open questions (from verification, unresolved in the literature)

1. Provider RFT for multi-turn tool-use trajectories — currently
   single-response shaped; monitor, don't couple.
2. When do memory/experience approaches (skill libraries, retrieved
   experience, self-improvement loops) beat weight updates — no
   head-to-head evidence yet; Rustra's skills/knowledge system is the
   hedge and the two share the same collected substrate.
3. Anchor/graph state grouping assumes repeated identical observations —
   open-ended production traces may not repeat; canonical hashing keeps
   the option open, fuzzy matching is research.
4. Converting noisy implicit signals (thumbs, edits, abandonment) into
   trustworthy rewards — schema keeps provenance so label quality can be
   filtered at training time.

## Citations

[1] Agentic RL survey, TMLR — arXiv:2509.02547
[2] Credit-assignment survey (2026) — arXiv:2604.09459
[3] G2PO (Microsoft Research) — arXiv:2606.22995
[4] GiGPO (NeurIPS 2025) — arXiv:2505.10978; MT-GRPO — arXiv:2505.11821
[5] ARPO (ICLR 2026) — arXiv:2507.19849; AEPO — arXiv:2510.14545
[6] HCAPO — arXiv:2603.08754; C3/CCPO — arXiv:2603.06859 /
    arXiv:2603.21563; CARL — arXiv:2512.04949; VinePPO — ICML 2025
[7] AgentPRM / InversePRM (Cornell) — arXiv:2502.10325; Web-Shepherd —
    arXiv:2505.15277; GUI-Shepherd — arXiv:2509.23738; ToolPRM —
    arXiv:2510.14703
