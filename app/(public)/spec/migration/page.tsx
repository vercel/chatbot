import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

export const metadata: Metadata = { title: "Migration Guide — OKF ↔ NKS" };

export default function MigrationPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Link href="/spec" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft size={12} /> Back to Spec
        </Link>
        <h1 className="text-3xl font-bold mb-6">Migration Guide: OKF ↔ NKS</h1>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <ArrowRight size={18} className="text-emerald-500" />
            OKF → NKS (Upgrade)
          </h2>
          <ol className="list-decimal pl-5 space-y-3 text-sm">
            <li><strong>Add access field:</strong> Run <code className="px-1.5 py-0.5 rounded bg-muted text-xs">npx tsx scripts/generate-okf-indexes.ts</code> to add access fields and index.md files.</li>
            <li><strong>Add NKS-specific fields:</strong> Add playbook routing, skill definitions, mission tracking as needed.</li>
            <li><strong>Run validator:</strong> <code className="px-1.5 py-0.5 rounded bg-muted text-xs">validateNksFrontmatter(frontmatter)</code> checks compliance.</li>
            <li><strong>Regenerate indexes:</strong> Re-run the index generator to update directory overviews.</li>
          </ol>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <ArrowRight size={18} className="text-amber-500" />
            NKS → OKF (Downgrade/Export)
          </h2>
          <ol className="list-decimal pl-5 space-y-3 text-sm">
            <li><strong>Run export tool:</strong> <code className="px-1.5 py-0.5 rounded bg-muted text-xs">npx tsx scripts/export-okf-bundle.ts --output /tmp/okf-bundle</code></li>
            <li>NKS-extension fields are <strong>automatically stripped</strong> from the export.</li>
            <li>All files remain valid OKF files.</li>
            <li>manifest.yaml uses OKF format (no NKS extensions).</li>
          </ol>

          <h3 className="font-semibold mt-6 mb-2">Field Mapping</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b"><th className="text-left py-2">NKS Field</th><th className="text-left py-2">OKF Export</th></tr>
            </thead>
            <tbody>
              {[
                ["type", "Preserved (new values → concept if unrecognized)"],
                ["access", "Stripped"],
                ["priority", "Stripped"],
                ["model_routing", "Stripped"],
                ["scope_connectors", "Stripped"],
                ["self_code", "Stripped"],
                ["ui_components", "Stripped"],
              ].map(([nks, okf]) => (
                <tr key={nks} className="border-b last:border-0">
                  <td className="py-1.5 font-mono text-xs">{nks}</td>
                  <td className="py-1.5 text-xs text-muted-foreground">{okf}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Reserved Fields (Do NOT Repurpose)</h2>
          <div className="p-4 rounded-lg border bg-card">
            <code className="text-xs">
              type, name, description, version, updated, tags, domain, author, status, links,<br />
              access, priority, scope, scope_connectors, triggers, trigger_tools, headline,<br />
              auto_load, mcp, custom_client, total_actions, model_routing, intent_tags,<br />
              state, artifacts, progress, events, memory_id, memory_type, persistence,<br />
              template_for, generates, required_inputs, scripts, ui_components, ui_schema,<br />
              schedule, steps, depends_on, condition, notify_on_completion, self_code,<br />
              self_code_limits, self_code_pattern, audit_date, audit_scope, findings, compliance,<br />
              associated_skills, associated_connectors, associated_domains, workflows
            </code>
          </div>
        </section>
      </div>
    </div>
  );
}
