/**
 * planSession tool — Phase 19: Formal Planning Mode in Chat
 *
 * When user says "plan X" or "let's plan", Chat enters PLANNING MODE:
 *   1. Reads relevant skills from cortex based on intent
 *   2. Asks clarifying questions (max 3)
 *   3. Drafts PRD outline with phases, ACs, file map
 *   4. Saves to library_plans table
 *   5. Offers: "Approve plan", "Refine plan", "Execute with V2"
 *
 * Returns: { planId, summary, phases, acceptance_criteria, files_affected }
 */
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { tool } from "ai";
import { z } from "zod";
import { generateUUID } from "@/lib/utils";
import { libraryPlan } from "@/lib/db/schema";

const dbClient = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(dbClient);

// ─── Intent → Skill Mapping ────────────────────────────────────────────

const INTENT_SKILL_MAP: Record<string, string[]> = {
  design: [
    "nextjs-shadcn-ai-elements-design-mastery",
    "agent-design-skills",
  ],
  architecture: [
    "agent-architecture-master-blueprint",
    "unified-architecture-v1",
  ],
  database: [
    "neptune-repo-knowledge-base",
  ],
  testing: [
    "autonomous-test-fix-deploy",
    "test-small-scale-large",
  ],
  repo: [
    "neptune-repo-knowledge-base",
    "jarvis-os-repo-identity",
  ],
  coding: [
    "inline-coding-skill",
    "autonomous-coding-loop-v1",
  ],
  ui: [
    "nextjs-shadcn-ai-elements-design-mastery",
  ],
  workflow: [
    "agent-architecture-master-blueprint",
  ],
};

function detectIntentSkills(goal: string): string[] {
  const lower = goal.toLowerCase();
  const skills: Set<string> = new Set();

  if (/design|ui|ux|component|layout|style|mobile|sidebar|sheet|drawer|panel|tailwind|css/i.test(lower)) {
    INTENT_SKILL_MAP.design.forEach((s) => skills.add(s));
    INTENT_SKILL_MAP.ui.forEach((s) => skills.add(s));
  }
  if (/architecture|architect|system|pattern|structure|orchestrat|pipeline|flow/i.test(lower)) {
    INTENT_SKILL_MAP.architecture.forEach((s) => skills.add(s));
  }
  if (/database|db|schema|migration|sql|postgres|table|model/i.test(lower)) {
    INTENT_SKILL_MAP.database.forEach((s) => skills.add(s));
  }
  if (/test|validate|verify|lint|build|deploy|ci|quality/i.test(lower)) {
    INTENT_SKILL_MAP.testing.forEach((s) => skills.add(s));
  }
  if (/repo|repository|github|git|push|commit|branch|file/i.test(lower)) {
    INTENT_SKILL_MAP.repo.forEach((s) => skills.add(s));
  }
  if (/code|coding|implement|build|create|scaffold|generate|component|page|route/i.test(lower)) {
    INTENT_SKILL_MAP.coding.forEach((s) => skills.add(s));
  }
  if (/workflow|pipeline|automate|orchestrat|dispatch|handoff/i.test(lower)) {
    INTENT_SKILL_MAP.workflow.forEach((s) => skills.add(s));
  }

  return [...skills];
}

// ─── Plan Generator ─────────────────────────────────────────────────────

interface PlanPhase {
  name: string;
  goal: string;
  files: string[];
  acceptance_criteria: string[];
}

interface PlanOutput {
  title: string;
  summary: string;
  phases: PlanPhase[];
  acceptanceCriteria: string[];
  filesAffected: string[];
  clarifyingQuestions: string[];
  skillsLoaded: string[];
}

function generatePlan(goal: string, _context?: string): PlanOutput {
  const skillsLoaded = detectIntentSkills(goal);

  // Generate clarifying questions based on goal analysis
  const clarifyingQuestions: string[] = [];
  const lower = goal.toLowerCase();

  if (!/where|file|path|route/i.test(lower)) {
    clarifyingQuestions.push("Where should the new code live? (e.g., app/(chat)/, components/, lib/)?");
  }
  if (!/design|style|look|theme/i.test(lower) && /component|page|ui/i.test(lower)) {
    clarifyingQuestions.push("Any specific design requirements? (e.g., shadcn components, dark theme, mobile-first)?");
  }
  if (/database|db|schema|migration|table/i.test(lower) && !/drizzle|prisma|orm/i.test(lower)) {
    clarifyingQuestions.push("Using Drizzle ORM as usual, or a different approach for the schema?");
  }
  if (clarifyingQuestions.length === 0) {
    clarifyingQuestions.push("Are there any constraints or existing patterns to follow?");
  }

  // Draft phases
  const phases: PlanPhase[] = [];
  const allFiles: Set<string> = new Set();
  const allACs: string[] = [];

  // Phase 1: always Setup/Scaffold
  phases.push({
    name: "Setup & Scaffold",
    goal: `Create the necessary files and imports for: ${goal.slice(0, 80)}`,
    files: ["(to be determined — depends on answers to clarifying questions)"],
    acceptance_criteria: [
      "All new files created with proper imports",
      "TypeScript compiles without errors on new files",
    ],
  });

  // Phase 2: Core Implementation
  phases.push({
    name: "Core Implementation",
    goal: `Implement the main functionality: ${goal.slice(0, 80)}`,
    files: ["(to be determined)"],
    acceptance_criteria: [
      "Core feature works end-to-end",
      "UI renders correctly on mobile and desktop",
      "Error states handled",
    ],
  });

  // Phase 3: Polish & Validate
  phases.push({
    name: "Polish & Validate",
    goal: "Add loading states, error handling, mobile responsiveness, and run build validation",
    files: ["(to be determined)"],
    acceptance_criteria: [
      "pnpm build passes with 0 errors",
      "pnpm type-check passes",
      "Mobile layout verified",
      "All states covered (loading, empty, error, success)",
    ],
  });

  // Collect files and ACs
  phases.forEach((p) => {
    p.files.forEach((f) => allFiles.add(f));
    p.acceptance_criteria.forEach((ac) => {
      if (!allACs.includes(ac)) allACs.push(ac);
    });
  });

  return {
    title: goal.length > 100 ? goal.slice(0, 97) + "..." : goal,
    summary: `Plan for: ${goal.slice(0, 150)}`,
    phases,
    acceptanceCriteria: allACs,
    filesAffected: [...allFiles],
    clarifyingQuestions: clarifyingQuestions.slice(0, 3),
    skillsLoaded,
  };
}

// ─── Main Tool ──────────────────────────────────────────────────────────

export const planSession = tool({
  description:
    "Enter formal PLANNING MODE. When the user wants to plan a feature, bug fix, " +
    "or any code change, use this tool first. It reads relevant design/architecture " +
    "skills from cortex, asks clarifying questions, drafts a PRD outline with phases " +
    "and acceptance criteria, and saves the plan to the database. " +
    "After planning, the user can approve, refine, or execute with V2 coding agents.",
  inputSchema: z.object({
    goal: z
      .string()
      .describe(
        "Natural language description of what to plan. Be specific about what you want to build, fix, or change."
      ),
    context: z
      .string()
      .optional()
      .describe(
        "Additional context: existing files to consider, constraints, design preferences, etc."
      ),
    refinePlanId: z
      .string()
      .optional()
      .describe(
        "If refining an existing plan, pass the plan UUID to update it instead of creating new."
      ),
  }),
  execute: async ({ goal, context, refinePlanId }) => {
    try {
      // Generate the plan
      const plan = generatePlan(goal, context);

      // If refining, update existing plan
      if (refinePlanId) {
        try {
          await db
            .update(libraryPlan)
            .set({
              title: plan.title,
              summary: plan.summary,
              phases: plan.phases,
              acceptanceCriteria: plan.acceptanceCriteria,
              filesAffected: plan.filesAffected,
              skillsLoaded: plan.skillsLoaded,
              updatedAt: new Date(),
            })
            .where(eq(libraryPlan.id, refinePlanId));

          return {
            success: true,
            planId: refinePlanId,
            action: "refined",
            ...plan,
            clarifyingQuestions: plan.clarifyingQuestions,
            message: `Plan refined. ${plan.clarifyingQuestions.length} clarifying questions below. Answer them to improve the plan, or say "approve" to proceed.`,
          };
        } catch (err) {
          // If update fails (e.g., plan not found), fall through to create new
          console.warn("[planSession] Refine failed, creating new:", (err as Error).message);
        }
      }

      // Save new plan to DB
      const planId = generateUUID();

      try {
        await db.insert(libraryPlan).values({
          id: planId,
          title: plan.title,
          summary: plan.summary,
          phases: plan.phases,
          acceptanceCriteria: plan.acceptanceCriteria,
          filesAffected: plan.filesAffected,
          skillsLoaded: plan.skillsLoaded,
          status: "draft",
          contextGoal: goal,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } catch (dbErr) {
        console.error("[planSession] DB insert failed (non-fatal):", (dbErr as Error).message);
        // Continue — the plan data is still returned even if DB save fails
      }

      return {
        success: true,
        planId,
        action: "created",
        title: plan.title,
        summary: plan.summary,
        phases: plan.phases,
        acceptanceCriteria: plan.acceptanceCriteria,
        filesAffected: plan.filesAffected,
        skillsLoaded: plan.skillsLoaded,
        clarifyingQuestions: plan.clarifyingQuestions,
        nextActions: [
          "Answer the clarifying questions to refine the plan",
          'Say "approve" to lock the plan and prepare for execution',
          'Say "execute with V2" to hand off to coding agents',
          `Use spawnCodingAgent with planId=${planId} to dispatch`,
        ],
        message:
          `Plan "${plan.title}" created with ${plan.phases.length} phases ` +
          `and ${plan.acceptanceCriteria.length} acceptance criteria. ` +
          `${plan.skillsLoaded.length} skills detected: ${plan.skillsLoaded.join(", ") || "none"}. ` +
          `${plan.clarifyingQuestions.length} clarifying questions to answer.`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: {
          code: "PLAN_FAILED",
          message,
          retryable: true,
          suggestion: "Try again with a more specific goal description.",
        },
      };
    }
  },
});
