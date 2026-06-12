/**
 * Slack Connector Manifest
 */
import { MessageSquareIcon } from "lucide-react";
import { checkConnectorEnv } from "../../lib/connectors/registry";
import type { ConnectorManifest } from "../../lib/connectors/types";

const slackManifest: ConnectorManifest = {
  id: "slack",
  name: "Slack",
  description: "Channel messaging, history search, and notifications",
  icon: MessageSquareIcon,
  brandColor: "#4A154B",
  envKeys: [
    "SLACK_BOT_TOKEN",
    "NEWLEAF_ADMIN_CHANNEL_ID",
    "JARVIS_ADMIN_CHANNEL_ID",
  ],
  capabilities: [
    {
      id: "pullMessages",
      label: "Pull Messages",
      description:
        "Pull recent messages from a Slack channel with name→ID resolution",
      icon: "MessageSquare",
    },
    {
      id: "postMessage",
      label: "Post Message",
      description: "Post a message to a Slack channel",
      icon: "Send",
    },
    {
      id: "searchChannels",
      label: "Search Channels",
      description: "Search Slack channels by name or topic",
      icon: "Search",
    },
    {
      id: "listChannels",
      label: "List Channels",
      description: "List all accessible Slack channels",
      icon: "List",
    },
    {
      id: "reactionAdd",
      label: "Add Reaction",
      description: "Add an emoji reaction to a message",
      icon: "Smile",
    },
  ],
  toolModule: () => import("./tools"),
  resultRenderers: {},
  playbookPath: "connectors/slack/playbook.mdx",
  docs: {
    official: "https://api.slack.com/docs",
    ourGuide: "jarvis/cortex/skills/slack-delivery.md",
  },
  getStatus: () => {
    const { ok, missing } = checkConnectorEnv(["SLACK_BOT_TOKEN"]);
    return {
      connected: ok,
      message: ok ? "Connected" : `Missing: ${missing.join(", ")}`,
    };
  },
};

export default slackManifest;
