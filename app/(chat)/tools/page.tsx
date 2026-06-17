// @ts-nocheck — pre-existing Phase 24 minor type issues
/**
 * Tools Page — auto-derived from connector registry.
 */
import { auth } from "@/app/(auth)/auth";
import { initConnectors } from "@/lib/connectors/init";
import { listConnectors } from "@/lib/connectors/registry";
import { ToolsClient } from "./client";

export default async function ToolsPage() {
  const session = await auth();
  if (!session?.user) {
    return (
      <div className="p-8 text-muted-foreground">Sign in to view tools.</div>
    );
  }

  initConnectors();
  const connectors = listConnectors();

  // Build categories from connector manifests
  const categories = connectors.map((entry) => ({
    name: entry.manifest.name,
    connectorId: entry.manifest.id,
    brandColor: entry.manifest.brandColor,
    tools: entry.manifest.capabilities.map((cap) => ({
      name: `${entry.manifest.id}.${cap.id}`,
      description: cap.description,
      inputs: cap.schema
        ? JSON.stringify(cap.schema)
        : "input: Record<string, unknown>",
      connectorName: entry.manifest.name,
    })),
  }));

  const totalTools = categories.reduce((sum, c) => sum + c.tools.length, 0);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-4">
        <h1 className="text-lg font-semibold">Tools</h1>
        <p className="text-sm text-muted-foreground">
          {totalTools} tools across {categories.length} connectors
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <ToolsClient categories={categories} />
      </div>
    </div>
  );
}
