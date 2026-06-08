import { BrainCircuitIcon, BookOpenIcon } from "lucide-react";
import Link from "next/link";

export default function WikiPage() {
  return (
    <div className="flex flex-col h-full w-full overflow-x-hidden bg-zinc-950">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
        <BrainCircuitIcon className="size-5 text-cyan-400" />
        <h1 className="text-lg font-semibold text-zinc-100">Wiki</h1>
        <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">Karpathy 3-Layer</span>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <BookOpenIcon className="size-12 text-zinc-700 mb-4" />
        <h2 className="text-lg font-medium text-zinc-300 mb-2">Knowledge Base</h2>
        <p className="text-sm text-zinc-500 max-w-md mb-6">
          The Karpathy-style second brain: ingest sources, query the wiki, lint for contradictions.
          Skills, PRDs, and operational knowledge live here as interlinked pages.
        </p>
        <div className="flex gap-3">
          <Link href="/skills" className="px-4 py-2 text-sm rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors">Skills</Link>
          <Link href="/knowledge" className="px-4 py-2 text-sm rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors">Knowledge</Link>
        </div>
        <p className="text-xs text-zinc-600 mt-6">Full wiki UI with ResizablePanels file tree + content viewer coming in Phase 5.</p>
      </div>
    </div>
  );
}
