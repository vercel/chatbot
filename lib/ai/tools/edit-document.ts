import { tool, type UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import { getDocumentById, saveDocument } from "@/lib/db/queries";
import type { ChatMessage } from "@/lib/types";

type EditDocumentProps = {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
};

export const editDocument = ({ session, dataStream }: EditDocumentProps) =>
  tool({
    description:
      "Make a targeted edit to an existing artifact by finding and replacing an exact string. Preferred over updateDocument for small changes. The old_string must match exactly.",
    execute: async ({ id, old_string, new_string, replace_all }) => {
      const document = await getDocumentById({ id });

      if (!document) {
        return { error: "Document not found" };
      }

      if (document.userId !== session.user?.id) {
        return { error: "Forbidden" };
      }

      if (!document.content) {
        return { error: "Document has no content" };
      }

      if (!document.content.includes(old_string)) {
        return { error: "old_string not found in document" };
      }

      const updated = replace_all
        ? document.content.replaceAll(old_string, new_string)
        : document.content.replace(old_string, new_string);

      await saveDocument({
        content: updated,
        id: document.id,
        kind: document.kind,
        title: document.title,
        userId: document.userId,
      });

      dataStream.write({
        data: null,
        transient: true,
        type: "data-clear",
      });

      if (document.kind === "code") {
        dataStream.write({
          data: updated,
          transient: true,
          type: "data-codeDelta",
        });
      } else if (document.kind === "sheet") {
        dataStream.write({
          data: updated,
          transient: true,
          type: "data-sheetDelta",
        });
      } else {
        dataStream.write({
          data: updated,
          transient: true,
          type: "data-textDelta",
        });
      }

      dataStream.write({ data: null, transient: true, type: "data-finish" });

      return {
        content:
          document.kind === "code"
            ? "The script has been edited successfully."
            : "The document has been edited successfully.",
        id,
        kind: document.kind,
        title: document.title,
      };
    },
    inputSchema: z.object({
      id: z.string().describe("The ID of the artifact to edit"),
      new_string: z.string().describe("Replacement string"),
      old_string: z
        .string()
        .describe(
          "Exact string to find. Include 3-5 surrounding lines for uniqueness."
        ),
      replace_all: z
        .boolean()
        .optional()
        .describe(
          "Replace all occurrences instead of just the first (default false)"
        ),
    }),
  });
