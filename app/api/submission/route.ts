/**
 * POST /api/submission — M3 Direction A
 * Twenty CRM form → upsert Person → post Slack card
 *
 * Input: { firstName, lastName, email, phone, agentEmail, notes }
 * Output: { ok, personId, isNew, slackTs }
 */

import { NextRequest, NextResponse } from "next/server";
import { upsertPerson } from "@/lib/m3/db-helpers";
import { postFormalCard } from "@/lib/m3/slack-helpers";

// Test channel for verification; switch to #newleaf-submissions in prod
const SUBMISSION_CHANNEL = process.env.SUBMISSION_SLACK_CHANNEL || "C0AQDDC3HAB"; // #jarvis-admin for testing

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { firstName, lastName, email, phone, agentEmail, notes } = body;

    // Validate required fields
    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json(
        { ok: false, error: "firstName and lastName are required" },
        { status: 400 }
      );
    }

    if (!phone && !email) {
      return NextResponse.json(
        { ok: false, error: "phone or email is required" },
        { status: 400 }
      );
    }

    // Upsert Person
    const result = await upsertPerson({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      agentEmail: agentEmail?.trim() || null,
      notes: notes?.trim() || null,
    });

    // Post formal card to Slack
    const slackTs = await postFormalCard(SUBMISSION_CHANNEL, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      agentEmail: agentEmail?.trim() || null,
      notes: notes?.trim() || null,
      personId: result.personId,
      isNew: result.isNew,
    });

    return NextResponse.json({
      ok: true,
      personId: result.personId,
      isNew: result.isNew,
      action: result.action,
      slackTs,
      twentyUrl: `https://crm.newleaf.financial/object/person/${result.personId}`,
    });
  } catch (err) {
    console.error("[m3/submission] Error:", err);
    return NextResponse.json(
      { ok: false, error: `Submission failed: ${err instanceof Error ? err.message : "Unknown"}` },
      { status: 500 }
    );
  }
}
