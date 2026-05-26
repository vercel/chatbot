import { tool, type UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import type { ChatMessage } from "@/lib/types";

type UpdateDocumentProps = {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  modelId: string;
};

export const updateDocument = ({
  session: _session,
  dataStream,
  modelId: _modelId,
}: UpdateDocumentProps) =>
  tool({
    description:
      "Full rewrite of an existing artifact. Only use for major changes where most content needs replacing. Prefer editDocument for targeted changes.",
    inputSchema: z.object({
      id: z.string().describe("The ID of the artifact to rewrite"),
      description: z
        .string()
        .default("Improve the content")
        .describe("The description of changes that need to be made"),
    }),
    execute: async ({ id, description }) => {
      void description;

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
