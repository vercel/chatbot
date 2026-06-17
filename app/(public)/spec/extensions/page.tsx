import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = { title: "Extensions — NKS v1.0" };

export default function ExtensionsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Link href="/spec" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft size={12} /> Back to Spec
        </Link>
        <h1 className="text-3xl font-bold mb-2">Neptune Extensions — Beyond OKF v0.1</h1>
        <p className="text-muted-foreground mb-8">10 innovations for production AI agent systems. All additive. Nothing breaks OKF compatibility.</p>

        {([
          ["1. Playbook Routing", "Domain playbooks route agent intents to the right skills. Intent keywords, model preferences, trigger tools, and scope connectors. When an agent needs to handle a billing refund, the playbook router dispatches to the billing playbook which loads NMI and Hyperswitch connectors.", ["scope", "scope_connectors", "triggers", "trigger_tools", "model_routing", "intent_tags"]],
          ["2. Agent Skill Definitions", "Executable skills with tool manifests, MCP configs, anti-patterns, patterns, and UI schemas. Each SKILL.md is co-located with its code (client.ts, schema.ts, tools/, result-renderers/). Agents load skills on demand and execute tools.", ["mcp", "custom_client", "total_actions", "associated_skills", "associated_connectors", "associated_domains"]],
          ["3. Mission State Machines", "Long-running AI tasks tracked through an FSM: proposed → active → executing → completed/failed. Each mission has artifacts, progress tracking, and event timelines. Agents can pause and resume missions across sessions.", ["state", "artifacts", "progress", "events"]],
          ["4. Cross-Session Memory", "Persistent references with unique IDs. Five memory types: reference, rule, preference, fact, context. TTL-based expiry. Agents access memory across conversations. Referenced_by tracks which files depend on each memory.", ["memory_id", "memory_type", "persistence", "ttl_days", "referenced_by"]],
          ["5. Connector Specifications", "Formal specs for external system integrations. Auto-generate API clients, Zod schemas, and tool manifests from connector definitions. Includes MCP configuration and RFP-compatible documentation.", ["auto_load", "mcp_config", "custom_client_path", "trigger_tools"]],
          ["6. Generative UI Components", "Connectors bind React components for results display. Channel grids, payment lists, transaction tables. Defined in YAML frontmatter with ui_components and ui_schema. Rendered on demand by the agent UI.", ["ui_components", "ui_schema"]],
          ["7. Workflow Orchestration", "Multi-step automation pipelines. Cron scheduling, conditional execution, dependency graphs. Steps can trigger any connector tool or function. Completion notifications sent to Slack.", ["schedule", "steps", "depends_on", "condition", "notify_on_completion"]],
          ["8. Self-Coding", "Skills that include instructions for the AI agent to modify its own codebase. Guardrails: max 3 files, max 50 lines, build required, smoke test required. Every self-coded change is committed with a Co-Authored-By trailer.", ["self_code", "self_code_limits", "self_code_pattern"]],
          ["9. Audit Trails", "Structured compliance records. Severity-classified findings (critical/high/medium/low). Multi-standard compliance status (GDPR, PCI-DSS, etc.). Audit scope and date tracking.", ["audit_date", "audit_scope", "findings", "compliance"]],
          ["10. Knowledge Graph", "Every file is a graph node. Every link is a graph edge. Six edge types: references, uses, depends-on, triggers, orchestrates, remembers. D3 force-directed visualization. Live API at /api/knowledge/graph.", []],
        ] as [string, string, string[]][]).map(([title, desc, fields]) => (
          <div key={title} className="p-4 rounded-lg border bg-card mb-4">
            <h2 className="font-semibold text-base mb-1">{title}</h2>
            <p className="text-sm text-muted-foreground mb-2">{desc}</p>
            {fields.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {fields.map(f => (
                  <code key={f} className="px-1.5 py-0.5 rounded bg-muted text-[10px]">{f}</code>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
