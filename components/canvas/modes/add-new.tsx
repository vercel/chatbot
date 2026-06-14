"use client";

/**
 * components/canvas/modes/add-new.tsx — Add New mode.
 *
 * Phase 16.G: Type chooser (Connector/Skill/Function/Playbook/Workflow) +
 * 5 tailored multi-step forms. Connector wizard embedded inline.
 */

import { useState } from "react";
import type { ModeProps, CanvasContext } from "@/lib/canvas/types";
import {
  Plus,
  Plug,
  Sparkles,
  FileCode2,
  BookOpen,
  Workflow,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

type AddType = NonNullable<CanvasContext["addType"]>;

const TYPE_OPTIONS: Array<{
  type: AddType;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}> = [
  {
    type: "connector",
    label: "Connector",
    description: "External service integration (NMI, Slack, GitHub…)",
    icon: <Plug className="h-5 w-5" />,
    color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
  },
  {
    type: "skill",
    label: "Skill",
    description: "Domain capability (billing, support, dispatch…)",
    icon: <Sparkles className="h-5 w-5" />,
    color: "text-purple-500 bg-purple-500/10 border-purple-500/20",
  },
  {
    type: "function",
    label: "Function",
    description: "Single invokable tool (sendSMS, chargeCustomer…)",
    icon: <FileCode2 className="h-5 w-5" />,
    color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  },
  {
    type: "playbook",
    label: "Playbook",
    description: "Orchestrated workflow with triggers + SOPs",
    icon: <BookOpen className="h-5 w-5" />,
    color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  },
  {
    type: "workflow",
    label: "Workflow",
    description: "Visual flow with nodes + edges",
    icon: <Workflow className="h-5 w-5" />,
    color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
  },
];

// ── Main Component ───────────────────────────────────────────────────────────

export function AddNew({ context, onNavigate }: ModeProps) {
  const [selectedType, setSelectedType] = useState<AddType | null>(
    context.addType || null,
  );

  // If a type was pre-selected via context, skip the chooser
  const showChooser = !selectedType;

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      {selectedType ? (
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedType(null)}
            className="p-1.5 rounded-lg hover:bg-muted/30 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h2 className="text-xl font-bold capitalize">
            Add {selectedType}
          </h2>
        </div>
      ) : (
        <div>
          <h2 className="text-xl font-bold">Add New</h2>
          <p className="text-sm text-muted-foreground/60 mt-1">
            Choose what you want to create
          </p>
        </div>
      )}

      {/* ── Step 1: Type Chooser ────────────────────────────────────── */}
      {showChooser && (
        <div className="space-y-2">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.type}
              onClick={() => setSelectedType(opt.type)}
              className={cn(
                "w-full flex items-center gap-3 p-4 rounded-xl",
                "border border-border/30 bg-card/60",
                "hover:bg-card/80 hover:shadow-sm hover:border-border/50",
                "active:scale-[0.99] transition-all duration-150",
                "text-left",
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-lg border",
                  opt.color,
                )}
              >
                {opt.icon}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{opt.label}</p>
                <p className="text-xs text-muted-foreground/50 mt-0.5">
                  {opt.description}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/30" />
            </button>
          ))}
        </div>
      )}

      {/* ── Step 2: Type-specific form ──────────────────────────────── */}
      {selectedType && (
        <AddForm
          type={selectedType}
          onNavigate={onNavigate}
          onBack={() => setSelectedType(null)}
        />
      )}
    </div>
  );
}

// ── Per-Type Forms ───────────────────────────────────────────────────────────

function AddForm({
  type,
  onNavigate,
  onBack,
}: {
  type: AddType;
  onNavigate: ModeProps["onNavigate"];
  onBack: () => void;
}) {
  // Shared form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [step, setStep] = useState(1);

  switch (type) {
    case "connector":
      return <ConnectorForm name={name} setName={setName} onNavigate={onNavigate} />;
    case "skill":
      return <SkillForm name={name} setName={setName} description={description} setDescription={setDescription} />;
    case "function":
      return <FunctionForm name={name} setName={setName} />;
    case "playbook":
      return <PlaybookForm name={name} setName={setName} />;
    case "workflow":
      return <WorkflowForm onNavigate={onNavigate} />;
    default:
      return null;
  }
}

// ── Connector Form (embeds wizard inline) ────────────────────────────────────

function ConnectorForm({
  name,
  setName,
  onNavigate,
}: {
  name: string;
  setName: (v: string) => void;
  onNavigate: ModeProps["onNavigate"];
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground/70">
        The connector wizard will guide you through setup. In Phase 16, this
        opens the existing /admin/connector-wizard flow inline.
      </p>
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground/50 uppercase">
            Connector Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. nmiconnector"
            className={cn(
              "w-full mt-1 h-9 px-3 rounded-lg text-sm",
              "bg-muted/10 border border-border/30",
              "focus:outline-none focus:ring-1 focus:ring-primary/20",
            )}
          />
        </div>
        <button
          onClick={() => {
            // Open connector wizard in new window for now
            window.open("/admin/connector-wizard", "_blank");
          }}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2 rounded-lg",
            "text-sm font-medium",
            "bg-[#0A84FF] text-white hover:bg-[#0070E0]",
            "transition-colors",
          )}
        >
          <Plug className="h-4 w-4" />
          Open Connector Wizard
        </button>
        <p className="text-xs text-muted-foreground/40">
          Full embedded wizard coming in Phase 16 polish cycle.
        </p>
      </div>
    </div>
  );
}

// ── Skill Form ───────────────────────────────────────────────────────────────

function SkillForm({
  name,
  setName,
  description,
  setDescription,
}: {
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground/50 uppercase">
          Skill Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. billing-and-payments"
          className={cn(
            "w-full mt-1 h-9 px-3 rounded-lg text-sm",
            "bg-muted/10 border border-border/30",
            "focus:outline-none focus:ring-1 focus:ring-primary/20",
          )}
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground/50 uppercase">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this skill do?"
          rows={3}
          className={cn(
            "w-full mt-1 p-3 rounded-lg text-sm resize-none",
            "bg-muted/10 border border-border/30",
            "focus:outline-none focus:ring-1 focus:ring-primary/20",
          )}
        />
      </div>
      <button
        className={cn(
          "inline-flex items-center gap-2 px-4 py-2 rounded-lg",
          "text-sm font-medium",
          "bg-[#0A84FF] text-white hover:bg-[#0070E0]",
          "transition-colors",
        )}
      >
        <Plus className="h-4 w-4" />
        Create Skill
      </button>
    </div>
  );
}

// ── Function Form ────────────────────────────────────────────────────────────

function FunctionForm({
  name,
  setName,
}: {
  name: string;
  setName: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground/50 uppercase">
          Function Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. sendSMS"
          className={cn(
            "w-full mt-1 h-9 px-3 rounded-lg text-sm font-mono",
            "bg-muted/10 border border-border/30",
            "focus:outline-none focus:ring-1 focus:ring-primary/20",
          )}
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground/50 uppercase">
          TypeScript Signature
        </label>
        <textarea
          placeholder="async function sendSMS(params: SendSMSParams): Promise<SendSMSResult>"
          rows={3}
          className={cn(
            "w-full mt-1 p-3 rounded-lg text-xs font-mono resize-none",
            "bg-muted/10 border border-border/30",
            "focus:outline-none focus:ring-1 focus:ring-primary/20",
          )}
        />
      </div>
      <button
        className={cn(
          "inline-flex items-center gap-2 px-4 py-2 rounded-lg",
          "text-sm font-medium",
          "bg-[#0A84FF] text-white hover:bg-[#0070E0]",
          "transition-colors",
        )}
      >
        <Plus className="h-4 w-4" />
        Create Function
      </button>
    </div>
  );
}

// ── Playbook Form ────────────────────────────────────────────────────────────

function PlaybookForm({
  name,
  setName,
}: {
  name: string;
  setName: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground/50 uppercase">
          Playbook Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. billing-flow"
          className={cn(
            "w-full mt-1 h-9 px-3 rounded-lg text-sm",
            "bg-muted/10 border border-border/30",
            "focus:outline-none focus:ring-1 focus:ring-primary/20",
          )}
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground/50 uppercase">
          Triggers (comma-separated)
        </label>
        <input
          type="text"
          placeholder="e.g. charge_failed, subscription_expired"
          className={cn(
            "w-full mt-1 h-9 px-3 rounded-lg text-sm",
            "bg-muted/10 border border-border/30",
            "focus:outline-none focus:ring-1 focus:ring-primary/20",
          )}
        />
      </div>
      <button
        className={cn(
          "inline-flex items-center gap-2 px-4 py-2 rounded-lg",
          "text-sm font-medium",
          "bg-[#0A84FF] text-white hover:bg-[#0070E0]",
          "transition-colors",
        )}
      >
        <Plus className="h-4 w-4" />
        Create Playbook
      </button>
    </div>
  );
}

// ── Workflow Form ────────────────────────────────────────────────────────────

function WorkflowForm({
  onNavigate,
}: {
  onNavigate: ModeProps["onNavigate"];
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground/70">
        Create a visual workflow using the drag-drop canvas editor.
      </p>
      <button
        onClick={() => onNavigate("workflow-canvas", { workflowName: "new-workflow" })}
        className={cn(
          "inline-flex items-center gap-2 px-4 py-2 rounded-lg",
          "text-sm font-medium",
          "bg-[#0A84FF] text-white hover:bg-[#0070E0]",
          "transition-colors",
        )}
      >
        <Workflow className="h-4 w-4" />
        Open Workflow Editor
      </button>
    </div>
  );
}
