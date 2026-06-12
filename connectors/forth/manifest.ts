import { ShieldIcon } from "lucide-react";
import { checkConnectorEnv } from "../../lib/connectors/registry";
import type { ConnectorManifest } from "../../lib/connectors/types";

const forthManifest: ConnectorManifest = {
  id: "forth",
  name: "Forth DPP",
  description: "Debt Protection Program — dispute management and credit repair",
  icon: ShieldIcon,
  brandColor: "#059669",
  envKeys: ["FORTH_API_TOKEN"],
  capabilities: [
    {
      id: "getDisputes",
      label: "Get Disputes",
      description: "Retrieve active disputes for a customer",
      icon: "AlertTriangle",
    },
    {
      id: "updateDispute",
      label: "Update Dispute",
      description: "Update dispute status or add evidence",
      icon: "Edit",
    },
    {
      id: "queryContact",
      label: "Query Contact",
      description: "Look up contact and credit report info",
      icon: "Search",
    },
    {
      id: "pullCreditReport",
      label: "Pull Credit Report",
      description: "Pull triple-bureau credit report",
      icon: "FileText",
    },
    {
      id: "listEnrollments",
      label: "List Enrollments",
      description: "List DPP enrollments by status",
      icon: "List",
    },
  ],
  toolModule: () => import("./tools"),
  resultRenderers: {},
  playbookPath: "connectors/forth/playbook.mdx",
  getStatus: () => {
    const { ok } = checkConnectorEnv(["FORTH_API_TOKEN"]);
    return { connected: ok, message: ok ? "Connected" : "Not Configured" };
  },
};
export default forthManifest;
