/**
 * Hyperswitch Connector Manifest
 */
import { ZapIcon } from "lucide-react";
import { checkConnectorEnv } from "../registry";
import type { ConnectorManifest } from "../types";

const hyperswitchManifest: ConnectorManifest = {
  id: "hyperswitch",
  name: "Hyperswitch",
  description:
    "Self-hosted payment orchestration — NMI connector, payment links, webhooks",
  icon: ZapIcon,
  brandColor: "#006FEE",
  envKeys: ["VPS_TOOLS_BRIDGE_URL"],
  capabilities: [
    {
      id: "createPaymentLink",
      label: "Create Payment Link",
      description: "Generate a branded payment link for a customer",
      icon: "Link",
    },
    {
      id: "listPayments",
      label: "List Payments",
      description: "List recent payments with status and connector info",
      icon: "List",
    },
    {
      id: "refundPayment",
      label: "Refund Payment",
      description: "Refund a Hyperswitch payment by payment_id",
      icon: "Undo",
    },
  ],
  toolModule: () => import("./tools"),
  resultRenderers: {},
  playbookPath: "lib/connectors/hyperswitch/playbook.mdx",
  docs: {
    official: "https://hyperswitch.io/docs",
    ourGuide: "jarvis/prd/neptune-chat-connectors-and-tool-ui-master-v1.md",
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

export default hyperswitchManifest;
