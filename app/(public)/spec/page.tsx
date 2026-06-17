/**
 * /spec — Neptune-Knowledge-Spec v1.0 Public Page
 * Phase 35 Stream 2 — Documentation site
 */
import { Metadata } from "next";
import Link from "next/link";
import { FileText, CheckCircle, ArrowRight, BookOpen, Code, Layers, Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "Neptune-Knowledge-Spec v1.0",
  description: "Production-grade superset of OKF v0.1. Built 6 months ahead of Google's spec.",
};

export default function SpecPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="border-b">
        <div className="max-w-4xl mx-auto px-6 py-16 md:py-24">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium mb-4">
            v1.0 · June 17, 2026
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Neptune-Knowledge-Spec
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl">
            Production-grade superset of OKF v0.1. Built 6 months before Google&#39;s spec.
            10 innovations for production AI agent systems.
          </p>
          <div className="flex gap-3 mt-8">
            <Link
              href="/spec/compatibility"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              OKF Compatibility <ArrowRight size={14} />
            </Link>
            <Link
              href="https://github.com/abhiswami2121/neptune-chat/blob/main/docs/NEPTUNE-KNOWLEDGE-SPEC-v1.0.md"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted transition-colors"
            >
              Full Spec <FileText size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b bg-muted/30">
        <div className="max-w-4xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { value: "500+", label: "Knowledge Files" },
            { value: "187", label: "Indexed Directories" },
            { value: "258", label: "Typed Frontmatter" },
            { value: "14", label: "Artifact Types" },
          ].map(stat => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold mb-2">10 Innovations Beyond OKF v0.1</h2>
        <p className="text-muted-foreground mb-8">What NKS adds to make AI agents production-ready.</p>

        <div className="grid md:grid-cols-2 gap-4">
          {[
            { num: 1, title: "Playbook Routing", desc: "Domain playbooks route agent intents to the right skills and connectors with model preferences." },
            { num: 2, title: "Agent Skill Definitions", desc: "Executable skills with tool manifests, MCP configs, anti-patterns, and co-located code." },
            { num: 3, title: "Mission State Machines", desc: "Long-running AI tasks tracked with FSM states, artifacts, progress, and event timelines." },
            { num: 4, title: "Cross-Session Memory", desc: "Persistent memory references agents access across conversations. Reference, rule, preference, fact, context." },
            { num: 5, title: "Connector Specifications", desc: "Auto-generate API clients, Zod schemas, and tool manifests from knowledge files." },
            { num: 6, title: "Generative UI Components", desc: "React components bound to connectors — channel grids, payment lists, transaction tables." },
            { num: 7, title: "Workflow Orchestration", desc: "Multi-step automation with cron scheduling, conditional steps, and dependency graphs." },
            { num: 8, title: "Self-Coding Capability", desc: "AI modifies its own codebase with guardrails: max 3 files, 50 lines, build + smoke test required." },
            { num: 9, title: "Audit Trails", desc: "Structured compliance records with severity-classified findings and multi-standard status." },
            { num: 10, title: "Knowledge Graph", desc: "Every file is a node, every link is an edge. D3 force-directed visualization." },
          ].map(f => (
            <div key={f.num} className="flex gap-3 p-4 rounded-lg border bg-card">
              <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                {f.num}
              </div>
              <div>
                <h3 className="font-medium text-sm">{f.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Navigation */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <h2 className="text-2xl font-bold mb-4">Documentation</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { href: "/spec/compatibility", icon: CheckCircle, title: "OKF Compatibility", desc: "Full compatibility matrix" },
            { href: "/spec/extensions", icon: Layers, title: "Extensions", desc: "10 innovations beyond OKF" },
            { href: "/spec/examples", icon: BookOpen, title: "Examples", desc: "5 sample NKS bundles" },
            { href: "/spec/tooling", icon: Code, title: "Tooling", desc: "Validators, exporters, visualizers" },
            { href: "/spec/migration", icon: ArrowRight, title: "Migration", desc: "OKF ↔ NKS guide" },
            { href: "https://github.com/abhiswami2121/neptune-chat", icon: Shield, title: "GitHub", desc: "Reference implementation" },
          ].map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-start gap-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
            >
              <link.icon size={18} className="mt-0.5 text-muted-foreground" />
              <div>
                <h3 className="text-sm font-medium">{link.title}</h3>
                <p className="text-xs text-muted-foreground">{link.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        <p>Neptune-Knowledge-Spec v1.0 · MIT License</p>
        <p className="mt-1">Built 6 months ahead of Google OKF v0.1 · Augmenting, not competing</p>
      </footer>
    </div>
  );
}
