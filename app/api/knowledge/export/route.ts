/**
 * GET /api/knowledge/export — Triggers OKF bundle export.
 * Returns the manifest as JSON for download or triggers full bundle creation.
 */
import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const outputDir = "/tmp/neptune-okf-bundle";
  const manifestPath = path.join(outputDir, "manifest.yaml");

  // Run export script
  try {
    execSync(
      `cd ${process.cwd()} && npx tsx scripts/export-okf-bundle.ts --output ${outputDir}`,
      { timeout: 30000, stdio: "pipe" }
    );
  } catch (err) {
    return NextResponse.json({
      error: "Export failed",
      details: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }

  // Read manifest
  let manifest = null;
  try {
    manifest = fs.readFileSync(manifestPath, "utf-8");
  } catch {}

  return NextResponse.json({
    status: "ok",
    outputDir,
    manifest: manifest ? "Available" : "Not found",
    fileCount: fs.existsSync(outputDir)
      ? fs.readdirSync(outputDir, { recursive: true }).length
      : 0,
  });
}
