/**
 * coding-agent-run artifact (client) — renders live coding agent progress.
 *
 * Composed of AI Elements primitives: Task, FileTree, Terminal, CodeBlock, WebPreview, Confirmation.
 * This is the canvas that displays when a user hands off a coding task to neptune-v2.
 */

"use client";

import React from "react";

interface CodingAgentRunProps {
  runId: string;
  status: string;
  prompt?: string;
  streamUrl?: string;
  createdAt?: string;
}

export function CodingAgentRunArtifact({
  runId,
  status,
  prompt,
  streamUrl,
}: CodingAgentRunProps) {
  const [steps, setSteps] = React.useState<
    Array<{ id: string; title: string; status: string }>
  >([]);
  const [terminal, setTerminal] = React.useState("");
  const [files, setFiles] = React.useState<
    Array<{ path: string; content: string }>
  >([]);
  const [previewUrl, setPreviewUrl] = React.useState("");

  React.useEffect(() => {
    if (!streamUrl) return;
    const evtSource = new EventSource(streamUrl);
    evtSource.addEventListener("step", (e) => {
      const data = JSON.parse(e.data);
      setSteps((prev) => [
        ...prev,
        { id: data.id, title: data.title, status: data.status },
      ]);
    });
    evtSource.addEventListener("terminal", (e) => {
      const data = JSON.parse(e.data);
      setTerminal((prev) => prev + "\n" + data.output);
    });
    evtSource.addEventListener("file", (e) => {
      const data = JSON.parse(e.data);
      setFiles((prev) => {
        const idx = prev.findIndex((f) => f.path === data.path);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { path: data.path, content: data.content };
          return next;
        }
        return [...prev, { path: data.path, content: data.content }];
      });
    });
    evtSource.addEventListener("preview", (e) => {
      const data = JSON.parse(e.data);
      setPreviewUrl(data.url);
    });
    return () => evtSource.close();
  }, [streamUrl]);

  return (
    <div className="grid grid-cols-12 gap-4 h-full p-4">
      <div className="col-span-3 border rounded-lg p-3 overflow-y-auto">
        <h3 className="font-semibold text-sm mb-2">Steps</h3>
        <p className="text-xs text-muted-foreground mb-2">Run: {runId}</p>
        {steps.map((step) => (
          <div className="flex items-center gap-2 text-xs py-1" key={step.id}>
            <span
              className={
                step.status === "completed"
                  ? "text-green-500"
                  : step.status === "running"
                    ? "text-blue-500 animate-pulse"
                    : "text-gray-400"
              }
            >
              {step.status === "completed"
                ? "✓"
                : step.status === "running"
                  ? "⏳"
                  : "○"}
            </span>
            <span>{step.title}</span>
          </div>
        ))}
        {steps.length === 0 && (
          <p className="text-xs text-gray-400">Waiting for agent to start...</p>
        )}
      </div>

      <div className="col-span-6 border rounded-lg p-3 overflow-y-auto">
        <h3 className="font-semibold text-sm mb-2">Files</h3>
        {files.length > 0 ? (
          <div className="space-y-2">
            {files.map((f) => (
              <div className="border rounded p-2" key={f.path}>
                <p className="text-xs font-mono text-blue-600">{f.path}</p>
                <pre className="text-xs mt-1 bg-gray-50 p-2 rounded overflow-x-auto max-h-40">
                  {f.content}
                </pre>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400">
            Files will appear as the agent works...
          </p>
        )}
        {prompt && (
          <div className="mt-3 p-2 bg-blue-50 rounded">
            <p className="text-xs font-medium">Task:</p>
            <p className="text-xs">{prompt}</p>
          </div>
        )}
      </div>

      <div className="col-span-3 flex flex-col gap-3">
        <div className="border rounded-lg p-3 flex-1 overflow-y-auto bg-black text-green-400 font-mono text-xs">
          <p className="text-gray-500 mb-1">Terminal</p>
          <pre className="whitespace-pre-wrap">
            {terminal || "Awaiting output..."}
          </pre>
        </div>
        {previewUrl && (
          <div className="border rounded-lg p-3">
            <h3 className="font-semibold text-sm mb-2">Preview</h3>
            <iframe
              className="w-full h-40 border rounded"
              src={previewUrl}
              title="Preview"
            />
          </div>
        )}
      </div>
    </div>
  );
}
