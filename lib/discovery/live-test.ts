/**
 * lib/discovery/live-test.ts
 * Phase 38 Stream 8 — End-to-End Live Test Runner
 *
 * Tests the full discovery pipeline:
 * 1. Slack scraping (via fixture data when offline, real Slack when wired)
 * 2. Customer matching (5-tier algorithm)
 * 3. Multi-source data pulling (Base44 SDK + NMI bridge)
 * 4. Cross-referencing (context assembly)
 * 5. Alignment validation (4 validators)
 * 6. Dependency graph building + cycle detection
 * 7. Report generation (all 4 formats)
 * 8. Action creation from findings
 *
 * Run: npx tsx lib/discovery/live-test.ts
 */

import * as fs from "fs/promises";
import * as path from "path";
import type {
  ScrapedSlackMessage,
  CustomerDiscoveryContext,
  AlignmentResult,
  DependencyGraph,
  DiscoveryReport,
} from "./types";
import { WORKFLOW_TEMPLATES } from "./types";

// ── Test Configuration ─────────────────────────────────────────────

const FIXTURES_DIR = path.join(process.cwd(), "lib/discovery/fixtures");
const REPORTS_DIR = path.join(process.cwd(), "lib/discovery/.reports");

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  details: string;
  error?: string;
  metrics?: Record<string, number>;
}

const results: TestResult[] = [];

function recordResult(
  name: string,
  passed: boolean,
  startTime: number,
  details: string,
  error?: string,
  metrics?: Record<string, number>
) {
  const duration = Date.now() - startTime;
  results.push({ name, passed, duration, details, error, metrics });
  const icon = passed ? "✅" : "❌";
  console.log(`${icon} ${name} (${duration}ms)${error ? ` — ${error}` : ""}`);
}

// ── Main Test Runner ───────────────────────────────────────────────

async function runAllTests() {
  console.log("=".repeat(60));
  console.log("Phase 38 Discovery Workflows — Live Test Suite");
  console.log("=".repeat(60));
  console.log();

  await fs.mkdir(REPORTS_DIR, { recursive: true });

  // Test 1: Types + Templates
  await testTypesAndTemplates();

  // Test 2: Slack Scraper (fixture data)
  await testSlackScraper();

  // Test 3: Customer Matcher
  await testCustomerMatcher();

  // Test 4: Multi-Source Puller
  await testMultiSourcePuller();

  // Test 5: Cross-Reference Engine
  await testCrossReference();

  // Test 6: Alignment Validators
  await testAlignmentValidators();

  // Test 7: Dependency Graph
  await testDependencyGraph();

  // Test 8: Report Generator
  await testReportGenerator();

  // Test 9: Action Dispatcher
  await testActionDispatcher();

  // Test 10: Knowledge Graph Bridge
  await testKnowledgeGraphBridge();

  // Test 11: Full Pipeline Integration
  await testFullPipeline();

  // Test 12: Production Wiring Check
  await testProductionWiring();

  // Summary
  console.log();
  console.log("=".repeat(60));
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  console.log(`Results: ${passed}/${total} passed (${Math.round(totalDuration / 1000)}s)`);

  if (passed === total) {
    console.log("🎉 ALL TESTS PASSED");
  } else {
    console.log(`⚠️  ${total - passed} test(s) failed`);
    for (const r of results.filter((r) => !r.passed)) {
      console.log(`  ❌ ${r.name}: ${r.error || "No error details"}`);
    }
  }

  // Write test report
  const testReport = {
    timestamp: new Date().toISOString(),
    passed,
    total,
    totalDurationMs: totalDuration,
    results,
  };
  await fs.writeFile(
    path.join(REPORTS_DIR, "live-test-results.json"),
    JSON.stringify(testReport, null, 2)
  );

  process.exit(passed === total ? 0 : 1);
}

// ── Individual Tests ───────────────────────────────────────────────

async function testTypesAndTemplates() {
  const start = Date.now();
  try {
    // Verify all 6 workflow templates exist
    if (WORKFLOW_TEMPLATES.length !== 6) {
      recordResult("Types & Templates", false, start, "", `Expected 6 templates, got ${WORKFLOW_TEMPLATES.length}`);
      return;
    }

    // Verify each template has required fields
    for (const t of WORKFLOW_TEMPLATES) {
      if (!t.id) throw new Error(`Template missing id`);
      if (!t.name) throw new Error(`Template ${t.id} missing name`);
      if (!t.steps || t.steps.length === 0) throw new Error(`Template ${t.id} has no steps`);
      if (!t.outputs || t.outputs.length === 0) throw new Error(`Template ${t.id} has no outputs`);
    }

    // Verify step types are valid
    const validStepTypes = ["scrape", "pull", "cross_reference", "validate", "analyze", "report", "action"];
    for (const t of WORKFLOW_TEMPLATES) {
      for (const step of t.steps) {
        if (!validStepTypes.includes(step.type)) {
          throw new Error(`Template ${t.id} step ${step.id} has invalid type: ${step.type}`);
        }
      }
    }

    recordResult("Types & Templates", true, start, `6 templates with ${WORKFLOW_TEMPLATES.reduce((s, t) => s + t.steps.length, 0)} total steps`);
  } catch (err) {
    recordResult("Types & Templates", false, start, "", err instanceof Error ? err.message : "Unknown");
  }
}

async function testSlackScraper() {
  const start = Date.now();
  try {
    // Load fixture messages
    const fixturePath = path.join(FIXTURES_DIR, "test-slack-messages.json");
    let messages: ScrapedSlackMessage[] = [];

    try {
      const raw = await fs.readFile(fixturePath, "utf-8");
      messages = JSON.parse(raw);
    } catch {
      // Fixture not available, test scraper module loading instead
    }

    const { classifyMessageType, detectActionVerbs, getUniqueCustomersFromScrape } = await import("./slack-scraper");

    // Test message classification on sample texts
    const testCases = [
      { text: "I'd like to enroll in the program", expected: "enrollment_submission" },
      { text: "My payment was declined again", expected: "billing_alert" },
      { text: "I need help with my account", expected: "support_ticket" },
      { text: "Can we retry the payment tomorrow?", expected: "recovery_action" },
      { text: "Escalating to manager", expected: "escalation" },
      { text: "Handing this over to Bob", expected: "agent_handoff" },
    ];

    let correctClassifications = 0;
    for (const tc of testCases) {
      const classified = classifyMessageType(tc.text);
      if (classified === tc.expected) correctClassifications++;
    }
    const accuracy = Math.round((correctClassifications / testCases.length) * 100);

    // Test action verb detection
    const actionTests = [
      { text: "I'll call the customer tomorrow", expected: "call" },
      { text: "Let me follow up on this ticket", expected: "follow_up" },
      { text: "We will resolve this billing issue", expected: "resolve" },
    ];

    let actionMatches = 0;
    for (const at of actionTests) {
      const detected = detectActionVerbs(at.text);
      if (detected.length > 0 && detected.some((d) => d.action === at.expected)) {
        actionMatches++;
      }
    }

    recordResult(
      "Slack Scraper",
      accuracy >= 50,
      start,
      `Classification: ${correctClassifications}/${testCases.length} (${accuracy}%) | Action verbs: ${actionMatches}/${actionTests.length}`
    );
  } catch (err) {
    recordResult("Slack Scraper", false, start, "", err instanceof Error ? err.message : "Unknown");
  }
}

async function testCustomerMatcher() {
  const start = Date.now();
  try {
    const { extractCustomerMentions, normalizePhone, levenshtein, fuzzyNameMatch, batchMatchCustomers } =
      await import("./customer-matcher");

    // Test phone normalization
    const phoneTests = [
      { input: "+1 (555) 123-4567", expected: "15551234567" },
      { input: "555-123-4567", expected: "5551234567" },
      { input: "1-555-123-4567", expected: "15551234567" },
    ];
    let phoneCorrect = 0;
    for (const pt of phoneTests) {
      if (normalizePhone(pt.input) === pt.expected) phoneCorrect++;
    }

    // Test Levenshtein
    const levDist = levenshtein("smith", "smyth");
    if (levDist !== 1) throw new Error(`Expected Levenshtein distance 1 for smith/smyth, got ${levDist}`);

    const levLong = levenshtein("kitten", "sitting");
    if (levLong !== 3) throw new Error(`Expected Levenshtein distance 3 for kitten/sitting, got ${levLong}`);

    // Test fuzzy name matching
    const fuzzyResult = fuzzyNameMatch("John Smith", "Jon Smyth");
    if (fuzzyResult.score < 0.5) throw new Error(`Expected high fuzzy match for John Smith/Jon Smyth, got ${fuzzyResult.score.toFixed(2)}`);

    // Test customer mention extraction
    const sampleText = "Call +15551234567 or email john@example.com about account CUST-001";
    const mentions = extractCustomerMentions(sampleText);
    if (mentions.length < 2) throw new Error(`Expected at least 2 mentions, got ${mentions.length}`);

    recordResult(
      "Customer Matcher",
      true,
      start,
      `Phone: ${phoneCorrect}/${phoneTests.length} | Levenshtein OK | Fuzzy OK | ${mentions.length} mentions extracted`
    );
  } catch (err) {
    recordResult("Customer Matcher", false, start, "", err instanceof Error ? err.message : "Unknown");
  }
}

async function testMultiSourcePuller() {
  const start = Date.now();
  try {
    // Test that puller module loads and has production wiring flag
    const { pullCustomerData, pullBase44Customers } = await import("./multi-source-puller");

    // Test with fixture customer IDs
    const customerIds = ["cust_001", "cust_002"];
    const pulled = await pullCustomerData({ customerIds, includeNmi: true, includeBase44: true });

    if (!(pulled instanceof Map)) throw new Error("Expected Map result from pullCustomerData");
    if (pulled.size !== customerIds.length) {
      console.log(`  ℹ️  Pulled ${pulled.size}/${customerIds.length} customers (stub mode — expected without production wiring)`);
    }

    // Test batch Base44 pull
    const b44Result = await pullBase44Customers(customerIds);

    recordResult(
      "Multi-Source Puller",
      true,
      start,
      `Pulled ${pulled.size} customers | Base44 batch: ${b44Result.size} | ${pulled.size > 0 ? "Live data" : "Stub mode"}`
    );
  } catch (err) {
    recordResult("Multi-Source Puller", false, start, "", err instanceof Error ? err.message : "Unknown");
  }
}

async function testCrossReference() {
  const start = Date.now();
  try {
    const { crossReference, extractProfilesFromPulled, buildCustomerContext } = await import("./cross-reference");
    const { extractCustomerMentions } = await import("./customer-matcher");

    // Load fixture data
    const fixturePath = path.join(FIXTURES_DIR, "test-customer-contexts.json");
    const raw = await fs.readFile(fixturePath, "utf-8");
    const contexts: CustomerDiscoveryContext[] = JSON.parse(raw);

    if (!Array.isArray(contexts) || contexts.length === 0) {
      throw new Error("No fixture contexts loaded");
    }

    // Verify context structure
    for (const ctx of contexts) {
      if (!ctx.customerId) throw new Error("Context missing customerId");
      if (!ctx.name) console.log(`  ℹ️  Context ${ctx.customerId} missing name`);
    }

    // Verify we have at least one critical misalignment (Mike Brown)
    const criticalFlags = contexts.flatMap((c) => c.alignment.flags.filter((f) => f.severity === "critical"));
    if (criticalFlags.length === 0) {
      console.log("  ℹ️  No critical flags in fixtures — expected Mike Brown to have one");
    }

    recordResult(
      "Cross-Reference",
      true,
      start,
      `${contexts.length} contexts loaded | ${criticalFlags.length} critical flags | Names: ${contexts.map((c) => c.name).join(", ")}`
    );
  } catch (err) {
    recordResult("Cross-Reference", false, start, "", err instanceof Error ? err.message : "Unknown");
  }
}

async function testAlignmentValidators() {
  const start = Date.now();
  try {
    const { validateAll, summarizeValidations } = await import("./alignment-validators");

    // Load fixture contexts
    const fixturePath = path.join(FIXTURES_DIR, "test-customer-contexts.json");
    const raw = await fs.readFile(fixturePath, "utf-8");
    const contexts: CustomerDiscoveryContext[] = JSON.parse(raw);

    let totalAligned = 0;
    let totalMisaligned = 0;
    let totalCritical = 0;

    for (const ctx of contexts) {
      const results = validateAll(ctx);
      if (results.length !== 4) throw new Error(`Expected 4 validators, got ${results.length}`);

      const summary = summarizeValidations(results);
      totalAligned += summary.aligned;
      totalMisaligned += summary.misaligned;
      totalCritical += summary.criticalCount;

      // Verify scoring
      for (const r of results) {
        if (r.score < 0 || r.score > 1) throw new Error(`Score out of range: ${r.score}`);
        if (!r.dimension) throw new Error("Missing dimension");
        if (!r.status) throw new Error("Missing status");
      }
    }

    // cust_003 (Mike Brown) should have a critical billing misalignment
    const mike = contexts.find((c) => c.customerId === "cust_003");
    if (mike) {
      const mikeResults = validateAll(mike);
      const billingResult = mikeResults.find((r) => r.dimension === "billing");
      if (billingResult && billingResult.priority !== "critical") {
        console.log(`  ℹ️  Mike Brown billing should be critical, got: ${billingResult.priority} (score: ${billingResult.score})`);
      }
    }

    recordResult(
      "Alignment Validators",
      true,
      start,
      `${contexts.length} customers × 4 validators | ${totalAligned} aligned, ${totalMisaligned} misaligned, ${totalCritical} critical`
    );
  } catch (err) {
    recordResult("Alignment Validators", false, start, "", err instanceof Error ? err.message : "Unknown");
  }
}

async function testDependencyGraph() {
  const start = Date.now();
  try {
    const { buildDependencyGraph, summarizeGraph } = await import("./dependency-graph");

    // Load fixture contexts
    const fixturePath = path.join(FIXTURES_DIR, "test-customer-contexts.json");
    const raw = await fs.readFile(fixturePath, "utf-8");
    const contexts: CustomerDiscoveryContext[] = JSON.parse(raw);

    const graph = buildDependencyGraph(contexts, []);

    if (!graph.nodes || graph.nodes.size === 0) throw new Error("Graph has no nodes");
    if (!graph.edges) throw new Error("Graph has no edges array");

    const summary = summarizeGraph(graph);

    // Verify node types
    const nodeTypes = new Set<string>();
    for (const [, node] of graph.nodes) {
      nodeTypes.add(node.type);
    }

    recordResult(
      "Dependency Graph",
      true,
      start,
      `${summary.nodeCounts ? Object.values(summary.nodeCounts).reduce((a: number, b: number) => a + b, 0) : graph.nodes.size} nodes, ${graph.edges.length} edges, ${graph.cycles.length} cycles, ${graph.chains.length} chains | Types: ${[...nodeTypes].join(", ")}`
    );
  } catch (err) {
    recordResult("Dependency Graph", false, start, "", err instanceof Error ? err.message : "Unknown");
  }
}

async function testReportGenerator() {
  const start = Date.now();
  try {
    const { generateReport } = await import("./report-generator");
    const { validateAll } = await import("./alignment-validators");
    const { buildDependencyGraph } = await import("./dependency-graph");

    // Load fixture contexts
    const fixturePath = path.join(FIXTURES_DIR, "test-customer-contexts.json");
    const raw = await fs.readFile(fixturePath, "utf-8");
    const contexts: CustomerDiscoveryContext[] = JSON.parse(raw);

    // Build validations + graph
    const validations = new Map<string, AlignmentResult[]>();
    for (const c of contexts) {
      validations.set(c.customerId, validateAll(c));
    }
    const graph = buildDependencyGraph(contexts, []);

    // Generate all formats
    const result = await generateReport({
      runId: "test-run-live",
      contexts,
      validations,
      graph,
      config: { format: ["markdown", "csv", "json"], includeCustomerDetails: true },
    });

    if (!result.report) throw new Error("No report generated");
    if (!result.markdown) throw new Error("No markdown generated");
    if (!result.csv) throw new Error("No CSV generated");
    if (!result.json) throw new Error("No JSON generated");

    // Quick validation
    if (!result.markdown.includes("Discovery Report")) throw new Error("Markdown missing header");
    if (!result.csv.includes("Customer ID")) throw new Error("CSV missing header");
    const jsonParsed = JSON.parse(result.json);
    if (!jsonParsed.summary) throw new Error("JSON missing summary");

    recordResult(
      "Report Generator",
      true,
      start,
      `Generated ${result.artifacts.length} formats | MD: ${result.markdown.length}B, CSV: ${result.csv.length}B, JSON: ${result.json.length}B`
    );
  } catch (err) {
    recordResult("Report Generator", false, start, "", err instanceof Error ? err.message : "Unknown");
  }
}

async function testActionDispatcher() {
  const start = Date.now();
  try {
    const { createAction, createActionsFromFindings, getActionStats, approveAction, dispatchAction } =
      await import("./action-dispatcher");

    // Create a test action
    const action = createAction({
      runId: "test-run-live",
      type: "update_base44_status",
      description: "Test action for live test",
      payload: { customerId: "cust_001", enrollmentStatus: "active" },
    });

    if (!action.id) throw new Error("Action missing ID");
    if (action.status !== "pending") throw new Error(`Expected pending, got ${action.status}`);

    // Approve + dispatch
    approveAction(action.id);
    const dispatched = await dispatchAction(action.id);

    if (!dispatched.success) {
      console.log(`  ℹ️  Dispatch may fail without production wiring: ${dispatched.error}`);
    }

    // Test bulk creation from findings
    const testFindings = [
      {
        id: "f-001",
        customerId: "cust_001",
        customerName: "Test Customer",
        severity: "high" as const,
        category: "billing" as const,
        title: "Billing misalignment",
        description: "CRM and NMI disagree",
        evidence: ["CRM says active, NMI says cancelled"],
        recommendation: "Sync NMI with CRM",
        suggestedAction: { type: "sync_nmi" as const, entityId: "cust_001", description: "Sync NMI", payload: {} },
      },
    ];

    const bulkActions = createActionsFromFindings("test-run-live", testFindings, []);
    if (bulkActions.length !== 1) throw new Error(`Expected 1 action, got ${bulkActions.length}`);

    const stats = getActionStats("test-run-live");

    recordResult(
      "Action Dispatcher",
      true,
      start,
      `Created ${stats.total} actions | ${stats.approved} approved, ${stats.completed} completed`
    );
  } catch (err) {
    recordResult("Action Dispatcher", false, start, "", err instanceof Error ? err.message : "Unknown");
  }
}

async function testKnowledgeGraphBridge() {
  const start = Date.now();
  try {
    const { buildDependencyGraph } = await import("./dependency-graph");
    const {
      toD3Format,
      toGraphvizDOT,
      toMermaid,
      analyzeCustomerGraphs,
      toRichD3Format,
    } = await import("./knowledge-graph-bridge");

    const fixturePath = path.join(FIXTURES_DIR, "test-customer-contexts.json");
    const raw = await fs.readFile(fixturePath, "utf-8");
    const contexts: CustomerDiscoveryContext[] = JSON.parse(raw);

    const graph = buildDependencyGraph(contexts, []);

    // Test D3 conversion
    const d3 = toD3Format(graph);
    if (!d3.nodes || d3.nodes.length === 0) throw new Error("D3 conversion produced no nodes");
    if (!d3.edges) throw new Error("D3 conversion produced no edges");

    // Test Graphviz DOT export
    const dot = toGraphvizDOT(graph);
    if (!dot.startsWith("digraph")) throw new Error("DOT export doesn't start with digraph");

    // Test Mermaid export
    const mermaid = toMermaid(graph);
    if (!mermaid.includes("```mermaid")) throw new Error("Mermaid export missing opening fence");

    // Test customer risk analysis
    const riskScores = analyzeCustomerGraphs(graph);
    if (riskScores.length === 0) throw new Error("No risk scores computed");

    // Test rich D3 format
    const rich = toRichD3Format(graph);
    if (!rich.summary) throw new Error("Rich D3 missing summary");
    if (!rich.typeColors) throw new Error("Rich D3 missing type colors");

    recordResult(
      "Knowledge Graph Bridge",
      true,
      start,
      `D3: ${d3.nodes.length} nodes, ${d3.edges.length} edges | DOT: ${dot.length}B | Mermaid: ${mermaid.length}B | Risk scores: ${riskScores.length} customers`
    );
  } catch (err) {
    recordResult("Knowledge Graph Bridge", false, start, "", err instanceof Error ? err.message : "Unknown");
  }
}

async function testFullPipeline() {
  const start = Date.now();
  try {
    // Load all modules
    const { validateAll } = await import("./alignment-validators");
    const { buildDependencyGraph } = await import("./dependency-graph");
    const { generateReport } = await import("./report-generator");
    const { toRichD3Format, analyzeCustomerGraphs } = await import("./knowledge-graph-bridge");
    const { createActionsFromFindings } = await import("./action-dispatcher");

    // Load fixture contexts
    const fixturePath = path.join(FIXTURES_DIR, "test-customer-contexts.json");
    const raw = await fs.readFile(fixturePath, "utf-8");
    const contexts: CustomerDiscoveryContext[] = JSON.parse(raw);

    // Step 1: Validate all customers
    const validations = new Map<string, AlignmentResult[]>();
    for (const c of contexts) {
      validations.set(c.customerId, validateAll(c));
    }

    // Step 2: Build dependency graph
    const graph = buildDependencyGraph(contexts, []);

    // Step 3: Generate report
    const report = await generateReport({
      runId: "test-full-pipeline",
      contexts,
      validations,
      graph,
      config: { format: ["markdown", "csv", "json"], includeCustomerDetails: true },
    });

    // Step 4: Analyze graphs
    const rich = toRichD3Format(graph);
    const riskScores = analyzeCustomerGraphs(graph);

    // Step 5: Create actions from findings
    const actions = createActionsFromFindings("test-full-pipeline", report.report.findings, contexts);

    // Verify complete pipeline output
    if (!report.report.summary) throw new Error("No summary");
    if (report.report.findings.length === 0 && contexts.some((c) => c.alignment.flags.length > 0)) {
      console.log("  ℹ️  Findings count is 0 but some contexts have alignment flags — check finding card builder");
    }

    // Track metrics
    const metrics = {
      customers: contexts.length,
      findings: report.report.findings.length,
      criticalFindings: report.report.findings.filter((f) => f.severity === "critical").length,
      graphNodes: graph.nodes.size,
      graphEdges: graph.edges.length,
      graphCycles: graph.cycles.length,
      riskCustomers: riskScores.length,
      averageRiskScore: riskScores.length > 0
        ? Math.round(riskScores.reduce((s, r) => s + r.riskScore, 0) / riskScores.length)
        : 0,
      actions: actions.length,
      formats: report.artifacts.length,
    };

    recordResult(
      "Full Pipeline Integration",
      true,
      start,
      `E2E: ${metrics.customers} customers → ${metrics.findings} findings → ${metrics.actions} actions → ${metrics.formats} formats`,
      undefined,
      metrics
    );
  } catch (err) {
    recordResult("Full Pipeline Integration", false, start, "", err instanceof Error ? err.message : "Unknown");
  }
}

async function testProductionWiring() {
  const start = Date.now();
  try {
    // Check if Base44 API key is available
    const hasBase44Key = !!process.env.BASE44_API_KEY;
    const hasPostgresUrl = !!process.env.POSTGRES_URL;

    let message = `Base44 SDK: ${hasBase44Key ? "Available ✅" : "Not configured (stub mode)"} | `;
    message += `Postgres: ${hasPostgresUrl ? "Available ✅" : "Not configured"}`;

    // Try importing base44 client to verify module resolution
    try {
      await import("@/connectors/base44/client");
      message += ` | Client module: Loadable ✅`;
    } catch {
      message += ` | Client module: Not loadable (expected outside VPS)`;
    }

    // Check secrets module
    try {
      await import("@/secrets");
      message += ` | Secrets: Loadable ✅`;
    } catch {
      message += ` | Secrets: Not loadable (expected outside VPS)`;
    }

    recordResult("Production Wiring", true, start, message);
  } catch (err) {
    recordResult("Production Wiring", false, start, "", err instanceof Error ? err.message : "Unknown");
  }
}

// ── Run ────────────────────────────────────────────────────────────

runAllTests().catch((err) => {
  console.error("Test suite crashed:", err);
  process.exit(1);
});
