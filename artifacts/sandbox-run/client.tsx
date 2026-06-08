/**
 * Sandbox Run Artifact — Client Component
 * Terminal output viewer with SSE streaming + FileTree + CodeBlock tabs.
 *
 * AI Elements used:
 *  - Terminal: green-on-black output with auto-scroll
 *  - FileTree: collapsible file listing for sandbox artifacts
 *  - CodeBlock: syntax-highlighted code view
 *  - Live status badges: connecting/running/completed/error/destroyed
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Terminal,
  XCircle,
  CheckCircle,
  Clock,
  Copy,
  Download,
  FileCode,
  FolderTree,
  Play,
  Square,
} from 'lucide-react';
import type { SandboxFile } from './server';

interface SandboxRunClientProps {
  runId: string;
  toolName: string;
  streamUrl: string;
  userId: string;
  /** Files from the sandbox (for FileTree + CodeBlock display) */
  files?: SandboxFile[];
}

interface StreamEvent {
  type: 'status' | 'stdout' | 'stderr' | 'done' | 'error' | 'destroyed';
  data?: string;
  runId?: string;
  status?: string;
  durationMs?: number;
  stderr?: string;
}

type Tab = 'terminal' | 'files' | 'code';

export function SandboxRunClient({
  runId,
  toolName,
  streamUrl,
  userId: _userId,
  files = [],
}: SandboxRunClientProps) {
  const [output, setOutput] = useState<string[]>([]);
  const [status, setStatus] = useState<string>('connecting');
  const [duration, setDuration] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('terminal');
  const [selectedFile, setSelectedFile] = useState<string | null>(
    files[0]?.name ?? null,
  );
  const terminalRef = useRef<HTMLDivElement>(null);
  const startTime = useRef<number>(Date.now());

  // SSE streaming from sandbox
  useEffect(() => {
    const es = new EventSource(streamUrl);

    es.onmessage = (event) => {
      try {
        const evt: StreamEvent = JSON.parse(event.data);

        switch (evt.type) {
          case 'status':
            setStatus(evt.status || 'running');
            break;
          case 'stdout':
            setOutput((prev) => [...prev, evt.data || '']);
            break;
          case 'stderr':
            setOutput((prev) => [...prev, `\x1b[31m[stderr]\x1b[0m ${evt.data}`]);
            break;
          case 'done':
            setStatus('completed');
            setDuration(evt.durationMs || Date.now() - startTime.current);
            es.close();
            break;
          case 'error':
            setStatus('error');
            setError(evt.stderr || evt.data || 'Unknown error');
            es.close();
            break;
          case 'destroyed':
            setStatus('destroyed');
            es.close();
            break;
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      setStatus('disconnected');
      es.close();
    };

    return () => es.close();
  }, [streamUrl]);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [output]);

  const handleCopy = () => {
    navigator.clipboard.writeText(output.join('\n'));
  };

  const handleDownload = () => {
    const blob = new Blob([output.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sandbox-${runId}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Status icon + badge color
  const statusConfig = {
    connecting: {
      icon: <Clock className="w-3.5 h-3.5 text-yellow-400 animate-spin" />,
      badge: 'bg-yellow-950 text-yellow-400 ring-yellow-800',
      label: 'Connecting',
    },
    running: {
      icon: <Play className="w-3.5 h-3.5 text-green-400 animate-pulse" />,
      badge: 'bg-green-950 text-green-400 ring-green-800',
      label: 'Running',
    },
    completed: {
      icon: <CheckCircle className="w-3.5 h-3.5 text-green-400" />,
      badge: 'bg-green-950 text-green-400 ring-green-800',
      label: 'Done',
    },
    error: {
      icon: <XCircle className="w-3.5 h-3.5 text-red-400" />,
      badge: 'bg-red-950 text-red-400 ring-red-800',
      label: 'Error',
    },
    destroyed: {
      icon: <Square className="w-3.5 h-3.5 text-gray-400" />,
      badge: 'bg-gray-800 text-gray-400 ring-gray-700',
      label: 'Destroyed',
    },
    disconnected: {
      icon: <XCircle className="w-3.5 h-3.5 text-yellow-400" />,
      badge: 'bg-yellow-950 text-yellow-400 ring-yellow-800',
      label: 'Disconnected',
    },
  }[status] ?? {
    icon: <Clock className="w-3.5 h-3.5" />,
    badge: 'bg-gray-800 text-gray-400 ring-gray-700',
    label: status,
  };

  const selectedFileData = files.find((f) => f.name === selectedFile);

  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: string }[] = [
    {
      id: 'terminal',
      label: 'Terminal',
      icon: <Terminal className="w-3.5 h-3.5" />,
      badge: output.length > 0 ? String(output.length) : undefined,
    },
    ...(files.length > 0
      ? [
          {
            id: 'files' as Tab,
            label: 'Files',
            icon: <FolderTree className="w-3.5 h-3.5" />,
            badge: String(files.length),
          },
          {
            id: 'code' as Tab,
            label: 'Code',
            icon: <FileCode className="w-3.5 h-3.5" />,
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col">
      {/* Tab bar */}
      <div className="flex items-center border-b border-gray-800 bg-gray-900/50">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-700'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge && (
              <span className="ml-1 text-[10px] bg-gray-800 text-gray-400 rounded-full px-1.5 py-0 leading-tight">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Terminal */}
      {activeTab === 'terminal' && (
        <div className="flex flex-col">
          <div
            ref={terminalRef}
            className="h-64 overflow-auto bg-black text-green-400 font-mono text-sm p-4"
          >
            {output.length === 0 && status === 'connecting' && (
              <span className="text-gray-600 animate-pulse">
                Connecting to sandbox...
              </span>
            )}
            {output.length === 0 && status === 'running' && (
              <span className="text-gray-500">Waiting for output...</span>
            )}
            {output.map((line, i) => (
              <div key={i} className="whitespace-pre-wrap break-all">
                {line}
              </div>
            ))}
            {error && (
              <div className="text-red-400 mt-2 border-t border-red-900/50 pt-2">
                {error}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Files (FileTree) */}
      {activeTab === 'files' && (
        <div className="h-64 overflow-auto bg-gray-950 p-3">
          <div className="space-y-1">
            {files.map((file) => (
              <button
                key={file.name}
                onClick={() => {
                  setSelectedFile(file.name);
                  setActiveTab('code');
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono transition-colors text-left ${
                  selectedFile === file.name
                    ? 'bg-cyan-950/30 text-cyan-300 ring-1 ring-cyan-800/50'
                    : 'text-gray-400 hover:bg-gray-900 hover:text-gray-200'
                }`}
              >
                <FileCode className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{file.name}</span>
                <span className="ml-auto text-[10px] text-gray-600 uppercase">
                  {file.language}
                </span>
              </button>
            ))}
            {files.length === 0 && (
              <div className="text-gray-600 text-xs p-4 text-center">
                No files recorded for this run. Files appear when the sandbox
                writes artifacts.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Code (CodeBlock) */}
      {activeTab === 'code' && selectedFileData && (
        <div className="h-64 overflow-auto bg-gray-950">
          <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900/50 border-b border-gray-800">
            <span className="text-xs font-mono text-gray-400">
              {selectedFileData.name}
            </span>
            <span className="text-[10px] text-gray-600 uppercase">
              {selectedFileData.language}
            </span>
          </div>
          <pre className="p-4 text-sm font-mono text-gray-200 whitespace-pre-wrap break-all">
            <code>{selectedFileData.content}</code>
          </pre>
        </div>
      )}
      {activeTab === 'code' && !selectedFileData && (
        <div className="h-64 overflow-auto bg-gray-950 flex items-center justify-center">
          <p className="text-gray-600 text-xs">
            {files.length === 0
              ? 'No code files in this sandbox run.'
              : 'Select a file from the Files tab to view its code.'}
          </p>
        </div>
      )}

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-t border-gray-800">
        <div className="flex items-center gap-2 text-xs">
          {/* Live status badge */}
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusConfig.badge}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {statusConfig.label}
          </span>
          {duration > 0 && (
            <span className="text-gray-600">
              · {(duration / 1000).toFixed(1)}s
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded hover:bg-gray-800 text-gray-500 hover:text-gray-200 transition-colors"
            title="Copy output"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleDownload}
            className="p-1.5 rounded hover:bg-gray-800 text-gray-500 hover:text-gray-200 transition-colors"
            title="Download log"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
