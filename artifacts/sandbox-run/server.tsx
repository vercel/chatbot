/**
 * Sandbox Run Artifact — Server Component
 * Renders Terminal + FileTree + CodeBlock with live SSE status badges.
 *
 * Mission ref: mega-unified-sprint Phase 3, item 6
 * AI Elements: Terminal, FileTree, CodeBlock, Live status badges
 */
import { SandboxRunClient } from './client';

export interface SandboxFile {
  name: string;
  content: string;
  language: string;
}

interface SandboxRunServerProps {
  runId: string;
  toolName: string;
  runtime: string;
  userId: string;
  streamUrl: string;
  /** Files created in the sandbox (for FileTree + CodeBlock display) */
  files?: SandboxFile[];
  /** Initial status badge color */
  statusColor?: 'green' | 'yellow' | 'red' | 'gray';
}

export { SandboxRunClient };

export async function SandboxRunServer({
  runId,
  toolName,
  runtime,
  userId,
  streamUrl,
  files = [],
  statusColor = 'green',
}: SandboxRunServerProps) {
  const statusColorMap = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
    gray: 'bg-gray-500',
  };

  return (
    <div className="sandbox-run-artifact border rounded-lg overflow-hidden bg-gray-950">
      {/* Header bar with live status badge */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              statusColor === 'green'
                ? 'bg-green-950 text-green-400 ring-1 ring-green-800'
                : statusColor === 'yellow'
                  ? 'bg-yellow-950 text-yellow-400 ring-1 ring-yellow-800'
                  : statusColor === 'red'
                    ? 'bg-red-950 text-red-400 ring-1 ring-red-800'
                    : 'bg-gray-800 text-gray-400 ring-1 ring-gray-700'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusColorMap[statusColor]} ${
              statusColor === 'green' ? 'animate-pulse' : ''
            }`} />
            Sandbox
          </span>
          <span className="text-sm font-mono text-gray-300">{toolName}</span>
          <span className="text-xs text-gray-500 bg-gray-800 rounded px-1.5 py-0.5 font-mono">
            {runtime}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-600 font-mono uppercase tracking-wider">
            Run {runId.slice(0, 8)}
          </span>
        </div>
      </div>

      <SandboxRunClient
        runId={runId}
        toolName={toolName}
        streamUrl={streamUrl}
        userId={userId}
        files={files}
      />
    </div>
  );
}
