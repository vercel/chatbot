/**
 * Phase 23B: Zhipu Direct Fallback for GLM 5.2
 *
 * When prompt context exceeds 200K tokens AND model is zai/glm-5.2,
 * route directly to Zhipu's native API (https://open.bigmodel.cn)
 * to leverage GLM 5.2's full 1M context window.
 *
 * Auto-detects token count via heuristic (1 token ≈ 4 chars for English,
 * ≈ 1.5 chars for Chinese).
 */

const ZHIPU_API_BASE = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY || "";
const CONTEXT_THRESHOLD = 200_000; // tokens

/**
 * Heuristic token count estimation.
 * Rough approximation: 1 token ≈ 4 chars English, ≈ 1.5 chars Chinese.
 */
export function estimateTokenCount(text: string): number {
  const chineseChars = (text.match(/[一-鿿]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars / 1.5 + otherChars / 4);
}

/**
 * Check if a given prompt should use Zhipu direct fallback.
 */
export function shouldUseZhipuFallback(
  modelId: string,
  prompt: string
): boolean {
  if (modelId !== "zai/glm-5.2") return false;
  if (!ZHIPU_API_KEY) return false;
  const tokenEstimate = estimateTokenCount(prompt);
  return tokenEstimate > CONTEXT_THRESHOLD;
}

interface ZhipuMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ZhipuResponse {
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Call Zhipu API directly for GLM 5.2 with full 1M context.
 * Falls back gracefully to Gateway if Zhipu API fails.
 */
export async function callZhipuDirect(
  messages: ZhipuMessage[],
  options?: {
    maxTokens?: number;
    temperature?: number;
    stream?: boolean;
  }
): Promise<{
  success: boolean;
  content?: string;
  usage?: { input: number; output: number };
  error?: string;
}> {
  if (!ZHIPU_API_KEY) {
    return { success: false, error: "ZHIPU_API_KEY not configured" };
  }

  try {
    const res = await fetch(ZHIPU_API_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ZHIPU_API_KEY}`,
      },
      body: JSON.stringify({
        model: "glm-5.2",
        messages,
        max_tokens: options?.maxTokens ?? 4096,
        temperature: options?.temperature ?? 0.7,
        stream: options?.stream ?? false,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        success: false,
        error: `Zhipu API error ${res.status}: ${errText.slice(0, 500)}`,
      };
    }

    const data: ZhipuResponse = await res.json();
    return {
      success: true,
      content: data.choices?.[0]?.message?.content ?? "",
      usage: {
        input: data.usage?.prompt_tokens ?? 0,
        output: data.usage?.completion_tokens ?? 0,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: `Zhipu API unreachable: ${(err as Error).message}`,
    };
  }
}
