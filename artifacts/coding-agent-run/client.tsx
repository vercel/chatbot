/**
 * Coding Agent Run Artifact — Client Component
 * FileTree + Terminal + CodeBlock + WebPreview + Commit + TestResults + Task + Confirmation.
 */
"use client";

import {
  CheckCircle,
  Clock,
  ExternalLink,
  FileCode,
  GitCommit,
  Globe,
  Terminal,
  TestTube,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface CodingAgentRunClientProps {
  sandboxId: string;
  sessionId: string;
  streamUrl: string;
  status: string;
  task?: string;
}

interface FileEntry {
  path: string;
  content?: string;
  size?: number;
}

export function CodingAgentRunClient({
  sandboxId,
  sessionId,
  streamUrl,
  status: initialStatus,
  task,
}: CodingAgentRunClientProps) {
  const [activeTab, setActiveTab] = useState<
    "terminal" | "files" | "preview" | "results"
  >("terminal");
  const [output, setOutput] = useState<string[]>([]);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [runStatus, setRunStatus] = useState(initialStatus);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<string | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!streamUrl) return;

    const es = new EventSource(streamUrl);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case "stdout":
            setOutput((prev) => [...prev, data.data]);
            break;
          case "stderr":
            setOutput((prev) => [...prev, `[err] ${data.data}`]);
            break;
          case "files":
            setFiles(data.files || []);
            break;
          case "preview":
            setPreviewUrl(data.url);
            break;
          case "tests":
            setTestResults(data.results);
            break;
          case "status":
            setRunStatus(data.status);
            break;
          case "commit":
            setOutput((prev) => [
              ...prev,
              `[commit] ${data.message} (${data.sha?.slice(0, 7)})`,
            ]);
            break;
          case "done":
            setRunStatus("completed");
            es.close();
            break;
          case "error":
            setRunStatus("error");
            es.close();
            break;
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => es.close();
    return () => es.close();
  }, [streamUrl]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [output, activeTab]);

  const tabs = [
    { id: "terminal" as const, icon: Terminal, label: "Terminal" },
    { id: "files" as const, icon: FileCode, label: `Files (${files.length})` },
    { id: "preview" as const, icon: Globe, label: "Preview" },
    { id: "results" as const, icon: TestTube, label: "Results" },
  ];

  const statusIcon = {
    running: <Clock className="w-4 h-4 text-yellow-400 animate-spin" />,
    completed: <CheckCircle className="w-4 h-4 text-green-400" />,
    error: <XCircle className="w-4 h-4 text-red-400" />,
    created: <Clock className="w-4 h-4 text-indigo-400" />,
  }[runStatus] || <Clock className="w-4 h-4 text-gray-400" />;

  return (
    <div className="flex flex-col">
      {/* Task description */}
      {task && (
        <div className="px-4 py-2 bg-gray-900 border-b border-gray-800 text-sm text-gray-400">
          <span className="text-gray-500">Task:</span> {task}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex border-b border-gray-800 bg-gray-900">
        {tabs.map(({ id, icon: Icon, label }) => (
          <button
            className={`flex items-center gap-1.5 px-3 py-2 text-xs transition-colors ${
              activeTab === id
                ? "text-indigo-300 border-b-2 border-indigo-500 bg-gray-800/50"
                : "text-gray-500 hover:text-gray-300"
            }`}
            key={id}
            onClick={() => setActiveTab(id)}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="h-80 overflow-auto">
        {/* Terminal */}
        {activeTab === "terminal" && (
          <div
            className="h-full bg-black text-green-400 font-mono text-sm p-4 overflow-auto"
            ref={terminalRef}
          >
            {output.length === 0 && (
              <span className="text-gray-600 animate-pulse">
                Waiting for agent output...
              </span>
            )}
            {output.map((line, i) => (
              <div className="whitespace-pre-wrap break-all" key={i}>
                {line}
              </div>
            ))}
          </div>
        )}

        {/* File Tree */}
        {activeTab === "files" && (
          <div className="h-full bg-gray-950 p-4 overflow-auto">
            {files.length === 0 ? (
              <span className="text-gray-600 text-sm">No files yet...</span>
            ) : (
              <div className="space-y-1 font-mono text-xs">
                {files.map((f) => (
                  <div
                    className="flex items-center gap-2 text-gray-300 hover:bg-gray-800/50 px-1 py-0.5 rounded"
                    key={f.path}
                  >
                    <FileCode className="w-3 h-3 text-gray-500" />
                    <span>{f.path}</span>
                    {f.size && (
                      <span className="text-gray-600 ml-auto">{f.size}B</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Preview */}
        {activeTab === "preview" && (
          <div className="h-full bg-white">
            {previewUrl ? (
              <iframe
                className="w-full h-full border-0"
                src={previewUrl}
                title="Preview"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                <div className="text-center">
                  <Globe className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No preview available yet</p>
                  {runStatus === "completed" && (
                    <a
                      className="text-indigo-400 hover:underline inline-flex items-center gap-1 mt-2"
                      href={`https://${sandboxId}.vercel-sandbox.dev`}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <ExternalLink className="w-3 h-3" /> Open sandbox
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Test Results */}
        {activeTab === "results" && (
          <div className="h-full bg-gray-950 p-4 overflow-auto">
            {testResults ? (
              <pre className="text-sm font-mono text-gray-300 whitespace-pre-wrap">
                {testResults}
              </pre>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                <div className="text-center">
                  <TestTube className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Test results will appear here</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-t border-gray-800 text-xs">
        <div className="flex items-center gap-2">
          {statusIcon}
          <span className="text-gray-400 capitalize">{runStatus}</span>
        </div>
        <div className="flex items-center gap-3 text-gray-600">
          <span className="flex items-center gap-1">
            <GitCommit className="w-3 h-3" /> {sessionId?.slice(0, 8)}
          </span>
          <span>{sandboxId?.slice(0, 12)}</span>
        </div>
      </div>
    </div>
  );
}
