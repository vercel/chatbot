/**
 * Phase 25 Stream 2: get-vapi-call tool
 * Returns VAPI call data in UniversalConnectorCard envelope format.
 */
import { tool } from "ai";
import { z } from "zod";

export const getVapiCall = tool({
  description: "Get Vapi call details. Returns callSid, sentiment, duration, and transcript.",
  inputSchema: z.object({
    callId: z.string().describe("Vapi call ID or callSid"),
  }),
  execute: async ({ callId }) => {
    try {
      const res = await fetch(
        `https://api.vapi.ai/call/${callId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.VAPI_API_KEY || ""}`,
          },
        }
      );
      const call = await res.json().catch(() => ({}));

      // Derive sentiment from call analysis if available
      const sentimentScore = call.analysis?.sentiment || 0;
      const sentiment = sentimentScore > 0.3 ? "positive" : sentimentScore < -0.3 ? "negative" : "neutral";

      return {
        connectorType: "vapi",
        data: {
          callSid: call.id || callId,
          sentiment,
          duration: call.monitor?.durationMinutes
            ? `${call.monitor.durationMinutes}min`
            : call.duration || "N/A",
          transcript: call.transcript || "No transcript available",
          cost: call.cost ? `$${Number(call.cost).toFixed(3)}` : "N/A",
          waveform: call.recordingUrl || null,
        },
        schemaVersion: 1,
      };
    } catch {
      return {
        connectorType: "vapi",
        data: {
          callSid: callId,
          sentiment: "neutral",
          duration: "N/A",
          transcript: "Error fetching call",
          cost: "N/A",
          waveform: null,
        },
        schemaVersion: 1,
      };
    }
  },
});
