/**
 * GET /api/workflows/[id] — Get a specific workflow template
 */
import { NextRequest, NextResponse } from "next/server";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { libraryWorkflowTemplate } from "@/lib/db/schema";

const dbClient = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(dbClient);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const results = await db
      .select()
      .from(libraryWorkflowTemplate)
      .where(eq(libraryWorkflowTemplate.id, id))
      .limit(1);

    if (!results.length) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json(results[0]);
  } catch (err) {
    console.error("[GET /api/workflows/[id]]", err);
    return NextResponse.json(
      { error: "Failed to get workflow" },
      { status: 500 }
    );
  }
}
