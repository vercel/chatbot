/**
 * GET /api/discovery/report?runId=xxx&format=markdown|csv|json|pdf
 *
 * Returns a generated report for a completed discovery run.
 */

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";
import { auth } from "@/app/(auth)/auth";

const REPORT_DIR = path.join(process.cwd(), "lib/discovery/.reports");

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const runId = searchParams.get("runId");
    const format = searchParams.get("format") || "json";

    if (!runId) {
      return NextResponse.json({ error: "runId required" }, { status: 400 });
    }

    const ext = format === "markdown" ? "md" : format;
    const reportPath = path.join(REPORT_DIR, `${runId}.${ext}`);

    try {
      await fs.access(reportPath);
    } catch {
      return NextResponse.json(
        { error: `Report not found for run ${runId} in format ${format}` },
        { status: 404 }
      );
    }

    const content = await fs.readFile(reportPath);

    const contentType: Record<string, string> = {
      markdown: "text/markdown",
      csv: "text/csv",
      json: "application/json",
      pdf: "application/pdf",
    };

    return new NextResponse(content, {
      headers: {
        "Content-Type": contentType[format] || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${runId}.${ext}"`,
      },
    });
  } catch (err) {
    console.error("[GET /api/discovery/report]", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
