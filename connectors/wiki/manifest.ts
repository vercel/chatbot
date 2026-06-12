import { BrainCircuitIcon } from "lucide-react";
import type { ConnectorManifest } from "../../lib/connectors/types";

const wikiManifest: ConnectorManifest = {
  id: "wiki",
  name: "Wiki",
  description:
    "Karpathy-style second brain — ingest, query, lint, and manage knowledge",
  icon: BrainCircuitIcon,
  brandColor: "#06B6D4",
  envKeys: ["HERMES_KEY"],
  capabilities: [
    {
      id: "ingestSource",
      label: "Ingest Source",
      description:
        "Ingest a URL, file, or Slack thread — agent synthesizes a wiki page, updates index + log",
      icon: "FileInput",
    },
    {
      id: "queryWiki",
      label: "Query Wiki",
      description: "Search the wiki, return relevant pages with citations",
      icon: "Search",
    },
    {
      id: "lintWiki",
      label: "Lint Wiki",
      description:
        "Check for contradictions, stale pages, orphans, and completeness gaps",
      icon: "CheckCircle",
    },
    {
      id: "writeWikiPage",
      label: "Write Page",
      description: "Create or update a wiki page in the knowledge base",
      icon: "FileEdit",
    },
    {
      id: "updateIndex",
      label: "Update Index",
      description: "Rebuild the wiki index catalog from filesystem scan",
      icon: "ListTree",
    },
  ],
  toolModule: () => import("./tools"),
  resultRenderers: {},
  playbookPath: "connectors/wiki/playbook.mdx",
  getStatus: () => {
    const hasKey = !!process.env.HERMES_KEY;
    return {
      connected: hasKey,
      message: hasKey ? "Connected (VPS agent API)" : "Not Configured",
    };
  },
  docs: {
    official: "/wiki",
    ourGuide: "/home/hermes/knowledge-base/wiki/_schema/NEPTUNE-WIKI.md",
  },
};
export default wikiManifest;
