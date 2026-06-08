export { spawnCodingAgent } from "@/lib/ai/tools/spawn-coding-agent";
export { processDataTool } from "./processData";
export { runScriptTool } from "./runScript";
export { runWorkflowTool } from "./runWorkflow";
export { scrapeURLTool } from "./scrapeURL";
export { spawnPersistentSessionTool } from "./spawnPersistentSession";

import { spawnCodingAgent } from "@/lib/ai/tools/spawn-coding-agent";
import { processDataTool } from "./processData";
import { runScriptTool } from "./runScript";
import { runWorkflowTool } from "./runWorkflow";
import { scrapeURLTool } from "./scrapeURL";
import { spawnPersistentSessionTool } from "./spawnPersistentSession";

export const sandboxTools = {
  runScript: runScriptTool,
  scrapeURL: scrapeURLTool,
  processData: processDataTool,
  runWorkflow: runWorkflowTool,
  spawnPersistentSession: spawnPersistentSessionTool,
  spawnCodingAgent,
};

export type SandboxToolName = keyof typeof sandboxTools;
