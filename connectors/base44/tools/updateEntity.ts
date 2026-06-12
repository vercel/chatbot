/**
 * Base44 updateEntity — patch an existing entity record by ID
 */
import { tool } from "ai";
import { z } from "zod";
import { base44Service } from "../client";

export const updateEntity = tool({
  description:
    "Update an existing Base44 entity record by ID. Partial update (patch).",
  inputSchema: z.object({
    entity: z.string().describe("Entity type to update"),
    id: z.string().describe("Record ID to update"),
    data: z.record(z.unknown()).describe("Fields to update (partial patch)"),
  }),
  execute: async ({ entity, id, data }) => {
    try {
      const record = await base44Service.entities[entity].update(
        id,
        data as Record<string, unknown>
      );
      return { updated: true, entity, id, record };
    } catch (err) {
      return {
        error: `Base44 update failed: ${err instanceof Error ? err.message : "Unknown"}`,
      };
    }
  },
});
