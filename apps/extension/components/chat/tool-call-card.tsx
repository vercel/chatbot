"use client";

import type { ToolCallMessagePartProps } from "@assistant-ui/react";

const formatValue = (value: unknown): string => {
  if (value === undefined) return "—";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

export function ToolCallCard({
  toolName,
  status,
  args,
  result,
  isError,
}: Pick<
  ToolCallMessagePartProps,
  "toolName" | "status" | "args" | "result" | "isError"
>) {
  return (
    <div
      style={{
        border: "1px solid #334155",
        borderRadius: 8,
        padding: 8,
        background: "#0f172a",
        display: "grid",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <strong style={{ color: "#e2e8f0", fontSize: 13 }}>{toolName}</strong>
        <span style={{ color: "#93c5fd", fontSize: 12 }}>{status.type}</span>
      </div>

      <div>
        <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 4 }}>Args</div>
        <pre
          style={{
            margin: 0,
            background: "#020617",
            color: "#cbd5e1",
            borderRadius: 6,
            padding: 8,
            fontSize: 12,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {formatValue(args)}
        </pre>
      </div>

      {result !== undefined && (
        <div>
          <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 4 }}>
            {isError ? "Error" : "Result"}
          </div>
          <pre
            style={{
              margin: 0,
              background: "#020617",
              color: isError ? "#fca5a5" : "#bbf7d0",
              borderRadius: 6,
              padding: 8,
              fontSize: 12,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {formatValue(result)}
          </pre>
        </div>
      )}
    </div>
  );
}
