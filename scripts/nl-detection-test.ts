#!/usr/bin/env -S pnpm tsx
/**
 * scripts/nl-detection-test.ts — Natural Language Detection Fine-Tuning
 * Phase 32: Validate 15 real sales agent phrases against intent classifiers.
 *
 * Usage:
 *   pnpm tsx scripts/nl-detection-test.ts
 */

import { classifyIntent as classifyMode, type IntentClassification, type IntentMode } from "../lib/intent-classifier";
import { detectIntent as detectCrmAction, type DetectedIntent } from "../lib/crm-actions/detect";

// ── 15 Real Sales Agent Test Phrases ─────────────────────────────

interface TestPhrase {
  phrase: string;
  expectedMode: IntentMode;
  expectedCrmAction?: string;
  description: string;
}

const TEST_PHRASES: TestPhrase[] = [
  // ── Group A: Data Lookups (tool_call) ──
  { phrase: "Show me all active customers", expectedMode: "tool_call", description: "Agent asking for customer list" },
  { phrase: "Find Lisa Heiss", expectedMode: "tool_call", description: "Agent searching for a specific customer (no CRM write action expected)" },
  { phrase: "What's the status of my enrollments today?", expectedMode: "tool_call", description: "Agent checking daily numbers" },
  { phrase: "How many payments came in this morning?", expectedMode: "tool_call", description: "Agent checking payment count" },
  { phrase: "Show me Shane Smith's profile", expectedMode: "tool_call", description: "Agent looking up a record" },

  // ── Group B: CRM Actions (tool_call with CRM detection) ──
  { phrase: "Send a payment link to Alicia for $99", expectedMode: "tool_call", expectedCrmAction: "sendPaymentLink", description: "Agent sending a payment link" },
  { phrase: "Add note: customer called about billing issue", expectedMode: "tool_call", expectedCrmAction: "addNote", description: "Agent adding a note" },
  { phrase: "Update Lisa's status to Paused", expectedMode: "tool_call", expectedCrmAction: "updatePersonStatus", description: "Agent updating status" },
  { phrase: "Create a ticket for Marvin: dispute resolution needed", expectedMode: "tool_call", expectedCrmAction: "createSupportTicket", description: "Agent creating a ticket" },
  { phrase: "Send SMS to Christopher: your enrollment is ready", expectedMode: "tool_call", expectedCrmAction: "sendSMS", description: "Agent sending SMS" },

  // ── Group C: Navigation Commands (tool_call) ──
  { phrase: "Go to the contacts page", expectedMode: "tool_call", description: "Agent navigating Twenty CRM" },
  { phrase: "Open Christopher Shaw's record", expectedMode: "tool_call", description: "Agent opening a customer record" },

  // ── Group D: Workflows ──
  { phrase: "Run the payment recovery workflow", expectedMode: "workflow", description: "Agent running a workflow" },
  { phrase: "Process all overdue payments", expectedMode: "workflow", description: "Agent processing batch" },

  // ── Group E: Reasoning + Chat ──
  { phrase: "Why is Marvin's payment failing?", expectedMode: "reasoning", description: "Agent investigating an issue" },
  { phrase: "Hey, what can you do?", expectedMode: "chat", description: "Agent asking about capabilities" },
];

// ── Additional 5 edge-case phrases for robustness ──

const EDGE_PHRASES: TestPhrase[] = [
  { phrase: "navigate to settings", expectedMode: "tool_call", description: "Shorthand navigation" },
  { phrase: "compare Lisa and Alicia payment history", expectedMode: "reasoning", description: "Comparison request" },
  { phrase: "send payment link $49 to Lisa", expectedMode: "tool_call", expectedCrmAction: "sendPaymentLink", description: "Payment link with different word order" },
  { phrase: "every customer with failed payment needs SMS", expectedMode: "workflow", description: "Batch operation" },
  { phrase: "thanks, that helped", expectedMode: "chat", description: "Gratitude" },
];

// ── Test Runner ──────────────────────────────────────────────────

interface TestResult {
  phrase: string;
  expectedMode: IntentMode;
  actualMode: IntentMode;
  modeMatch: boolean;
  modeConfidence: string;
  expectedCrmAction?: string;
  detectedCrmAction?: string;
  detectedCrmConfidence?: number;
  crmActionMatch?: boolean;
  description: string;
}

function runTest(phrases: TestPhrase[]): { results: TestResult[]; stats: Record<string, number> } {
  const results: TestResult[] = [];
  const stats = { total: 0, passed: 0, failed: 0, crmDetected: 0, crmCorrect: 0, crmWrong: 0 };

  for (const tp of phrases) {
    const modeResult = classifyMode(tp.phrase);
    const crmResult = detectCrmAction(tp.phrase, 0.25);

    const result: TestResult = {
      phrase: tp.phrase,
      expectedMode: tp.expectedMode,
      actualMode: modeResult.mode,
      modeMatch: modeResult.mode === tp.expectedMode,
      modeConfidence: modeResult.confidence,
      expectedCrmAction: tp.expectedCrmAction,
      detectedCrmAction: crmResult?.action?.name,
      detectedCrmConfidence: crmResult?.confidence,
      crmActionMatch: tp.expectedCrmAction
        ? crmResult?.action?.name === tp.expectedCrmAction
        : undefined,
      description: tp.description,
    };

    results.push(result);
    stats.total++;

    if (result.modeMatch) stats.passed++;
    else stats.failed++;

    if (tp.expectedCrmAction) {
      if (crmResult) stats.crmDetected++;
      if (result.crmActionMatch) stats.crmCorrect++;
      else stats.crmWrong++;
    }
  }

  return { results, stats };
}

// ── Main ─────────────────────────────────────────────────────────

function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  Phase 32: NL Detection Fine-Tuning");
  console.log("  Sales Agent Natural Language Test");
  console.log("═══════════════════════════════════════════\n");

  // Run core 15
  console.log("── Core 15 Phrases ──\n");
  const { results: coreResults, stats: coreStats } = runTest(TEST_PHRASES);

  for (const r of coreResults) {
    const modeIcon = r.modeMatch ? "✅" : "❌";
    const crmInfo = r.expectedCrmAction
      ? ` | CRM: ${r.detectedCrmAction || "NONE"}${r.crmActionMatch ? " ✅" : " ❌"}`
      : "";
    console.log(
      `${modeIcon} [${r.actualMode.padEnd(12)}] "${r.phrase}"${crmInfo}`
    );
    if (!r.modeMatch) {
      console.log(`   ⚠️ Expected: ${r.expectedMode}, Got: ${r.actualMode} (${r.modeConfidence})`);
    }
  }

  console.log(`\n── Core Stats ──`);
  console.log(`Mode accuracy: ${coreStats.passed}/${coreStats.total} (${Math.round(coreStats.passed / coreStats.total * 100)}%)`);
  console.log(`CRM action detection rate: ${coreStats.crmDetected}/${coreStats.total - coreStats.passed + coreStats.crmCorrect}`);
  console.log(`CRM action accuracy: ${coreStats.crmCorrect} correct, ${coreStats.crmWrong} wrong`);

  // Run edge cases
  console.log(`\n── 5 Edge Cases ──\n`);
  const { results: edgeResults, stats: edgeStats } = runTest(EDGE_PHRASES);

  for (const r of edgeResults) {
    const modeIcon = r.modeMatch ? "✅" : "❌";
    const crmInfo = r.expectedCrmAction
      ? ` | CRM: ${r.detectedCrmAction || "NONE"}${r.crmActionMatch ? " ✅" : " ❌"}`
      : "";
    console.log(
      `${modeIcon} [${r.actualMode.padEnd(12)}] "${r.phrase}"${crmInfo}`
    );
  }

  console.log(`\n── Edge Stats ──`);
  console.log(`Mode accuracy: ${edgeStats.passed}/${edgeStats.total}`);

  // Combined
  const totalPassed = coreStats.passed + edgeStats.passed;
  const totalTests = coreStats.total + edgeStats.total;
  console.log(`\n── Combined ──`);
  console.log(`Total accuracy: ${totalPassed}/${totalTests} (${Math.round(totalPassed / totalTests * 100)}%)`);

  // Summary
  const allResults = [...coreResults, ...edgeResults];
  const failures = allResults.filter((r) => !r.modeMatch);
  if (failures.length > 0) {
    console.log(`\n── Failures to Fix (${failures.length}) ──`);
    for (const f of failures) {
      console.log(`  ❌ "${f.phrase}"`);
      console.log(`     Expected: ${f.expectedMode}, Got: ${f.actualMode} (${f.modeConfidence})`);
      console.log(`     Context: ${f.description}`);
    }
  }

  process.exit(totalPassed === totalTests ? 0 : 1);
}

main();
