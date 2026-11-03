"use server";

import { auth } from "@/app/(auth)/auth";
import { getDocumentById, getSuggestionsByDocumentId } from "@/lib/db/queries";

export async function getSuggestions({ documentId }: { documentId: string }) {
  const session = await auth();
  if (!session?.user?.id) {
    return [];
  }

  const document = await getDocumentById({ id: documentId });
  if (!document || document.userId !== session.user.id) {
    return [];
  }

  const suggestions = await getSuggestionsByDocumentId({ documentId });
  return suggestions ?? [];
}
