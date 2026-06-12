/**
 * Base44 createEntity — create a new entity record
 */
import { tool } from "ai";
import { z } from "zod";
import { base44Service } from "../client";

export const createEntity = tool({
  description:
    "Create a new Base44 entity record. Returns the created record with ID.",
  inputSchema: z.object({
    entity: z.string().describe("Entity type to create"),
    data: z.record(z.unknown()).describe("Field values for the new record"),
  }),
  execute: async ({ entity, data }) => {
    try {
      const record = await base44Service.entities[entity].create(
        data as Record<string, unknown>
      );
      return { created: true, entity, record };
    } catch (err) {
      return {
        error: `Base44 create failed: ${err instanceof Error ? err.message : "Unknown"}`,
      };
    }
  },
});
