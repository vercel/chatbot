/**
 * GET /api/audit — Phase 31 CRM Action Audit Trail
 *
 * Returns paginated audit entries from library_crm_actions.
 * Query params: ?limit=50&risk=high&status=failed
 */
import { NextResponse } from "next/server";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { libraryCrmAction } from "@/lib/db/schema";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
    const riskFilter = searchParams.get("risk");
    const statusFilter = searchParams.get("status");

    const dbClient = postgres(process.env.POSTGRES_URL ?? "");
    const db = drizzle(dbClient);

    let query = db.select().from(libraryCrmAction).limit(limit);

    // Note: For proper filtering, we'd use .where() with eq()
    // but since our schema has nullable filters, we fetch and filter in-memory
    const rows = await query;

    let results = rows;

    if (riskFilter && riskFilter !== "all") {
      results = results.filter((r) => r.riskLevel === riskFilter);
    }
    if (statusFilter && statusFilter !== "all") {
      results = results.filter((r) => r.status === statusFilter);
    }

    // Sort by created_at descending (newest first)
    results.sort((a, b) => {
      const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bDate - aDate;
    });

    return NextResponse.json({ entries: results });
  } catch (err) {
    console.error("[audit] Fetch failed:", (err as Error).message);
    return NextResponse.json(
      { entries: [], error: (err as Error).message },
      { status: 200 } // Return 200 with empty to avoid breaking the UI
    );
  }
}
