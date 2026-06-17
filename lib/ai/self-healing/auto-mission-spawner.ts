/**
 * Phase 24: Auto-Mission Spawner
 *
 * Triggered when log analysis determines needsFix=true.
 * Creates a V2 mission with full context from the log analysis.
 *
 * The mission includes:
 * - Step 1: The log evidence (what, when, severity, hypothesis)
 * - Step 2: KG-matched patterns for guidance
 * - Step 3: Suggested code fix
 */

import type { LogAnalysisResult, KGMatch } from "./log-analyzer";

// ── Types ───────────────────────────────────────────────────────────

export interface SpawnedMission {
  missionId: string;
  title: string;
  source: string;
  severity: string;
  handoffUrl: string;
}

// ── Mission Title Generator ──────────────────────────────────────────

function generateMissionTitle(
  extracted: LogAnalysisResult["extracted"]
): string {
  const { connector, errorCode, hypothesis } = extracted;

  if (connector && errorCode) {
    return `Fix ${connector.toUpperCase()} error ${errorCode}: ${hypothesis}`;
  }
  if (connector) {
    return `Investigate ${connector.toUpperCase()} issue: ${hypothesis}`;
  }
  return `Self-healing: ${hypothesis}`;
}

function generateMissionDescription(
  analysis: LogAnalysisResult
): string {
  const { extracted, kgMatches } = analysis;

  let desc = `## Auto-Detected Issue\n\n`;
  desc += `- **What:** ${extracted.what}\n`;
  desc += `- **When:** ${extracted.when}\n`;
  desc += `- **Severity:** ${extracted.severity}\n`;
  desc += `- **Hypothesis:** ${extracted.hypothesis}\n`;

  if (extracted.connector) {
    desc += `- **Connector:** ${extracted.connector}\n`;
  }
  if (extracted.errorCode) {
    desc += `- **Error Code:** ${extracted.errorCode}\n`;
  }

  if (kgMatches.length > 0) {
    desc += `\n## KG Pattern Matches\n\n`;
    for (const match of kgMatches) {
      desc += `- **${match.playbook}** (confidence: ${(match.confidence * 100).toFixed(0)}%): ${match.pattern}\n`;
    }
  }

  desc += `\n## Suggested Actions\n\n`;
  desc += `1. Review the log evidence above\n`;
  desc += `2. Check the KG-matched pattern(s) for known solutions\n`;
  desc += `3. Implement fix based on hypothesis\n`;
  desc += `4. Test and verify\n`;
  desc += `5. Update playbook/patterns.md with new anti-pattern if novel\n`;

  if (extracted.connector) {
    desc += `\n> 💡 Check connector-skills/${extracted.connector}/anti-patterns.md for related patterns.\n`;
  }

  return desc;
}

// ── Main Export ──────────────────────────────────────────────────────

/**
 * Spawn a V2 mission from log analysis.
 *
 * In production, this would call the V2 API to create a coding session.
 * Currently: returns mission plan object for integration.
 *
 * @param analysis - The log analysis result from analyzeLog()
 * @param targetRepo - Target repository for code fix (default: 'neptune-chat')
 * @returns Spawned mission metadata
 */
export async function spawnMission(
  analysis: LogAnalysisResult,
  targetRepo: string = "neptune-chat"
): Promise<SpawnedMission | null> {
  if (!analysis.needsFix) return null;

  const title = generateMissionTitle(analysis.extracted);
  const missionId = `sh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  console.log(
    `[auto-mission-spawner] 🚀 Spawning mission: ${title}`
  );
  console.log(
    `[auto-mission-spawner]    Mission ID: ${missionId}`
  );

  // In future: call V2 API to create actual coding session
  // const v2Response = await fetch('https://neptune-v2.vercel.app/api/sessions', {...})

  return {
    missionId,
    title,
    source: "self-healing",
    severity: analysis.extracted.severity,
    handoffUrl: `https://neptune-chat-ashy.vercel.app/library/v2?mission=${missionId}`,
  };
}

/**
 * Convenience: analyze log AND spawn mission if needed.
 */
export async function analyzeAndSpawn(
  rawLog: string,
  source: string,
  { analyzeLog }: { analyzeLog: typeof import("./log-analyzer").analyzeLog }
): Promise<{
  analysis: LogAnalysisResult;
  mission: SpawnedMission | null;
}> {
  const analysis = await analyzeLog(rawLog, source);
  const mission = await spawnMission(analysis);
  return { analysis, mission };
}
