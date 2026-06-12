/**
 * Base44 CRM Connector Manifest
 */
import { DatabaseIcon } from "lucide-react";
import { checkConnectorEnv } from "../../lib/connectors/registry";
import type { ConnectorManifest } from "../../lib/connectors/types";

const base44Manifest: ConnectorManifest = {
  id: "base44",
  name: "Base44 CRM",
  description:
    "Entity queries, customer 360, reporting hub, and function invocation",
  icon: DatabaseIcon,
  brandColor: "#7C3AED",
  envKeys: ["BASE44_API_KEY"],
  capabilities: [
    {
      id: "queryEntity",
      label: "Query Entity",
      description: "Query any Base44 entity with MongoDB-style filter",
      icon: "Search",
      displayPriority: "low",
      autoCollapseAfter: 2,
    },
    {
      id: "createEntity",
      label: "Create Entity",
      description: "Create a new Base44 entity record",
      icon: "Plus",
    },
    {
      id: "updateEntity",
      label: "Update Entity",
      description: "Update an existing Base44 entity by ID",
      icon: "Edit",
    },
    {
      id: "invokeFunction",
      label: "Invoke Function",
      description: "Call any registered Base44 backend function",
      icon: "Zap",
      displayPriority: "low",
      autoCollapseAfter: 2,
    },
    {
      id: "reportingHub",
      label: "Reporting Hub",
      description: "Operational reports: overview, enrollments, billing, etc.",
      icon: "BarChart3",
      displayPriority: "low",
      autoCollapseAfter: 2,
    },
    {
      id: "customer360",
      label: "Customer 360",
      description: "Complete customer dossier across all systems",
      icon: "User",
    },
  ],
  toolModule: () => import("./tools"),
  resultRenderers: {},
  playbookPath: "connectors/base44/playbook.mdx",
  docs: {
    official: "https://base44.app/docs",
    ourGuide: "jarvis/prd/neptune-chat-connectors-and-tool-ui-master-v1.md",
  },
  getStatus: () => {
    const { ok, missing } = checkConnectorEnv(["BASE44_API_KEY"]);
    return {
      connected: ok,
      message: ok ? "Connected" : `Missing: ${missing.join(", ")}`,
    };
  },
};

export default base44Manifest;
