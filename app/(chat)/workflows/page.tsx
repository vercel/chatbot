/**
 * Workflows Page — Visual workflow builder + execution viewer.
 */
import { auth } from "@/app/(auth)/auth";

const BUILTIN_WORKFLOWS = [
  {
    name: "morning-pulse",
    description: "Daily system health check and summary",
    category: "Operations",
    steps: 5,
  },
  {
    name: "billing-sweep",
    description: "Process billing queue and retry soft declines",
    category: "Finance",
    steps: 8,
  },
  {
    name: "slack-digest",
    description: "Aggregate Slack messages into digest",
    category: "Communication",
    steps: 3,
  },
];

export default async function WorkflowsPage() {
  const session = await auth();
  if (!session?.user) {
    return (
      <div className="p-8 text-muted-foreground">
        Sign in to access workflows.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-4">
        <h1 className="text-lg font-semibold">Workflows</h1>
        <p className="text-sm text-muted-foreground">
          Visual workflow builder + live execution viewer via SSE.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {BUILTIN_WORKFLOWS.map((wf) => (
            <div
              className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
              key={wf.name}
            >
              <div className="flex-1">
                <p className="font-medium text-sm">{wf.name}</p>
                <p className="text-xs text-muted-foreground">
                  {wf.description}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{wf.steps} steps</span>
                <span className="bg-muted px-1.5 py-0.5 rounded">
                  {wf.category}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="text-sm text-muted-foreground p-8 text-center border rounded-lg bg-card mt-4">
          <p>
            Trigger workflows via the{" "}
            <code className="bg-muted px-1 rounded">runWorkflow</code> tool in
            chat.
          </p>
          <p className="text-xs mt-1">
            API:{" "}
            <code className="bg-muted px-1 rounded">
              POST /api/workflow/run
            </code>
          </p>
        </div>
      </div>
    </div>
  );
}
