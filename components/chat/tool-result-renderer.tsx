// @ts-nocheck
"use client";
/**
 * ToolResultRenderer — routes tool output to domain-specific renderers.
 * Falls back to generic JSON viewer for unknown tools.
 */
import type { ReactNode } from "react";
import { CodeBlock } from "@/components/ai-elements/code-block";
import { initConnectors } from "@/lib/connectors/init";
import { getConnector } from "@/lib/connectors/registry";
import { CardRouter } from "@/components/generative/card-router";

interface ToolPart {
  type: string;
  state: string;
  toolName?: string;
  output?: unknown;
  errorText?: string;
}

interface ToolResultRendererProps {
  part: ToolPart;
  children?: ReactNode;
}

export function ToolResultRenderer({ part }: ToolResultRendererProps) {
  // Initialize connectors on first render
  initConnectors();

  const toolName = part.toolName ?? "";
  const output = part.output;
  const errorText = part.errorText;

  if (!output && !errorText) return null;

  // Try to match connector-specific renderer based on tool name format: "connectorId.capability"
  const dotIndex = toolName.indexOf(".");
  if (dotIndex > 0) {
    const connectorId = toolName.slice(0, dotIndex);
    const capability = toolName.slice(dotIndex + 1);
    const connector = getConnector(connectorId);
    const Renderer = connector?.manifest.resultRenderers[capability];

    if (Renderer) {
      return <Renderer output={output} />;
    }
  }

  // Phase 24: Route connector card outputs through UniversalConnectorCard
  if (typeof output === "object" && output !== null) {
    const cardOutput = output as Record<string, unknown>;
    if (cardOutput.connector && cardOutput.type && cardOutput.data) {
      const card = (
        <CardRouter
          toolName={toolName}
          output={cardOutput as { connector: string; type: string; data: Record<string, unknown> }}
        />
      );
      if (card) return card;
    }
  }

  // Generic fallback: JSON viewer
  if (errorText) {
    return (
      <div className="overflow-x-auto rounded-md bg-destructive/10 text-destructive text-xs p-3">
        <p className="font-medium mb-1">Error</p>
        <p>{errorText}</p>
      </div>
    );
  }

  if (typeof output === "object") {
    return (
      <div className="overflow-x-auto rounded-md bg-muted/50">
        <CodeBlock code={JSON.stringify(output, null, 2)} language="json" />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md bg-muted/50">
      <CodeBlock code={String(output)} language="json" />
    </div>
  );
}
