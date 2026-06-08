import { MessageCircleIcon } from "lucide-react";
import { checkConnectorEnv } from "../registry";
import type { ConnectorManifest } from "../types";

const ghlManifest: ConnectorManifest = {
  id: "ghl",
  name: "GoHighLevel",
  description: "CRM — contacts, SMS, email, conversations, and pipeline",
  icon: MessageCircleIcon,
  brandColor: "#EC5F3A",
  envKeys: ["GHL_API_KEY", "GHL_LOCATION_ID"],
  capabilities: [
    {
      id: "createContact",
      label: "Create Contact",
      description: "Create or update a contact in GHL",
      icon: "UserPlus",
    },
    {
      id: "sendSms",
      label: "Send SMS",
      description: "Send an SMS message to a contact",
      icon: "MessageSquare",
    },
    {
      id: "sendEmail",
      label: "Send Email",
      description: "Send an email to a contact",
      icon: "Mail",
    },
    {
      id: "queryConversations",
      label: "Query Conversations",
      description: "Search conversations by contact or date",
      icon: "MessagesSquare",
    },
    {
      id: "getOpportunity",
      label: "Get Opportunity",
      description: "Get pipeline opportunity details",
      icon: "Trello",
    },
  ],
  toolModule: () => import("./tools"),
  resultRenderers: {},
  playbookPath: "lib/connectors/ghl/playbook.mdx",
  getStatus: () => {
    const { ok, missing } = checkConnectorEnv([
      "GHL_API_KEY",
      "GHL_LOCATION_ID",
    ]);
    return {
      connected: ok,
      message: ok
        ? "Connected"
        : `Not Configured — missing: ${missing.join(", ")}`,
    };
  },
  docs: { official: "https://developers.gohighlevel.com" },
};
export default ghlManifest;
