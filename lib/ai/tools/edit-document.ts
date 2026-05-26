import { tool, type UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import type { ChatMessage } from "@/lib/types";

type EditDocumentProps = {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
};

export const editDocument = ({ session: _session, dataStream }: EditDocumentProps) =>
  tool({
    description:
      "Make a targeted edit to an existing artifact by finding and replacing an exact string. Preferred over updateDocument for small changes. The old_string must match exactly.",
    inputSchema: z.object({
      id: z.string().describe("The ID of the artifact to edit"),
      old_string: z
        .string()
        .describe(
          "Exact string to find. Include 3-5 surrounding lines for uniqueness."
        ),
      new_string: z.string().describe("Replacement string"),
      replace_all: z
        .boolean()
        .optional()
        .describe(
          "Replace all occurrences instead of just the first (default false)"
        ),
    }),
    execute: async ({ id, old_string, new_string, replace_all }) => {
      void old_string;
      void new_string;
      void replace_all;

      dataStream.write({
        type: "data-clear",
        data: null,
        transient: true,
      });

      dataStream.write({ type: "data-finish", data: null, transient: true });

      return {
        id,
        title: "Document",
        kind: "text" as const,
        content: "Document tools are disabled in UI-only mode.",
      };
    },
  });
