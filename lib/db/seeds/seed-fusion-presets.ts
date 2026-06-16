/**
 * Phase 23B: Seed 11 Fusion Panel Presets
 *
 * Idempotent — uses ON CONFLICT (name) DO UPDATE for upsert.
 * Chinese Frontier is the DEFAULT preset (isDefault=true).
 *
 * Usage: npx tsx lib/db/seeds/seed-fusion-presets.ts
 */

import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { libraryPanelPreset } from "../schema";
import { SYSTEM_PRESETS } from "@/lib/ai/fusion/presets";

// ── Preset definitions (from the canonical presets.ts) ───────────────

async function main() {
  config({ path: ".env.local" });

  if (!process.env.POSTGRES_URL) {
    console.log("POSTGRES_URL not defined, skipping fusion preset seed");
    process.exit(0);
  }

  const connection = postgres(process.env.POSTGRES_URL, { max: 1 });
  const db = drizzle(connection);

  console.log("🌱 Seeding 11 Fusion Panel Presets...\n");

  let seeded = 0;

  for (const preset of SYSTEM_PRESETS) {
    await db
      .insert(libraryPanelPreset)
      .values({
        name: preset.name,
        description: preset.description,
        agents: preset.agents as unknown as Record<string, unknown>[],
        judge: preset.judge as unknown as Record<string, unknown>,
        capabilities: preset.capabilities,
        domainHint: preset.domainHint,
        defaultMode: preset.defaultMode,
        estCostMin: String(preset.estCostMin),
        estCostMax: String(preset.estCostMax),
        isSystem: true,
        isDefault: preset.isDefault,
        sortOrder: preset.sortOrder,
        createdBy: null,
      })
      .onConflictDoUpdate({
        target: libraryPanelPreset.name,
        set: {
          description: preset.description,
          agents: preset.agents as unknown as Record<string, unknown>[],
          judge: preset.judge as unknown as Record<string, unknown>,
          capabilities: preset.capabilities,
          domainHint: preset.domainHint,
          defaultMode: preset.defaultMode,
          estCostMin: String(preset.estCostMin),
          estCostMax: String(preset.estCostMax),
          isDefault: preset.isDefault,
          sortOrder: preset.sortOrder,
          updatedAt: new Date(),
        },
      });

    const icon = preset.isDefault ? "⭐" : "  ";
    console.log(`   ${icon} ${preset.name} — ${preset.agents.length} agents + ${preset.judge.name} judge — $${preset.estCostMin.toFixed(2)}-$${preset.estCostMax.toFixed(2)}`);
    seeded++;
  }

  console.log(`\n✅ ${seeded}/11 Fusion Panel Presets seeded!`);

  await connection.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Fusion preset seed failed:", err);
  process.exit(1);
});
