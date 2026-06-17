/**
 * Knowledge Page — OKF v0.1 Visualizer (Phase 34 Stream 4)
 * Three views: Library (by type), Playbook (by domain), Graph (D3 force-directed).
 * OKF-compatible with Neptune extensions (mission overlay, memory inline, KG integration).
 */
import { auth } from "@/app/(auth)/auth";
import { OkfVisualizer } from "@/components/knowledge/okf-visualizer";

export const metadata = {
  title: "Knowledge — Neptune OKF Visualizer",
  description: "OKF v0.1 knowledge browser — Library, Playbooks, Knowledge Graph. Neptune reference implementation.",
};

export default async function KnowledgePage() {
  const session = await auth();
  if (!session?.user) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">Sign in to access knowledge.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 border-b px-4 py-3">
        <h1 className="text-base font-semibold">Knowledge</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          OKF v0.1 · Library · Playbooks · Graph · <span className="text-emerald-600 dark:text-emerald-400 font-medium">Neptune Reference Implementation</span>
        </p>
      </div>

      {/* Visualizer (client component) */}
      <div className="flex-1 overflow-hidden">
        <OkfVisualizer />
      </div>
    </div>
  );
}
