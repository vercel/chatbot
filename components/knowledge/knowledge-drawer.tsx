"use client";

/**
 * Knowledge Drawer — Phase 36 Stream 1
 * Slide-out panel showing active skills, playbook context, mission state, memory references.
 * Toggle: Cmd+Shift+K
 */
import { useState, useEffect, useCallback } from "react";
import {
  X, Cpu, BookOpen, Activity, Brain, ExternalLink, Clock,
  ChevronRight, Layers, MemoryStickIcon as Memory, Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ActiveSkill {
  name: string;
  path: string;
  domain: string;
  lastUsed: string;
}

interface KnowledgeContext {
  activeSkills: ActiveSkill[];
  activePlaybook: string | null;
  activePlaybookDomain: string | null;
  missionState: { name: string; state: string; progress: number } | null;
  memoryRefs: { id: string; label: string; type: string }[];
}

// Mock data — in production this would come from chat session context
const MOCK_CONTEXT: KnowledgeContext = {
  activeSkills: [
    { name: "Billing Playbook", path: "playbooks/billing/playbook-billing.md", domain: "billing-flow", lastUsed: "2m ago" },
    { name: "NMI Connector", path: "connectors/nmi/SKILL.md", domain: "billing-flow", lastUsed: "5m ago" },
    { name: "COF Health Audit", path: "skills/functions/cof-health-audit/SKILL.md", domain: "compliance-audit", lastUsed: "10m ago" },
  ],
  activePlaybook: "Billing Operations",
  activePlaybookDomain: "billing-flow",
  missionState: { name: "Phase 36: Knowledge UI", state: "executing", progress: 37 },
  memoryRefs: [
    { id: "6a1f118b", label: "NMI Sacred Vault", type: "reference" },
    { id: "jarvis-rules", label: "Jarvis Operating Rules", type: "rule" },
  ],
};

export function KnowledgeDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [context] = useState<KnowledgeContext>(MOCK_CONTEXT);

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "K") {
        e.preventDefault();
        if (isOpen) onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-80 lg:w-96 border-l bg-background shadow-xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Layers size={14} className="text-primary" />
            Knowledge Context
          </h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">Active skills · Playbook · Memory</p>
        </div>
        <button
          onClick={onClose}
          className="size-7 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
          aria-label="Close knowledge drawer"
        >
          <X size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Active Skills */}
        <Section title="Active Skills" icon={Cpu}>
          {context.activeSkills.map(skill => (
            <div key={skill.path} className="flex items-start gap-2.5 p-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer group">
              <Cpu size={14} className="text-amber-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{skill.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{skill.path}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground">{skill.domain}</span>
                  <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                    <Clock size={9} /> {skill.lastUsed}
                  </span>
                </div>
              </div>
              <ExternalLink size={12} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </div>
          ))}
        </Section>

        {/* Active Playbook */}
        <Section title="Active Playbook" icon={BookOpen}>
          <div className="flex items-start gap-2.5 p-2 rounded-md bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/50">
            <BookOpen size={14} className="text-emerald-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">{context.activePlaybook}</p>
              <p className="text-[10px] text-muted-foreground">Domain: {context.activePlaybookDomain}</p>
            </div>
          </div>
        </Section>

        {/* Mission State */}
        {context.missionState && (
          <Section title="Active Mission" icon={Activity}>
            <div className="p-2.5 rounded-md bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/50 dark:border-rose-800/50">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium">{context.missionState.name}</p>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 font-medium">
                  {context.missionState.state}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-rose-500 transition-all"
                    style={{ width: `${context.missionState.progress}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{context.missionState.progress}%</span>
              </div>
            </div>
          </Section>
        )}

        {/* Memory References */}
        <Section title="Memory References" icon={Memory}>
          {context.memoryRefs.map(mem => (
            <div key={mem.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors text-xs">
              <Memory size={13} className="text-pink-500 shrink-0" />
              <span className="flex-1 truncate">{mem.label}</span>
              <code className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground font-mono">{mem.id}</code>
            </div>
          ))}
        </Section>

        {/* Open in /knowledge */}
        <a
          href="/knowledge"
          className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <ExternalLink size={12} />
          Open in Knowledge Explorer
        </a>

        {/* Shortcut hint */}
        <p className="text-center text-[9px] text-muted-foreground">
          Press <kbd className="px-1 py-0.5 rounded bg-muted text-[8px] font-mono">⌘</kbd>+<kbd className="px-1 py-0.5 rounded bg-muted text-[8px] font-mono">⇧</kbd>+<kbd className="px-1 py-0.5 rounded bg-muted text-[8px] font-mono">K</kbd> to toggle
        </p>
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <Icon size={11} />
        {title}
      </h4>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

/**
 * Hook to use in chat layouts for Cmd+Shift+K toggling.
 */
export function useKnowledgeDrawer() {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = useCallback(() => setIsOpen(v => !v), []);
  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "K") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggle]);

  return { isOpen, toggle, close };
}
