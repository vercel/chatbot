import { PhoneIcon } from "lucide-react";
import { checkConnectorEnv } from "../../lib/connectors/registry";
import type { ConnectorManifest } from "../../lib/connectors/types";

const vapiManifest: ConnectorManifest = {
  id: "vapi",
  name: "VAPI",
  description: "Voice AI — call logs, transcripts, and agent analytics",
  icon: PhoneIcon,
  brandColor: "#F97316",
  envKeys: ["VAPI_PRIVATE_KEY"],
  capabilities: [
    {
      id: "getCallLogs",
      label: "Get Call Logs",
      description: "Retrieve recent VAPI call logs",
      icon: "PhoneCall",
    },
    {
      id: "getTranscript",
      label: "Get Transcript",
      description: "Get transcript for a specific call",
      icon: "FileText",
    },
  ],
  toolModule: () => Promise.resolve({}),
  resultRenderers: {},
  playbookPath: "connectors/vapi/playbook.mdx",
  getStatus: () => {
    const { ok } = checkConnectorEnv(["VAPI_PRIVATE_KEY"]);
    return { connected: ok, message: ok ? "Connected" : "Not Configured" };
  },
};
export default vapiManifest;
