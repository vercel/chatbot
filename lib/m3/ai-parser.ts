/**
 * M3 AI Parser — Claude Haiku via AI Gateway BYOK
 * Extracts structured customer data from agent Slack messages.
 * Phase: Part B.2 — Direction B parser
 */

const AI_GATEWAY_URL = process.env.AI_GATEWAY_URL || "https://ai-gateway.vercel.sh/v1/chat/completions";
const AI_GATEWAY_KEY = process.env.AI_GATEWAY_API_KEY || "";

export interface ParsedSubmission {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  agentName: string | null;
  notes: string | null;
  confidence: number;
}

const SYSTEM_PROMPT = `You extract customer submission data from agent Slack messages. Return JSON only with keys: firstName, lastName, email, phone, agentName, notes, confidence (0-1).

Rules:
- firstName: first name of the CLIENT/CUSTOMER (not the agent)
- lastName: last name of the CLIENT/CUSTOMER
- email: validate format, must contain @
- phone: extract digits only, format as plain numbers
- agentName: the agent submitting (e.g., "Jerry", "Jennifer", "Anna", "Edgar", "Michael", "Kinza", "Chris", "Izhan", "Shazam")
- notes: any extra context like "hardship case", "high priority", etc.
- confidence: 0-1 score. 0.9+ if first+last+phone+email all clear. 0.7-0.89 if some fields ambiguous. <0.7 if major info missing.
- If a field is missing or unclear, return null.
- Be strict about email/phone validation.
- Return ONLY valid JSON, no markdown, no explanation.`;

export async function aiParseSubmission(text: string): Promise<ParsedSubmission> {
  if (!AI_GATEWAY_KEY) {
    console.warn("[m3/ai-parser] No AI_GATEWAY_API_KEY configured, using fallback regex parser");
    return regexFallbackParser(text);
  }

  try {
    const response = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${AI_GATEWAY_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        max_tokens: 300,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error(`[m3/ai-parser] AI Gateway error: ${response.status}`);
      return regexFallbackParser(text);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.warn("[m3/ai-parser] Empty AI response, using fallback");
      return regexFallbackParser(text);
    }

    // Extract JSON from markdown code blocks if needed
    let jsonStr = content;
    const codeBlockMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1];
    }
    const parsed = JSON.parse(jsonStr);
    return {
      firstName: parsed.firstName || null,
      lastName: parsed.lastName || null,
      email: parsed.email || null,
      phone: parsed.phone || null,
      agentName: parsed.agentName || null,
      notes: parsed.notes || null,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
    };
  } catch (err) {
    console.error("[m3/ai-parser] AI parse failed:", err);
    return regexFallbackParser(text);
  }
}

/** Regex fallback when AI Gateway is unavailable */
function regexFallbackParser(text: string): ParsedSubmission {
  const result: ParsedSubmission = {
    firstName: null,
    lastName: null,
    email: null,
    phone: null,
    agentName: null,
    notes: null,
    confidence: 0,
  };

  // Email
  const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) {
    result.email = emailMatch[1].toLowerCase();
    result.confidence += 0.2;
  }

  // Phone: various formats
  const phoneMatch = text.match(/(\d{3})[-.\s]?(\d{3})[-.\s]?(\d{4})/);
  if (phoneMatch) {
    result.phone = phoneMatch[1] + phoneMatch[2] + phoneMatch[3];
    result.confidence += 0.2;
  }

  // Agent name patterns
  const agentPatterns = [
    /agent\s+(\w+)/i,
    /I was the agent/i,
    /my client/i,
    /agent\s*[:-]\s*(\w+)/i,
  ];
  for (const pat of agentPatterns) {
    const m = text.match(pat);
    if (m) {
      if (m[1]) result.agentName = m[1];
      else result.agentName = "self";
      result.confidence += 0.1;
      break;
    }
  }

  // Name patterns
  const namePatterns = [
    /(?:new\s+client|client\s+name|new[:]\s*)\s*([A-Z][a-z]+)\s+([A-Z][a-z]+)/i,
    /([A-Z][a-z]+)\s+([A-Z][a-z]+)\s+(?:phone|email|\d)/i,
    /([A-Z][a-z]+)\s+([A-Z][a-z]+)\s*[|,]/i,
  ];
  for (const pat of namePatterns) {
    const m = text.match(pat);
    if (m) {
      result.firstName = m[1];
      result.lastName = m[2];
      result.confidence += 0.3;
      break;
    }
  }

  // Notes
  const notesPatterns = [
    /(hardship\s*case)/i,
    /(high\s*priority)/i,
    /(urgent)/i,
    /(follow\s*up)/i,
  ];
  const notes: string[] = [];
  for (const pat of notesPatterns) {
    const m = text.match(pat);
    if (m) notes.push(m[1]);
  }
  if (notes.length > 0) {
    result.notes = notes.join(", ");
    result.confidence += 0.1;
  }

  // Cap confidence
  result.confidence = Math.min(result.confidence, 1.0);

  return result;
}
