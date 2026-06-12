/**
 * NMI Connector Manifest
 */
import { CreditCardIcon } from "lucide-react";
import { checkConnectorEnv } from "../../lib/connectors/registry";
import type { ConnectorManifest } from "../../lib/connectors/types";

const nmiManifest: ConnectorManifest = {
  id: "nmi",
  name: "NMI Payments",
  description:
    "Card vault, recurring billing, and transaction queries via Hyperswitch",
  icon: CreditCardIcon,
  brandColor: "#003B5C",
  envKeys: ["VPS_TOOLS_BRIDGE_URL", "BASE44_API_KEY"],
  capabilities: [
    {
      id: "queryTransactions",
      label: "Query Transactions",
      description: "Query NMI transactions by date range and status",
      icon: "Search",
    },
    {
      id: "getVault",
      label: "Get Vault",
      description: "Retrieve customer vault details by vault ID",
      icon: "Shield",
    },
    {
      id: "getSubscription",
      label: "Get Subscription",
      description: "Retrieve subscription details and payment history",
      icon: "Repeat",
    },
    {
      id: "refund",
      label: "Refund",
      description: "Process a refund for a settled transaction",
      icon: "Undo",
    },
  ],
  toolModule: () => import("./tools"),
  resultRenderers: {},
  playbookPath: "connectors/nmi/playbook.mdx",
  docs: {
    official:
      "https://secure.networkmerchants.com/gw/merchants/resources/integration/integration_portal.php",
    ourGuide: "jarvis/prd/nmi-golden-vault-architecture.md",
  },
  getStatus: () => {
    const { ok, missing } = checkConnectorEnv(["VPS_TOOLS_BRIDGE_URL"]);
    return {
      connected: ok,
      message: ok
        ? "Connected via VPS bridge"
        : `Missing: ${missing.join(", ")}`,
    };
  },
};

export default nmiManifest;
