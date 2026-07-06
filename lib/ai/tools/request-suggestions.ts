import { tool, type UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import type { ChatMessage } from "@/lib/types";

type RequestSuggestionsProps = {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  modelId: string;
};

export const requestSuggestions = ({
  session: _session,
  dataStream: _dataStream,
  modelId: _modelId,
}: RequestSuggestionsProps) =>
  tool({
    description:
      "Request writing suggestions for an existing document artifact. Only use this when the user explicitly asks to improve or get suggestions for a document they have already created. Never use for general questions.",
    inputSchema: z.object({
      documentId: z
        .string()
        .describe(
          "The UUID of an existing document artifact that was previously created with createDocument"
        ),
    }),
    execute: async ({ documentId }) => {
      return {
        id: documentId,
        title: "Document",
        kind: "text" as const,
        message: "Document suggestions are disabled in UI-only mode.",
      };
    },
  });
