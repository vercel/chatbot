/**
 * cat-facts Connector Manifest — U2.5 skill-author generated
 */
import { type ConnectorManifest } from "@/lib/connectors/types";
import { Cat } from "lucide-react";

const manifest: ConnectorManifest = {
  id: "cat-facts",
  name: "Cat Facts",
  description: "Cat Facts API — random feline trivia from catfact.ninja",
  icon: Cat,
  brandColor: "#f59e0b",
  envKeys: ["CAT_FACTS_API_URL"],
  capabilities: [
    {
      id: "get_random_fact",
      label: "Random Cat Fact",
      description: "Fetch a random cat fact from catfact.ninja",
      icon: "Cat",
      displayPriority: "low",
    },
    {
      id: "get_multiple_facts",
      label: "Multiple Cat Facts",
      description: "Fetch multiple cat facts at once",
      icon: "Cat",
      displayPriority: "low",
    },
    {
      id: "list_breeds",
      label: "List Cat Breeds",
      description: "List all cat breeds from catfact.ninja",
      icon: "Cat",
      displayPriority: "low",
    },
  ],
  toolModule: () => import("./client"),
  resultRenderers: {},
  playbookPath: "playbooks/cat-facts",
  getStatus: () => ({
    connected: true,
    message: "Ready — using catfact.ninja",
    lastChecked: new Date().toISOString(),
  }),
};

export default manifest;
