import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { auth } from "@/app/(auth)/auth";
import { shouldRequireAuth } from "@/lib/auth-mode";
import { ChatbotError } from "@/lib/errors";
import { generateUUID } from "@/lib/utils";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 60;

type ChatLikeMessage = {
  role?: string;
  parts?: Array<{
    type?: string;
    text?: unknown;
  }>;
};

function extractTextFromParts(parts: ChatLikeMessage["parts"]) {
  return (
    parts
      ?.filter((part) => part.type === "text")
      .map((part) => (typeof part.text === "string" ? part.text : ""))
      .join("\n")
      .trim() ?? ""
  );
}

function getUserQuestion({
  message,
  messages,
}: {
  message?: ChatLikeMessage;
  messages?: ChatLikeMessage[];
}) {
  const directQuestion = extractTextFromParts(message?.parts);

  if (directQuestion) {
    return directQuestion;
  }

  const lastUserMessage = messages
    ?.filter((currentMessage) => currentMessage.role === "user")
    .at(-1);

  return extractTextFromParts(lastUserMessage?.parts);
}

function chunkText(text: string) {
  return text.match(/\S+\s*/g) ?? [text];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  if (shouldRequireAuth()) {
    const session = await auth();

    if (!session?.user) {
      return new ChatbotError("unauthorized:chat").toResponse();
    }
  }

  const question = getUserQuestion({
    message: requestBody.message,
    messages: requestBody.messages,
  });

  if (!question) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  const stream = createUIMessageStream({
    generateId: generateUUID,
    execute: async ({ writer }) => {
      const textId = generateUUID();
      const responseText = `UI-only mode is active.

I received your message:

> ${question}

The chat shell, streaming state, markdown rendering, and message layout are working. We will connect this route to your production backend once the backend contract is ready.`;

      writer.write({
        type: "text-start",
        id: textId,
      });

      for (const delta of chunkText(responseText)) {
        if (request.signal.aborted) {
          break;
        }

        writer.write({
          type: "text-delta",
          id: textId,
          delta,
        });
        await sleep(18);
      }

      if (!request.signal.aborted) {
        writer.write({ type: "text-end", id: textId });
      }
    },
    onError: (error) => {
      console.error("UI-only chat stream error:", error);
      return "The local UI-only chat stream failed.";
    },
  });

  return createUIMessageStreamResponse({ stream });
}
