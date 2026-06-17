/**
 * /api/twenty-auth — Twenty CRM Auth Bridge
 * Phase 33 Stream 1 | 2026-06-17
 *
 * Validates NextAuth session → maps role → returns Twenty session token
 * Used by the Twenty iframe embed for authenticated embedding.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";

const TWENTY_GRAPHQL_URL = `${process.env.TWENTY_SERVER_URL || "https://crm.newleaf.financial"}/graphql`;
const TWENTY_API_KEY = process.env.TWENTY_API_KEY || process.env.TWENTYFIRST_API_KEY || "";

/** Map session role to Twenty role */
function mapRoleToTwenty(role: string): string {
  switch (role) {
    case "admin":
    case "super_admin":
      return "Admin";
    case "sales_agent":
      return "Member";
    default:
      return "Member"; // Default least-privilege
  }
}

export async function GET(_req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as { role?: string }).role || "sales_agent";
    const twentyRole = mapRoleToTwenty(userRole);

    const iframeUrl = new URL(`${process.env.TWENTY_SERVER_URL || "https://crm.newleaf.financial"}`);
    iframeUrl.searchParams.set("auth_token", TWENTY_API_KEY);
    iframeUrl.searchParams.set("role", twentyRole);

    return NextResponse.json({
      token: TWENTY_API_KEY,
      role: twentyRole,
      iframeUrl: iframeUrl.toString(),
      userId: (session.user as { id?: string }).id || "unknown",
    });
  } catch (error) {
    console.error("[twenty-auth] Bridge error:", error);
    return NextResponse.json(
      { error: "Auth bridge error" },
      { status: 500 }
    );
  }
}
