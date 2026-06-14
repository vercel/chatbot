"use client";

/**
 * components/canvas/primitives/schema-display.tsx — SchemaDisplay primitive.
 *
 * Phase 16.F: Visual JSON schema renderer with type pills, descriptions,
 * and nested field expansion. For function input/output signatures.
 *
 * Compound pattern: context + cn() from existing AI Elements.
 */

import { useState } from "react";
import { ChevronDown, ChevronRight, Braces } from "lucide-react";
import { cn } from "@/lib/utils";

interface SchemaField {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
  default?: unknown;
  children?: SchemaField[];
  enum?: string[];
}

interface SchemaDisplayProps {
  schema: {
    title?: string;
    description?: string;
    fields?: SchemaField[];
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
  };
  variant?: "input" | "output" | "both";
  className?: string;
}

export function SchemaDisplay({
  schema,
  variant = "both",
  className,
}: SchemaDisplayProps) {
  const inputFields = extractFields(schema.input);
  const outputFields = extractFields(schema.output);

  return (
    <div className={cn("space-y-4", className)}>
      {schema.title && (
        <h4 className="text-sm font-semibold">{schema.title}</h4>
      )}
      {schema.description && (
        <p className="text-xs text-muted-foreground/60">{schema.description}</p>
      )}

      {/* Input schema */}
      {(variant === "input" || variant === "both") && inputFields.length > 0 && (
        <div>
          <h5 className="text-[11px] font-medium text-muted-foreground/40 uppercase tracking-wider mb-2">
            Input
          </h5>
          <FieldList fields={inputFields} />
        </div>
      )}

      {/* Output schema */}
      {(variant === "output" || variant === "both") && outputFields.length > 0 && (
        <div>
          <h5 className="text-[11px] font-medium text-muted-foreground/40 uppercase tracking-wider mb-2">
            Output
          </h5>
          <FieldList fields={outputFields} />
        </div>
      )}

      {/* If no structured fields, render raw JSON */}
      {inputFields.length === 0 && outputFields.length === 0 && (
        <pre className="text-xs font-mono whitespace-pre-wrap bg-muted/10 rounded-lg p-3 text-muted-foreground/70">
          {JSON.stringify(schema, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ── Field List ────────────────────────────────────────────────────────────────

function FieldList({ fields, depth = 0 }: { fields: SchemaField[]; depth?: number }) {
  return (
    <div className={cn("rounded-lg border border-border/30 overflow-hidden", depth > 0 && "border-0")}>
      {fields.map((field, i) => (
        <SchemaFieldRow key={field.name + i} field={field} depth={depth} isLast={i === fields.length - 1} />
      ))}
    </div>
  );
}

function SchemaFieldRow({
  field,
  depth,
  isLast,
}: {
  field: SchemaField;
  depth: number;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = field.children && field.children.length > 0;

  return (
    <div
      className={cn(
        "border-border/20",
        !isLast && "border-b",
        depth > 0 && "border-l-2 ml-2",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2",
          hasChildren && "cursor-pointer hover:bg-muted/10",
        )}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {/* Expand toggle */}
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground/40 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground/40 flex-shrink-0" />
          )
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}

        {/* Field name */}
        <span
          className={cn(
            "text-xs font-mono",
            field.required ? "text-foreground/80 font-medium" : "text-muted-foreground/60",
          )}
        >
          {field.name}
          {field.required && (
            <span className="text-destructive/60 ml-0.5">*</span>
          )}
        </span>

        {/* Type pill */}
        <TypePill type={field.type} />

        {/* Description */}
        {field.description && (
          <span className="text-[11px] text-muted-foreground/40 truncate hidden sm:inline">
            {field.description}
          </span>
        )}

        <div className="flex-1" />

        {/* Default value */}
        {field.default !== undefined && (
          <span className="text-[10px] font-mono text-muted-foreground/30">
            = {String(field.default)}
          </span>
        )}
      </div>

      {/* Enum values */}
      {field.enum && field.enum.length > 0 && (
        <div className="flex flex-wrap gap-1 px-9 pb-2">
          {field.enum.map((val) => (
            <span
              key={val}
              className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-muted/20 text-muted-foreground/50"
            >
              "{val}"
            </span>
          ))}
        </div>
      )}

      {/* Nested children */}
      {hasChildren && expanded && (
        <div className="pl-4">
          <FieldList fields={field.children!} depth={depth + 1} />
        </div>
      )}
    </div>
  );
}

// ── Type Pill ─────────────────────────────────────────────────────────────────

function TypePill({ type }: { type: string }) {
  const colors: Record<string, string> = {
    string: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    number: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    boolean: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    object: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    array: "bg-pink-500/10 text-pink-500 border-pink-500/20",
    null: "bg-muted-foreground/10 text-muted-foreground/50 border-muted-foreground/10",
    any: "bg-muted-foreground/10 text-muted-foreground/40 border-muted-foreground/10",
  };

  return (
    <span
      className={cn(
        "text-[10px] px-1.5 py-0.5 rounded font-mono border",
        colors[type] || colors.any,
      )}
    >
      {type}
    </span>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractFields(obj: Record<string, unknown> | undefined): SchemaField[] {
  if (!obj) return [];
  if (Array.isArray(obj)) {
    return obj.map((item, i) => ({
      name: String(i),
      type: typeof item,
      description: String(item),
    }));
  }
  return Object.entries(obj).map(([key, val]) => ({
    name: key,
    type: Array.isArray(val) ? "array" : typeof val,
    description:
      typeof val === "string" ? val : undefined,
  }));
}
