/**
 * Phase 40 — Agent Chat (LLM-Driven Browser Interaction)
 * Uses AI Gateway (DeepSeek V4 Pro) to analyze page snapshots and decide actions.
 * Falls back to scripted actions if LLM is unavailable.
 *
 * Cost: ~$0.001-0.002 per step, ~$0.01-0.02 per full smoke test.
 * @author abhiswami2121@gmail.com
 */

import type { SnapshotElement, ActionResult } from './browser-agent';
import type { BrowserAgent } from './browser-agent';

// ===== Configuration =====
const AI_GATEWAY_URL = process.env.AI_GATEWAY_URL || 'https://ai-gateway.newleaf.financial';
const AI_GATEWAY_KEY = process.env.AI_GATEWAY_KEY || '';
const LLM_MODEL = process.env.TEST_LLM_MODEL || 'deepseek-v4-pro';
const LLM_FALLBACK_ENABLED = process.env.TEST_LLM_FALLBACK !== 'false';

// Token cost constants (DeepSeek V4 Pro via AI Gateway)
const COST_PER_1K_INPUT = 0.00055;   // $0.55/MTok
const COST_PER_1K_OUTPUT = 0.00219;  // $2.19/MTok

// ===== Types =====

export interface ChatDecision {
  action: 'click' | 'fill' | 'type' | 'navigate' | 'wait' | 'screenshot' | 'assert' | 'done' | 'retry';
  target?: string;       // selector or @ref
  value?: string;
  reasoning: string;
  confidence: number;    // 0-1
}

export interface ChatSession {
  messages: ChatMessage[];
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCost: number;
  decisions: ChatDecision[];
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  tokens: number;
}

// ===== Main Class =====

export class AgentChat {
  private session: ChatSession;
  private browserAgent: BrowserAgent;

  constructor(browserAgent: BrowserAgent) {
    this.browserAgent = browserAgent;
    this.session = {
      messages: [],
      totalInputTokens: 0,
      totalOutputTokens: 0,
      estimatedCost: 0,
      decisions: [],
    };
  }

  // ===== Core Loop =====

  /**
   * Analyze the current page state and decide the next action.
   * This is the core "AI sees page → decides action" loop.
   */
  async decideNextAction(
    goal: string,
    previousActions: ActionResult[],
    snapshot?: SnapshotElement[],
  ): Promise<ChatDecision> {
    // Build the prompt
    const snapshotText = snapshot
      ? snapshot.map(e => `${e.ref} [${e.role}] "${e.name}"${e.placeholder ? ` placeholder="${e.placeholder}"` : ''}`).join('\n')
      : 'No snapshot available';

    const previousText = previousActions.length > 0
      ? previousActions.map(a => `- ${a.action} ${a.target}: ${a.success ? 'OK' : `FAIL (${a.error})`}`).join('\n')
      : 'No previous actions';

    const systemPrompt = `You are a test automation agent. Your goal: ${goal}
Current page elements:
${snapshotText}

Previous actions:
${previousText}

Decide the NEXT action. Respond with JSON:
{
  "action": "click" | "fill" | "type" | "navigate" | "wait" | "screenshot" | "assert" | "done" | "retry",
  "target": "CSS selector or @ref",
  "value": "text to fill/type (optional)",
  "reasoning": "why this action",
  "confidence": 0.0-1.0
}

Rules:
- Use @ref references if available (@e1, @e2)
- Prefer the shortest path to the goal
- If stuck, retry once then skip
- NEVER click payment/submit on billing pages
- If the goal is achieved, return action: "done"`;

    // Try LLM first
    const llmDecision = await this.callLLM(systemPrompt, snapshotText);
    if (llmDecision) {
      this.session.decisions.push(llmDecision);
      return llmDecision;
    }

    // Fallback: scripted decision based on simple heuristics
    return this.scriptedDecision(goal, snapshot);
  }

  /**
   * Execute a chat decision using the browser agent.
   */
  async executeDecision(decision: ChatDecision): Promise<ActionResult> {
    switch (decision.action) {
      case 'click':
        return decision.target
          ? this.browserAgent.click(decision.target)
          : { success: false, action: 'click', target: 'none', durationMs: 0, error: 'No target' };

      case 'fill':
        return decision.target
          ? this.browserAgent.fill(decision.target, decision.value || '')
          : { success: false, action: 'fill', target: 'none', durationMs: 0, error: 'No target' };

      case 'type':
        return decision.target
          ? this.browserAgent.type(decision.target, decision.value || '')
          : { success: false, action: 'type', target: 'none', durationMs: 0, error: 'No target' };

      case 'navigate':
        return decision.value
          ? this.browserAgent.navigate(decision.value)
          : { success: false, action: 'navigate', target: 'none', durationMs: 0, error: 'No URL' };

      case 'wait':
        return this.browserAgent.waitForTimeout(parseInt(decision.value || '2000'));

      case 'screenshot':
        await this.browserAgent.screenshot();
        return { success: true, action: 'screenshot', target: decision.target || 'page', durationMs: 0 };

      case 'done':
        return { success: true, action: 'screenshot', target: 'done', durationMs: 0 };

      case 'retry':
        return { success: true, action: 'wait', target: 'retry', durationMs: 0 };

      default:
        return { success: false, action: 'click', target: 'unknown', durationMs: 0, error: `Unknown action: ${decision.action}` };
    }
  }

  /**
   * Run the full AI-driven loop: snapshot → decide → execute → repeat until done.
   */
  async runGoal(
    goal: string,
    maxSteps = 10,
  ): Promise<{ success: boolean; steps: ActionResult[]; totalCost: number }> {
    const steps: ActionResult[] = [];

    for (let i = 0; i < maxSteps; i++) {
      // Get current page state
      const snap = await this.browserAgent.snapshot();
      const elements = snap.elements;

      // Decide next action
      const decision = await this.decideNextAction(goal, steps, elements);

      if (decision.action === 'done') {
        this.log(`Goal achieved in ${i + 1} steps`);
        return { success: true, steps, totalCost: this.session.estimatedCost };
      }

      if (decision.action === 'retry') {
        this.log('Retrying last action...');
        continue;
      }

      // Execute
      const result = await this.executeDecision(decision);
      steps.push(result);

      if (!result.success) {
        this.log(`Step ${i + 1} failed: ${result.error}`);
        // Continue to next step unless it's critical
        if (i >= maxSteps - 1) {
          return { success: false, steps, totalCost: this.session.estimatedCost };
        }
      }
    }

    return { success: false, steps, totalCost: this.session.estimatedCost };
  }

  // ===== LLM Call =====

  private async callLLM(
    systemPrompt: string,
    context: string,
  ): Promise<ChatDecision | null> {
    try {
      const inputTokens = this.estimateTokens(systemPrompt) + this.estimateTokens(context);
      this.session.totalInputTokens += inputTokens;
      this.session.messages.push({ role: 'user', content: context.slice(0, 500), tokens: inputTokens });

      const response = await fetch(`${AI_GATEWAY_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AI_GATEWAY_KEY}`,
        },
        body: JSON.stringify({
          model: LLM_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: context },
          ],
          max_tokens: 500,
          temperature: 0.1, // Low temp for deterministic test actions
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        this.log(`LLM error: ${response.status} ${response.statusText}`);
        return null;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      const outputTokens = this.estimateTokens(content);
      this.session.totalOutputTokens += outputTokens;
      this.updateCost();

      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          action: parsed.action || 'done',
          target: parsed.target,
          value: parsed.value,
          reasoning: parsed.reasoning || '',
          confidence: parsed.confidence || 0.5,
        };
      }

      return null;
    } catch (err) {
      this.log(`LLM call failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  private scriptedDecision(
    goal: string,
    snapshot?: SnapshotElement[],
  ): ChatDecision {
    // Simple heuristic: find the first matching element
    const elements = snapshot || [];

    // Try to find a button/link that matches the goal
    const keywords = goal.toLowerCase().split(/\s+/);
    for (const el of elements) {
      const nameLower = el.name.toLowerCase();
      if (keywords.some(k => nameLower.includes(k))) {
        return {
          action: el.role === 'textbox' ? 'fill' : 'click',
          target: el.ref,
          value: el.role === 'textbox' ? goal : undefined,
          reasoning: `Scripted: matched "${el.name}" to goal "${goal}"`,
          confidence: 0.6,
        };
      }
    }

    // Fallback: just wait
    return {
      action: 'wait',
      value: '2000',
      reasoning: 'Scripted fallback: no matching elements, waiting',
      confidence: 0.3,
    };
  }

  // ===== Token & Cost Tracking =====

  private estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  private updateCost(): void {
    this.session.estimatedCost =
      (this.session.totalInputTokens / 1000) * COST_PER_1K_INPUT +
      (this.session.totalOutputTokens / 1000) * COST_PER_1K_OUTPUT;
  }

  getSession(): ChatSession {
    return { ...this.session };
  }

  getTotalCost(): number {
    return this.session.estimatedCost;
  }

  getTokenUsage(): { input: number; output: number } {
    return {
      input: this.session.totalInputTokens,
      output: this.session.totalOutputTokens,
    };
  }

  private log(message: string): void {
    if (process.env.TEST_DEBUG === 'true') {
      console.log(`[agent-chat] ${message}`);
    }
  }
}
