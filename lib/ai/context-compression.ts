import { generateText, type ModelMessage } from 'ai';
import { prepareStepModel } from '@/lib/ai/providers';

/**
 * Returns a stateful compression function whose cache persists across all
 * prepareStep invocations for a single request.
 */
export function createMessageCompressor() {
  let compressedCache: ModelMessage[] | null = null;
  let lastFullLength = 0;

  return async function compress(stepMessages: ModelMessage[]): Promise<ModelMessage[]> {
    // No new messages since last compression — reuse the cached result.
    if (compressedCache !== null && stepMessages.length === lastFullLength) {
      return compressedCache;
    }

    let toCompress: ModelMessage[];

    if (compressedCache !== null && stepMessages.length > lastFullLength) {
      // Append only the messages added since the last compression point.
      const newMessages = stepMessages.slice(lastFullLength);
      toCompress = [...compressedCache, ...newMessages];
    } else {
      // First call, or unexpected length decrease — start from the full history.
      toCompress = stepMessages;
    }

    const result = await compressMessageHistory(toCompress);
    compressedCache = result;
    lastFullLength = stepMessages.length;
    return result;
  };
}

const TOOL_CALL_COMPRESS_THRESHOLD = 15; // start pruning old tool results at this many tool calls
const TOOL_CALL_SUMMARIZE_THRESHOLD = 30; // switch to full LLM summarization at this many tool calls
const KEEP_RECENT = 10;                   // always keep last N messages verbatim
const PRUNE_THRESHOLD = 1200;             // truncate default tool results beyond this many chars

export async function compressMessageHistory(
  messages: ModelMessage[]
): Promise<ModelMessage[]> {
  // Only compress when the agent has accumulated a lot of tool calls.
  // Regular user ↔ assistant turns don't warrant compression.
  const toolCallCount = messages.filter((m) => m.role === 'tool').length;
  if (toolCallCount < TOOL_CALL_COMPRESS_THRESHOLD) return messages;

  const splitAt = messages.length - KEEP_RECENT;
  if (splitAt <= 0) return messages;

  const oldMessages = messages.slice(0, splitAt);
  const recentMessages = messages.slice(splitAt);

  // Full summarization: replace old messages with a generated summary.
  // IMPORTANT: only strip browser snapshots/screenshots before summarization —
  // keep Apricot records, gap analysis results, and caseworker responses intact
  // so generateText has the actual participant data to work from.
  if (toolCallCount >= TOOL_CALL_SUMMARIZE_THRESHOLD) {
    const messagesForSummarizer = oldMessages.map((msg) => {
      if (msg.role !== 'tool') return msg;
      return {
        ...msg,
        content: (msg.content as any[]).map((part) => {
          if (part.type !== 'tool-result') return part;
          if (part.toolName !== 'browser') return part; // keep participant data
          const r = part.result as Record<string, unknown>;
          if (r?.snapshot || r?.accessibility_tree) {
            return { ...part, content: '[browser snapshot: pruned]' };
          }
          if (r?.screenshot) {
            return { ...part, content: '[browser screenshot: pruned]' };
          }
          return { ...part, content: `[browser ${(r as any)?.action ?? 'action'} completed]` };
        }),
      };
    });

    const { text: summary } = await generateText({
      model: prepareStepModel,
      system:
        'You are creating a session handoff document for a benefits form-filling agent. ' +
        'Extract and preserve ALL of the following — be explicit and complete:\n\n' +
        '- PARTICIPANT RECORD BLOCK: If you see a block that starts with "---PARTICIPANT RECORD---" ' +
        'and ends with "---END PARTICIPANT RECORD---", copy it VERBATIM into the summary. ' +
        'Do not paraphrase it. This is the authoritative source of truth.\n' +
        '- PARTICIPANT DATA: Every field-value pair from the database (Apricot record) and caseworker. ' +
        'Format as "Field: Value" lines. Do NOT drop any field.\n' +
        '- GAP ANSWERS: Every answer the caseworker provided in response to a gap analysis. ' +
        'Gap analysis tool calls show "Missing (needs caseworker input)" fields — the user message ' +
        'that follows immediately after is the caseworker\'s answer. Extract each field name and the ' +
        'value the caseworker gave for it as "Field: Value" lines.\n' +
        '- SESSION STATE: The current form name, URL, and which page/step we are on.\n' +
        '- COMPLETED FIELDS: Every field that has already been filled and its value.\n' +
        '- PENDING FIELDS: Every field still needing input.\n' +
        '- CASEWORKER INPUTS: Every answer or correction the caseworker provided.\n\n' +
        'Do NOT summarize or paraphrase participant data — list every field and value explicitly. ' +
        'Do NOT include browser snapshot content or raw HTML.',
      messages: messagesForSummarizer,
    });

    const summaryMessage: ModelMessage = {
      role: 'assistant',
      content: `[Session summary — earlier context compacted]\n\n${summary}`,
    };

    return [summaryMessage, ...recentMessages];
  }

  // Below summarization threshold: just prune verbose tool results from old messages
  const pruned = oldMessages.map((msg) => {
    if (msg.role !== 'tool') return msg;
    return {
      ...msg,
      content: (msg.content as any[]).map((part) => {
        if (part.type !== 'tool-result') return part;
        return {
          ...part,
          content: summarizeToolResult(part.toolName, part.result),
        };
      }),
    };
  });

  return [...pruned, ...recentMessages];
}

function summarizeToolResult(toolName: string, result: unknown): string {
  const r = result as Record<string, unknown>;

  switch (toolName) {
    case 'browser': {
      if (r?.snapshot || r?.accessibility_tree) {
        return '[browser snapshot: content pruned — already processed]';
      }
      if (r?.screenshot) {
        return '[browser screenshot: pruned]';
      }
      return `[browser ${(r as any)?.action ?? 'action'} completed]`;
    }

    case 'getApricotRecord': {
      if (r?.found && r?.record) {
        const rec = r.record as Record<string, unknown>;
        // Preserve the full record as field: value lines so the data survives
        // both the prune path (no LLM summarizer) and the summarize path.
        const lines = Object.entries(rec)
          .filter(([, v]) => v !== null && v !== undefined && v !== '')
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n');
        return `[Apricot record ID ${rec.id ?? 'unknown'}]\n${lines}`;
      }
      return '[Apricot record: not found]';
    }

    case 'getApricotFormFields': {
      const fields = r?.fields as unknown[];
      return `[Apricot form fields: ${fields?.length ?? 0} fields loaded — already processed]`;
    }

    case 'gapAnalysis': {
      // Preserve gap analysis data verbatim so caseworker answers can be
      // matched against the correct fields after compression.
      const formName = r?.formName ? `Form: ${r.formName}\n` : '';
      const available = (r?.availableFields as Array<{ field: string; value: string }> ?? [])
        .map((f) => `  ${f.field}: ${f.value}`)
        .join('\n');
      const missing = (r?.missingFields as Array<{ field: string }> ?? [])
        .map((f) => `  ${f.field}`)
        .join('\n');
      return (
        `[Gap Analysis]\n${formName}` +
        (available ? `Available:\n${available}\n` : '') +
        (missing ? `Missing (needs caseworker input):\n${missing}` : '')
      );
    }

    default: {
      const serialized = JSON.stringify(result) ?? '';
      if (serialized.length > PRUNE_THRESHOLD) {
        return serialized.slice(0, PRUNE_THRESHOLD) + '…[truncated]';
      }
      return serialized;
    }
  }
}
