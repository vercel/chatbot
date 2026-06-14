import { smoothStream, streamText } from "ai";
import { updateDocumentPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";

// Phase 9: 30s hard timeout for artifact LLM generation to prevent infinite hangs
const ARTIFACT_GENERATION_TIMEOUT_MS = 30_000;

function timeoutReject(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error(`Artifact generation timed out after ${ms / 1000}s`)),
      ms
    )
  );
}

export const textDocumentHandler = createDocumentHandler<"text">({
  kind: "text",
  onCreateDocument: async ({ title, dataStream, modelId, specification }) => {
    let draftContent = "";

    // U9.1 FIX: Use specification as primary prompt context when provided.
    // This ensures the artifact content reflects the primary LLM's intent and data,
    // not just a generic title-based generation. Falls back to title-only for backward compat.
    const promptContext = specification
      ? `Title: ${title}\n\nDetailed specification from the conversation:\n${specification}\n\nWrite comprehensive content following the specification above. Include all data points, findings, and structure mentioned. Use markdown with appropriate headings.`
      : title;

    try {
      const { fullStream } = await Promise.race([
        streamText({
          model: getLanguageModel(modelId),
          system:
            "You are generating artifact content for a side panel. Write detailed, well-structured content following the provided specification. Markdown is supported. Use headings wherever appropriate. Include ALL data points and findings mentioned in the specification - be thorough.",
          experimental_transform: smoothStream({ chunking: "word" }),
          prompt: promptContext,
        }),
        timeoutReject(ARTIFACT_GENERATION_TIMEOUT_MS),
      ]);

      for await (const delta of fullStream) {
        if (delta.type === "text-delta") {
          draftContent += delta.text;
          dataStream.write({
            type: "data-textDelta",
            data: delta.text,
            transient: true,
          });
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      console.error(`[textDocumentHandler] onCreateDocument failed: ${errorMsg}`);
      dataStream.write({
        type: "data-textDelta",
        data: `\n\n[Artifact generation failed: ${errorMsg}. Please retry or ask the assistant for help.]`,
        transient: false,
      });
    }

    return draftContent;
  },
  onUpdateDocument: async ({ document, description, dataStream, modelId }) => {
    let draftContent = "";

    try {
      const { fullStream } = await Promise.race([
        streamText({
          model: getLanguageModel(modelId),
          system: updateDocumentPrompt(document.content, "text"),
          experimental_transform: smoothStream({ chunking: "word" }),
          prompt: description,
        }),
        timeoutReject(ARTIFACT_GENERATION_TIMEOUT_MS),
      ]);

      for await (const delta of fullStream) {
        if (delta.type === "text-delta") {
          draftContent += delta.text;
          dataStream.write({
            type: "data-textDelta",
            data: delta.text,
            transient: true,
          });
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      console.error(`[textDocumentHandler] onUpdateDocument failed: ${errorMsg}`);
      dataStream.write({
        type: "data-textDelta",
        data: `\n\n[Artifact update failed: ${errorMsg}]`,
        transient: false,
      });
    }

    return draftContent;
  },
});
