import { Output, streamText, tool, type UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import { getDocumentById, saveSuggestions } from "@/lib/db/queries";
import type { Suggestion } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { generateUUID } from "@/lib/utils";
import { getLanguageModel } from "../providers";

type RequestSuggestionsProps = {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  modelId: string;
};

export const requestSuggestions = ({
  session,
  dataStream,
  modelId,
}: RequestSuggestionsProps) =>
  tool({
    description:
      "Request writing suggestions for an existing document artifact. Only use this when the user explicitly asks to improve or get suggestions for a document they have already created. Never use for general questions.",
    execute: async ({ documentId }) => {
      const document = await getDocumentById({ id: documentId });

      if (!document?.content) {
        return {
          error: "Document not found",
        };
      }

      if (document.userId !== session.user?.id) {
        return { error: "Forbidden" };
      }

      const suggestions: Omit<
        Suggestion,
        "userId" | "createdAt" | "documentCreatedAt"
      >[] = [];

      const { partialOutputStream } = streamText({
        instructions:
          "You are a writing assistant. Given a piece of writing, offer up to 5 suggestions to improve it. Each suggestion must contain full sentences, not just individual words. Describe what changed and why.",
        model: getLanguageModel(modelId),
        output: Output.array({
          element: z.object({
            description: z
              .string()
              .describe("The description of the suggestion"),
            originalSentence: z.string().describe("The original sentence"),
            suggestedSentence: z.string().describe("The suggested sentence"),
          }),
        }),
        prompt: document.content,
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
            description: element.description,
            documentId,
            id: generateUUID(),
            isResolved: false,
            originalText: element.originalSentence,
            suggestedText: element.suggestedSentence,
          };

          dataStream.write({
            data: suggestion as Suggestion,
            transient: true,
            type: "data-suggestion",
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
            createdAt: new Date(),
            documentCreatedAt: document.createdAt,
            userId,
          })),
        });
      }

      return {
        id: documentId,
        kind: document.kind,
        message: "Suggestions have been added to the document",
        title: document.title,
      };
    },
    inputSchema: z.object({
      documentId: z
        .string()
        .describe(
          "The UUID of an existing document artifact that was previously created with createDocument"
        ),
    }),
  });
