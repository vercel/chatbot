export type VisibilityType = "private" | "public";

export type ArtifactKind = "text" | "code" | "image" | "sheet";

export type Chat = {
  id: string;
  createdAt: Date | string;
  title: string;
  userId: string;
  visibility: VisibilityType;
};

export type DBMessage = {
  id: string;
  chatId: string;
  role: "user" | "assistant" | "system";
  parts: unknown;
  attachments: unknown;
  createdAt: Date | string;
};

export type Vote = {
  chatId: string;
  messageId: string;
  isUpvoted: boolean;
};

export type Document = {
  id: string;
  createdAt: Date | string;
  title: string;
  content: string | null;
  kind: ArtifactKind;
  userId: string;
};

export type Suggestion = {
  id: string;
  documentId: string;
  documentCreatedAt: Date | string;
  originalText: string;
  suggestedText: string;
  description: string | null;
  isResolved: boolean;
  userId: string;
  createdAt: Date | string;
};
