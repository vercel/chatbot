import type { UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import { codeDocumentHandler } from "@/artifacts/code/server";
import { sheetDocumentHandler } from "@/artifacts/sheet/server";
import { textDocumentHandler } from "@/artifacts/text/server";
import type { ArtifactKind } from "@/components/chat/artifact";
import { saveDocument } from "../db/queries";
import type { Document } from "../db/schema";
import type { ChatMessage } from "../types";

export type SaveDocumentProps = {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
};

export type CreateDocumentCallbackProps = {
  id: string;
  title: string;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  session: Session;
  modelId: string;
};

export type UpdateDocumentCallbackProps = {
  document: Document;
  description: string;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  session: Session;
  modelId: string;
};

export type DocumentHandler<T = ArtifactKind> = {
  kind: T;
  onCreateDocument: (args: CreateDocumentCallbackProps) => Promise<void>;
  onUpdateDocument: (args: UpdateDocumentCallbackProps) => Promise<void>;
};

export function createDocumentHandler<T extends ArtifactKind>(config: {
  kind: T;
  onCreateDocument: (params: CreateDocumentCallbackProps) => Promise<string>;
  onUpdateDocument: (params: UpdateDocumentCallbackProps) => Promise<string>;
}): DocumentHandler<T> {
  return {
    kind: config.kind,
    onCreateDocument: async (args: CreateDocumentCallbackProps) => {
      const draftContent = await config.onCreateDocument({
        dataStream: args.dataStream,
        id: args.id,
        modelId: args.modelId,
        session: args.session,
        title: args.title,
      });

      if (args.session?.user?.id) {
        await saveDocument({
          content: draftContent,
          id: args.id,
          kind: config.kind,
          title: args.title,
          userId: args.session.user.id,
        });
      }
    },
    onUpdateDocument: async (args: UpdateDocumentCallbackProps) => {
      const draftContent = await config.onUpdateDocument({
        dataStream: args.dataStream,
        description: args.description,
        document: args.document,
        modelId: args.modelId,
        session: args.session,
      });

      if (args.session?.user?.id) {
        await saveDocument({
          content: draftContent,
          id: args.document.id,
          kind: config.kind,
          title: args.document.title,
          userId: args.session.user.id,
        });
      }
    },
  };
}

export const documentHandlersByArtifactKind: DocumentHandler[] = [
  textDocumentHandler,
  codeDocumentHandler,
  sheetDocumentHandler,
];

export const artifactKinds = ["text", "code", "sheet"] as const;
