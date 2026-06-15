export { spawnCodingAgent } from "@/lib/ai/tools/spawn-coding-agent";
export { planSession } from "@/lib/ai/tools/plan-session";
export { processDataTool } from "./processData";
export { runScriptTool } from "./runScript";
export { runWorkflowTool } from "./runWorkflow";
export { scrapeURLTool } from "./scrapeURL";
export { spawnPersistentSessionTool } from "./spawnPersistentSession";

import { spawnCodingAgent } from "@/lib/ai/tools/spawn-coding-agent";
import { planSession } from "@/lib/ai/tools/plan-session";
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
  planSession,
};

export type SandboxToolName = keyof typeof sandboxTools;
