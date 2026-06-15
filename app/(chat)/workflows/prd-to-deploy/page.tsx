/**
 * /workflows/prd-to-deploy — Phase 19.G
 *
 * 8-Step PRD-to-Deploy Pipeline Page:
 *   1. Chat → Plan        (user opens planSession in chat)
 *   2. PRD Draft → Review (clarifying questions → refine → approve)
 *   3. Spec Generation    (file map, AC list, skills selected)
 *   4. V2 Dispatch        (single or multi-session)
 *   5. Live Progress      (SSE stream monitoring)
 *   6. Validation         (build, lint, test, smoke deploy)
 *   7. PR Review          (GitHub PR review)
 *   8. Merge → Production (deploy to Vercel)
 *
 * Each stage has a card with status indicator. Demo data shows past flows.
 */
import { CheckCircle2, Circle, Loader2, ArrowRight, ArrowDown, ExternalLink, Bot, FileCode, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────

interface PipelineStage {
  step: number;
  label: string;
  description: string;
  icon: React.ReactNode;
  status: "done" | "active" | "pending";
  detail?: string;
  link?: string;
}

interface DemoFlow {
  id: string;
  title: string;
  date: string;
  stages: PipelineStage[];
  repo?: string;
  prUrl?: string;
  deployUrl?: string;
}

// ── Demo Data ─────────────────────────────────────────────────────────────

const DEMO_FLOWS: DemoFlow[] = [
  {
    id: "demo-1",
    title: "Add Skills Browse Page to Neptune Chat",
    date: "2026-06-15",
    repo: "abhiswami2121/neptune-chat",
    prUrl: "https://github.com/abhiswami2121/neptune-chat/pull/42",
    deployUrl: "https://neptune-chat-ashy.vercel.app/skills",
    stages: [
      { step: 1, label: "Chat → Plan", description: "planSession drafted plan with 3 phases, 9 ACs", icon: <Bot size={16} />, status: "done", detail: "Plan ID: 8f3a..." },
      { step: 2, label: "PRD Draft → Review", description: "3 clarifying questions answered, plan refined", icon: <FileCode size={16} />, status: "done", detail: "5 files affected" },
      { step: 3, label: "Spec Generation", description: "File map, ACs, 6 skills loaded (design + repo)", icon: <FileCode size={16} />, status: "done", detail: "6 skills: design, coding, repo, testing, arch, ui" },
      { step: 4, label: "V2 Dispatch", description: "spawnCodingAgent v2 with planId + 6 skills", icon: <Rocket size={16} />, status: "done", detail: "Session: handoff-1718..." },
      { step: 5, label: "Live Progress", description: "SSE stream monitoring — 12 tool calls, 5 files edited", icon: <Loader2 size={16} />, status: "done", detail: "Duration: 4m 23s" },
      { step: 6, label: "Validation", description: "Build + lint passed, 0 TS errors", icon: <CheckCircle2 size={16} />, status: "done", detail: "pnpm build: 0 errors, pnpm lint: 0 warnings" },
      { step: 7, label: "PR Review", description: "PR #42 opened — 5 files changed", icon: <ExternalLink size={16} />, status: "done", link: "#" },
      { step: 8, label: "Merge → Production", description: "Merged to main, Vercel deploy triggered", icon: <Rocket size={16} />, status: "done", detail: "Deployed to neptune-chat-ashy.vercel.app" },
    ],
  },
  {
    id: "demo-2",
    title: "Add Connector Wizard to Sidebar",
    date: "2026-06-14",
    repo: "abhiswami2121/neptune-chat",
    stages: [
      { step: 1, label: "Chat → Plan", description: "planSession drafted plan with 4 phases", icon: <Bot size={16} />, status: "done" },
      { step: 2, label: "PRD Draft → Review", description: "Reviewed and approved", icon: <FileCode size={16} />, status: "done" },
      { step: 3, label: "Spec Generation", description: "File map generated", icon: <FileCode size={16} />, status: "done" },
      { step: 4, label: "V2 Dispatch", description: "Dispatched to V2", icon: <Rocket size={16} />, status: "done" },
      { step: 5, label: "Live Progress", description: "V2 completed successfully", icon: <Loader2 size={16} />, status: "done" },
      { step: 6, label: "Validation", description: "All checks passed", icon: <CheckCircle2 size={16} />, status: "done" },
      { step: 7, label: "PR Review", description: "PR merged", icon: <ExternalLink size={16} />, status: "done" },
      { step: 8, label: "Merge → Production", description: "Deployed", icon: <Rocket size={16} />, status: "done" },
    ],
  },
];

// ── Stage Card ────────────────────────────────────────────────────────────

function StageCard({ stage, isLast }: { stage: PipelineStage; isLast: boolean }) {
  return (
    <div className="flex gap-3">
      {/* Status line */}
      <div className="flex flex-col items-center shrink-0">
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center border-2",
          stage.status === "done"
            ? "bg-emerald-500/10 border-emerald-500 text-emerald-400"
            : stage.status === "active"
              ? "bg-primary/10 border-primary text-primary"
              : "bg-zinc-800 border-zinc-700 text-zinc-600"
        )}>
          {stage.status === "done" ? <CheckCircle2 size={14} /> :
           stage.status === "active" ? <Loader2 size={14} className="animate-spin" /> :
           <Circle size={14} />}
        </div>
        {!isLast && (
          <div className={cn(
            "w-0.5 flex-1 min-h-[24px] mt-1",
            stage.status === "done" ? "bg-emerald-500/40" : "bg-zinc-800"
          )} />
        )}
      </div>

      {/* Content */}
      <div className={cn(
        "flex-1 pb-6 rounded-lg p-3 border",
        stage.status === "active"
          ? "bg-primary/5 border-primary/20"
          : "bg-zinc-900/50 border-zinc-800"
      )}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-mono text-muted-foreground bg-zinc-800 rounded px-1.5 py-0.5">
            Step {stage.step}
          </span>
          <span className={cn(
            "text-sm font-medium",
            stage.status === "pending" ? "text-muted-foreground" : "text-foreground"
          )}>
            {stage.label}
          </span>
          {stage.icon}
        </div>
        <p className="text-xs text-muted-foreground">{stage.description}</p>
        {stage.detail && (
          <p className="text-[10px] text-muted-foreground mt-1">{stage.detail}</p>
        )}
        {stage.link && (
          <a href={stage.link} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline mt-1">
            <ExternalLink size={10} /> View
          </a>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function PRDToDeployPage() {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="shrink-0 px-6 py-6 border-b border-zinc-800">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
          PRD → Deploy
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          8-step pipeline: plan in Chat, dispatch to V2, validate, and deploy — all automated.
        </p>
      </div>

      {/* Pipeline visualization */}
      <div className="shrink-0 px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-0 flex-wrap justify-center">
          {[
            "Chat → Plan",
            "PRD Review",
            "Spec Generation",
            "V2 Dispatch",
            "Live Progress",
            "Validation",
            "PR Review",
            "Merge → Deploy",
          ].map((label, i) => (
            <div key={i} className="flex items-center">
              <div className={cn(
                "px-3 py-1.5 rounded-full text-[11px] font-medium border",
                "bg-zinc-800/50 border-zinc-700 text-zinc-300"
              )}>
                <span className="text-[10px] text-muted-foreground mr-1">{i + 1}.</span>
                {label}
              </div>
              {i < 7 && <ArrowRight size={12} className="text-zinc-600 mx-1 shrink-0" />}
            </div>
          ))}
        </div>
      </div>

      {/* Main content: demo flows */}
      <div className="flex-1 px-6 py-6 space-y-8">
        {/* How it works */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-5">
          <h2 className="text-base font-semibold text-zinc-100 mb-3">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Bot size={14} className="text-primary" />
                <span className="text-sm font-medium">1. Plan in Chat</span>
              </div>
              <p className="text-xs text-zinc-400">
                Say &ldquo;plan X&rdquo; in any chat. The <code className="text-[11px] bg-zinc-800 rounded px-1">planSession</code> tool
                loads relevant skills, asks clarifying questions, and saves a plan with phases + ACs.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Rocket size={14} className="text-emerald-400" />
                <span className="text-sm font-medium">2. Dispatch to V2</span>
              </div>
              <p className="text-xs text-zinc-400">
                Approve the plan and say &ldquo;execute&rdquo;. <code className="text-[11px] bg-zinc-800 rounded px-1">spawnCodingAgent</code> v2
                loads the plan + skills into V2&apos;s system prompt and spawns coding sessions.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-amber-400" />
                <span className="text-sm font-medium">3. Validate &amp; Deploy</span>
              </div>
              <p className="text-xs text-zinc-400">
                V2 runs build, lint, and tests. Opens a PR with all changes.
                Merge to main triggers automatic Vercel deploy.
              </p>
            </div>
          </div>
        </div>

        {/* Demo flows */}
        <div>
          <h2 className="text-base font-semibold text-zinc-100 mb-4">Past PRD-to-Deploy Flows</h2>
          <div className="space-y-6">
            {DEMO_FLOWS.map((flow) => (
              <div key={flow.id} className="rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden">
                {/* Flow header */}
                <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-zinc-100">{flow.title}</h3>
                    <div className="flex items-center gap-3 text-[10px] text-zinc-500 mt-0.5">
                      <span>{flow.date}</span>
                      {flow.repo && <span>{flow.repo}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {flow.prUrl && (
                      <a href={flow.prUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2 py-1 text-[10px] rounded border border-zinc-700 hover:bg-zinc-800 transition-colors">
                        <ExternalLink size={10} /> PR
                      </a>
                    )}
                    {flow.deployUrl && (
                      <a href={flow.deployUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2 py-1 text-[10px] rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                        <Rocket size={10} /> Deploy
                      </a>
                    )}
                  </div>
                </div>

                {/* Flow stages */}
                <div className="px-5 py-4">
                  {flow.stages.map((stage, i) => (
                    <StageCard key={i} stage={stage} isLast={i === flow.stages.length - 1} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-5 text-center">
          <h2 className="text-sm font-semibold text-zinc-100 mb-1">Ready to try it?</h2>
          <p className="text-xs text-zinc-400 mb-3">
            Start a chat and type &ldquo;plan a new feature&rdquo; to trigger the PRD-to-deploy pipeline.
          </p>
          <a href="/chats"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            <Bot size={14} /> Start a Chat
          </a>
        </div>
      </div>
    </div>
  );
}
