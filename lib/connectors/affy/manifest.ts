import { FileWarningIcon } from "lucide-react";
import { checkConnectorEnv } from "../registry";
import type { ConnectorManifest } from "../types";

const affyManifest: ConnectorManifest = {
  id: "affy",
  name: "Affy Maverick",
  description:
    "Chargeback disputes — affidavits, evidence, and defense automation",
  icon: FileWarningIcon,
  brandColor: "#DC2626",
  envKeys: ["AFFY_API_KEY"],
  capabilities: [
    {
      id: "getChargebacks",
      label: "Get Chargebacks",
      description: "List chargebacks by status or customer",
      icon: "AlertTriangle",
    },
    {
      id: "submitEvidence",
      label: "Submit Evidence",
      description: "Submit defense evidence for a chargeback",
      icon: "Upload",
    },
    {
      id: "generateAffidavit",
      label: "Generate Affidavit",
      description: "Auto-generate chargeback defense affidavit",
      icon: "FileText",
    },
    {
      id: "trackDispute",
      label: "Track Dispute",
      description: "Track chargeback dispute status through resolution",
      icon: "TrendingUp",
    },
  ],
  toolModule: () => import("./tools"),
  resultRenderers: {},
  playbookPath: "lib/connectors/affy/playbook.mdx",
  getStatus: () => {
    const { ok, missing } = checkConnectorEnv(["AFFY_API_KEY"]);
    return {
      connected: ok,
      message: ok
        ? "Connected"
        : `Not Configured — missing: ${missing.join(", ")}`,
    };
  },
  docs: { official: "https://docs.maverickpayments.com" },
};
export default affyManifest;
