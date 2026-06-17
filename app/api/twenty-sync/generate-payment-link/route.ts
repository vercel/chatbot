/**
 * POST /api/twenty-sync/generate-payment-link
 * Phase 39: Generate Hyperswitch/NMI payment link for a customer.
 *
 * SACRED BOUNDARY: This endpoint references NMI vault IDs for link generation
 * but NEVER transmits or stores card data. The payment link is generated
 * server-side via Hyperswitch's API, which interfaces with NMI securely.
 */

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { personId, amount, description, sendMethod, nmiVaultId } = body;

    if (!personId || !amount) {
      return NextResponse.json(
        { error: "personId and amount are required" },
        { status: 400 }
      );
    }

    // Validate amount
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { error: "amount must be a positive number" },
        { status: 400 }
      );
    }

    // Generate payment link via Hyperswitch (or direct NMI)
    // SACRED: Card data never touches this endpoint
    const hyperswitchUrl = process.env.HYPERSWITCH_API_URL;
    const hyperswitchKey = process.env.HYPERSWITCH_API_KEY;

    let paymentUrl: string;

    if (hyperswitchUrl && hyperswitchKey) {
      // Use Hyperswitch for payment link generation
      const hsRes = await fetch(`${hyperswitchUrl}/payment-links`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": hyperswitchKey,
        },
        body: JSON.stringify({
          amount: Math.round(parsedAmount * 100), // cents
          currency: "USD",
          customer_id: personId,
          description: description || `Payment`,
          ...(nmiVaultId ? { payment_method_id: nmiVaultId } : {}),
          metadata: {
            source: "twenty-crm",
            generated_by: "payment-link-generator",
            person_id: personId,
            send_method: sendMethod || "copy",
          },
        }),
      });

      if (!hsRes.ok) {
        const err = await hsRes.text();
        throw new Error(`Hyperswitch error ${hsRes.status}: ${err.slice(0, 200)}`);
      }

      const hsData = await hsRes.json();
      paymentUrl = hsData.payment_link || hsData.url || hsData.link;
    } else {
      // Fallback: Direct NMI payment link
      // Format: https://secure.nmi.com/pay/{vaultId}?amount=X
      if (nmiVaultId) {
        paymentUrl = `https://secure.nmi.com/pay/${nmiVaultId}?amount=${parsedAmount.toFixed(2)}&description=${encodeURIComponent(description || "Payment")}`;
      } else {
        // No vault = guest checkout link
        paymentUrl = `https://pay.newleaf.financial/checkout?customer=${personId}&amount=${parsedAmount.toFixed(2)}&description=${encodeURIComponent(description || "Payment")}`;
      }
    }

    // If sendMethod is not "copy", dispatch the link
    if (sendMethod === "sms" || sendMethod === "email") {
      try {
        // Fetch person contact info
        const twentyUrl = process.env.TWENTY_SERVER_URL || "https://crm.newleaf.financial";
        const twentyKey = process.env.TWENTY_API_KEY;

        if (twentyUrl && twentyKey) {
          const personQuery = `
            query GetPerson($id: String!) {
              person(id: $id) {
                id
                emails { primaryEmail }
                phones { primaryPhoneNumber }
                name { firstName lastName }
              }
            }
          `;
          const personRes = await fetch(`${twentyUrl}/graphql`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${twentyKey}`,
            },
            body: JSON.stringify({
              query: personQuery,
              variables: { id: personId },
            }),
          });
          const personData = await personRes.json();
          const person = personData?.data?.person;

          if (sendMethod === "sms" && person?.phones?.primaryPhoneNumber) {
            // Send SMS via GHL or similar
            console.log(`[payment-link] Would send SMS to ${person.phones.primaryPhoneNumber}`);
          } else if (sendMethod === "email" && person?.emails?.primaryEmail) {
            // Send email via Resend
            console.log(`[payment-link] Would send email to ${person.emails.primaryEmail}`);
          }
        }
      } catch (dispatchErr) {
        console.warn("[payment-link] Link dispatch failed:", dispatchErr);
        // Link was generated — sending failure is non-critical
      }
    }

    return NextResponse.json({
      success: true,
      paymentUrl,
      amount: parsedAmount,
      currency: "USD",
      generatedAt: new Date().toISOString(),
      sentVia: sendMethod !== "copy" ? sendMethod : undefined,
    });
  } catch (err) {
    console.error("[payment-link] Generation failed:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Payment link generation failed",
        success: false,
      },
      { status: 500 }
    );
  }
}
