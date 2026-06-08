/**
 * Knowledge Page — Memory + PRDs viewer with semantic search.
 */
import { auth } from "@/app/(auth)/auth";

export default async function KnowledgePage() {
  const session = await auth();
  if (!session?.user) {
    return (
      <div className="p-8 text-muted-foreground">
        Sign in to access knowledge.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-4">
        <h1 className="text-lg font-semibold">Knowledge</h1>
        <p className="text-sm text-muted-foreground">
          Memory store + PRD viewer. Semantic search across all knowledge
          artifacts.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="text-sm text-muted-foreground p-8 text-center border rounded-lg bg-card space-y-4">
          <div>
            <p className="font-medium mb-1">Knowledge Graph</p>
            <p>
              Vector-powered semantic search across skills, PRDs, and memory.
            </p>
          </div>
          <div>
            <p className="font-medium mb-1">PRD Archive</p>
            <p>
              Access via <code className="bg-muted px-1 rounded">readPRD</code>{" "}
              tool in chat.
            </p>
          </div>
          <div>
            <p className="font-medium mb-1">Session Memory</p>
            <p>
              Deposits and recall via{" "}
              <code className="bg-muted px-1 rounded">SessionDataStore</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
