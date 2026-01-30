import { Output, streamText, tool, type UIMessageStreamWriter } from "ai";
import type { Session } from "@/lib/auth/session";
import { z } from "zod";
import { getDocumentById, saveSuggestions } from "@/lib/db/queries";
import type { Suggestion } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { generateUUID } from "@/lib/utils";
import { getArtifactModel } from "../providers";

type RequestSuggestionsProps = {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
};

export const requestSuggestions = ({
  session,
  dataStream,
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
      const document = await getDocumentById({ id: documentId });

      if (!document || !document.content) {
        return {
          error: "Document not found",
        };
      }

      const suggestions: Omit<
        Suggestion,
        "userId" | "createdAt" | "documentCreatedAt"
      >[] = [];

      const { partialOutputStream } = streamText({
        model: getArtifactModel(),
        system:
          "You are a help writing assistant. Given a piece of writing, please offer suggestions to improve the piece of writing and describe the change. It is very important for the edits to contain full sentences instead of just words. Max 5 suggestions.",
        prompt: document.content,
        output: Output.array({
          element: z.object({
            originalSentence: z.string().describe("The original sentence"),
            suggestedSentence: z.string().describe("The suggested sentence"),
            description: z
              .string()
              .describe("The description of the suggestion"),
          }),
        }),
      });

      let processedCount = 0;
      for await (const partialOutput of partialOutputStream) {
        if (!partialOutput) {
          continue;
        }

        for (let i = processedCount; i < partialOutput.length; i++) {
          const element = partialOutput[i];
          if (
            !element?.originalSentence ||
            !element?.suggestedSentence ||
            !element?.description
          ) {
            continue;
          }

          const suggestion = {
            originalText: element.originalSentence,
            suggestedText: element.suggestedSentence,
            description: element.description,
            id: generateUUID(),
            documentId,
            isResolved: false,
          };

          dataStream.write({
            type: "data-suggestion",
            data: suggestion as Suggestion,
            transient: true,
          });

          suggestions.push(suggestion);
          processedCount++;
        }
      }

      if (session.user?.id) {
        const userId = session.user.id;

        await saveSuggestions({
          suggestions: suggestions.map((suggestion) => ({
            ...suggestion,
            userId,
            createdAt: new Date(),
            documentCreatedAt: document.createdAt,
          })),
        });
      }

      return {
        id: documentId,
        title: document.title,
        kind: document.kind,
        message: "Suggestions have been added to the document",
      };
    },
  });
