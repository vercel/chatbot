import { tool } from "ai";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { z } from "zod";
import { libraryMission, libraryMissionEvent } from "@/lib/db/schema";
import { generateUUID } from "@/lib/utils";

const dbClient = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(dbClient);

const SUBSTEP_SCHEMA = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["pending", "running", "complete", "failed"]).default("pending"),
  evidence: z.array(z.string()).default([]),
  childCards: z.array(z.any()).optional(),
});

export type MissionSubStep = z.infer<typeof SUBSTEP_SCHEMA>;

export const createMission = tool({
  description: `Create a multi-step mission tracker that appears as a visual MissionCard in chat.
Use this for any complex multi-step task: code deployments, investigations, data audits, workflow runs.
The mission will show step-by-step progress with live SSE updates.
Each step can contain nested child cards (connector cards, handoff cards, etc).
The card supports 4 states: inline (compact), expanded (detailed), canvas (full panel), sandbox-linked (iframe preview).`,

  inputSchema: z.object({
    title: z.string().describe("Mission title, e.g. 'Fix billing bug for customer #xyz' or 'Deploy Phase 25'"),
    steps: z.array(z.object({
      name: z.string().describe("Step name, e.g. 'Investigate NMI logs'"),
      type: z.enum(["investigate", "analyze", "deploy", "v2_handoff", "report", "verify", "general"]).default("general").describe("Type of step"),
    })).min(1).max(10).describe("1-10 steps for the mission"),
    estimatedCost: z.number().optional().describe("Estimated cost in USD"),
    estimatedTimeMin: z.number().optional().describe("Estimated time in minutes"),
    chatId: z.string().optional(),
    userId: z.string().optional(),
  }),

  execute: async (input) => {
    const missionId = generateUUID();

    const steps: MissionSubStep[] = input.steps.map((step, idx) => ({
      id: generateUUID(),
      name: step.name,
      status: idx === 0 ? "running" : "pending" as const,
      evidence: [],
      childCards: [],
    }));

    try {
      await db.insert(libraryMission).values({
        id: missionId,
        title: input.title,
        steps: steps as unknown as Record<string, unknown>[],
        status: "running",
        estimatedCost: input.estimatedCost?.toString() ?? null,
        estimatedTimeMin: input.estimatedTimeMin ?? null,
        currentState: "inline",
        userId: (input.userId ?? null) as unknown as string,
        chatId: (input.chatId ?? null) as unknown as string,
        createdBy: "ai",
      });

      await db.insert(libraryMissionEvent).values({
        missionId,
        eventType: "created",
        payload: { title: input.title, stepCount: steps.length },
        createdBy: "ai",
      });

      await db.insert(libraryMissionEvent).values({
        missionId,
        eventType: "step_started",
        payload: { stepId: steps[0]!.id, stepName: steps[0]!.name, stepIndex: 0 },
        createdBy: "ai",
      });
    } catch (err) {
      console.error("[createMission] DB insert failed:", (err as Error).message);
      // Return mission data even if DB write fails (graceful degradation)
    }

    return {
      missionId,
      title: input.title,
      steps,
      status: "running",
      estimatedCost: input.estimatedCost,
      estimatedTime: input.estimatedTimeMin,
      hint: "MissionCard rendered. Use update-mission to advance steps.",
    };
  },
});
