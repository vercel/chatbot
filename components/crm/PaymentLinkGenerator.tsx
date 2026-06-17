/**
 * PaymentLinkGenerator — Twenty Generative UI Component
 * Phase 39 Stream 2: Inline payment link creation via Hyperswitch/NMI.
 *
 * SACRED BOUNDARY: This component READS NMI vault IDs for link generation
 * but NEVER modifies NMI vault data. Payment links are generated server-side
 * via the Hyperswitch API which handles the NMI interaction securely.
 */
"use client";

import React, { useState } from "react";

interface PaymentLinkProps {
  personId: string;
  personName?: string;
  nmiVaultId?: string;
  defaultAmount?: number;
}

export function PaymentLinkGenerator({
  personId,
  personName,
  nmiVaultId,
  defaultAmount = 149.0,
}: PaymentLinkProps) {
  const [amount, setAmount] = useState(defaultAmount);
  const [description, setDescription] = useState(
    `Payment for ${personName || "customer"}`
  );
  const [sendMethod, setSendMethod] = useState<"sms" | "email" | "copy">("sms");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{
    url?: string;
    error?: string;
    sentVia?: string;
  } | null>(null);

  async function generateLink() {
    if (!amount || amount <= 0) return;

    setGenerating(true);
    setResult(null);

    try {
      const res = await fetch("/api/twenty-sync/generate-payment-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personId,
          amount,
          description,
          sendMethod,
          nmiVaultId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResult({ error: data.error || `Failed: ${res.status}` });
      } else {
        setResult({
          url: data.paymentUrl || data.link,
          sentVia: sendMethod !== "copy" ? sendMethod : undefined,
        });

        if (sendMethod === "copy" && data.paymentUrl) {
          await navigator.clipboard.writeText(data.paymentUrl);
        }
      }
    } catch (err) {
      setResult({
        error: err instanceof Error ? err.message : "Failed to generate link",
      });
    } finally {
      setGenerating(false);
    }
  }

  const hasNmiVault = !!nmiVaultId;

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">Generate Payment Link</h3>

      {!hasNmiVault && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
          No payment method on file. Customer needs to add a payment method first.
        </div>
      )}

      {/* Amount */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Amount</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            min={1}
            step={0.01}
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      {/* Send Method */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Send via</label>
        <div className="grid grid-cols-3 gap-2">
          {(["sms", "email", "copy"] as const).map((method) => (
            <button
              key={method}
              onClick={() => setSendMethod(method)}
              className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                sendMethod === method
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {method === "sms" ? "SMS" : method === "email" ? "Email" : "Copy Link"}
            </button>
          ))}
        </div>
      </div>

      {/* Generate Button */}
      <button
        onClick={generateLink}
        disabled={generating || !hasNmiVault || amount <= 0}
        className="w-full bg-indigo-600 text-white text-sm font-semibold py-2.5 px-4 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {generating ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
            Generating...
          </span>
        ) : (
          `Generate & ${sendMethod === "copy" ? "Copy" : "Send"}`
        )}
      </button>

      {/* Result */}
      {result && (
        <div className={`rounded-lg p-3 text-sm ${
          result.error
            ? "bg-red-50 border border-red-200 text-red-800"
            : "bg-green-50 border border-green-200 text-green-800"
        }`}>
          {result.error ? (
            <p>{result.error}</p>
          ) : (
            <div className="space-y-2">
              <p className="font-medium">Payment link generated!</p>
              {result.sentVia && (
                <p>Sent via {result.sentVia.toUpperCase()}</p>
              )}
              {result.url && (
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={result.url}
                    className="flex-1 text-xs bg-white border border-green-300 rounded px-2 py-1"
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(result.url!)}
                    className="text-xs bg-white border border-green-300 rounded px-2 py-1 hover:bg-green-100"
                  >
                    Copy
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SACRED Notice */}
      <p className="text-xs text-gray-400 italic">
        Payment links are generated securely via NMI vault reference. Card data is never exposed.
      </p>
    </div>
  );
}
