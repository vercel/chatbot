/**
 * Coding Agent Run Artifact — Server Component
 * Renders v2 coding agent handoff with FileTree, Terminal, CodeBlock, WebPreview, Commit, TestResults, Task, Confirmation.
 */
import { CodingAgentRunClient } from "./client";

interface CodingAgentRunServerProps {
  sandboxId: string;
  sessionId: string;
  streamUrl: string;
  status: string;
  task?: string;
}

export async function CodingAgentRunServer({
  sandboxId,
  sessionId,
  streamUrl,
  status,
  task,
}: CodingAgentRunServerProps) {
  return (
    <div className="coding-agent-artifact border rounded-lg overflow-hidden bg-gray-950">
      <div className="flex items-center justify-between px-4 py-2 bg-indigo-900/50 border-b border-indigo-800">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          <span className="text-sm font-mono text-indigo-200">
            v2 Coding Agent
          </span>
          <span className="text-xs text-indigo-400">{status}</span>
        </div>
        <span className="text-xs text-indigo-600 font-mono">
          {sessionId?.slice(0, 12)}
        </span>
      </div>
      <CodingAgentRunClient
        sandboxId={sandboxId}
        sessionId={sessionId}
        status={status}
        streamUrl={streamUrl}
        task={task}
      />
    </div>
  );
}
