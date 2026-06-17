/**
 * lib/discovery/index.ts
 * Phase 38 Discovery Workflows Engine — Barrel Export
 */

// Types
export * from "./types";

// Core modules
export { scrapeSlackChannels, classifyMessageType, detectActionVerbs, getUniqueCustomersFromScrape } from "./slack-scraper";
export { extractCustomerMentions, normalizePhone, matchCustomer, batchMatchCustomers, levenshtein, fuzzyNameMatch } from "./customer-matcher";

// Caching
export { getCached, setCache, clearCache, getCacheStats } from "./caching";

// Multi-source puller
export {
  pullCustomerData,
  pullBase44Customers,
  pullNmiCustomers,
  pullCustomerComms,
  pullCustomerTickets,
} from "./multi-source-puller";

// Cross-reference
export {
  buildCustomerContext,
  crossReference,
  inferRequestedAction,
  extractProfilesFromPulled,
} from "./cross-reference";
export type { CrossReferenceResult } from "./cross-reference";

// Dependency graph
export { buildDependencyGraph, summarizeGraph } from "./dependency-graph";
export type { GraphSummary } from "./dependency-graph";

// Alignment validators
export {
  validateBillingAlignment,
  validateEnrollmentAlignment,
  validateAgentPromiseAlignment,
  validateDocumentationAlignment,
  validateAll,
  summarizeValidations,
} from "./alignment-validators";

// Workflow orchestrator
export {
  createRun,
  getRun,
  getAllRuns,
  executeWorkflow,
  resumeRun,
  serializeSseEvent,
  sseEventStream,
} from "./workflow-orchestrator";
export type { SseCallback, RunResult } from "./workflow-orchestrator";

// Report generator
export {
  generateReport,
  generateMarkdownReport,
  generateCsvReport,
  generateJsonReport,
  generatePdfReport,
  quickReport,
} from "./report-generator";
export type { GenerateReportInput, GeneratedReports } from "./report-generator";

// Action dispatcher
export {
  createAction,
  createActionsFromFindings,
  getAction,
  getActionsForRun,
  getPendingActions,
  approveAction,
  rejectAction,
  approveAll,
  rejectAll,
  dispatchAction,
  dispatchAll,
  validateAction,
  getActionStats,
  summarizeActions,
} from "./action-dispatcher";
export type { CreateActionInput, DispatchResult, BatchDispatchResult, ActionStats } from "./action-dispatcher";

// Knowledge graph bridge
export {
  toD3Format,
  toRichD3Format,
  mergeGraphs,
  queryGraph,
  toGraphvizDOT,
  toMermaid,
  analyzeCustomerGraphs,
  prepareForPersistence,
  deserializeFromPersistence,
  filterByTimeRange,
} from "./knowledge-graph-bridge";
export type {
  D3Node,
  D3Edge,
  D3GraphData,
  GraphQuery,
  CustomerGraphSummary,
  PersistedGraph,
} from "./knowledge-graph-bridge";
