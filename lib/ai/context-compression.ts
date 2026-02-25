import { generateText, type ModelMessage } from 'ai';
import { webAutomationModel } from '@/lib/ai/providers';

const SUMMARIZE_THRESHOLD = 20; // trigger full summarization above this many messages
const KEEP_RECENT = 8;          // always keep last N messages verbatim
const PRUNE_THRESHOLD = 600;    // truncate default tool results beyond this many chars

export async function compressMessageHistory(
  messages: ModelMessage[]
): Promise<ModelMessage[]> {
  if (messages.length <= KEEP_RECENT) return messages;

  const splitAt = messages.length - KEEP_RECENT;
  const oldMessages = messages.slice(0, splitAt);
  const recentMessages = messages.slice(splitAt);

  // Full summarization: replace old messages with a generated summary
  if (messages.length > SUMMARIZE_THRESHOLD) {
    const { text: summary } = await generateText({
      model: webAutomationModel,
      system:
        'You are summarizing a form-filling session for continuity. ' +
        'Preserve: client name, DOB, Apricot ID; the active form name and URL; ' +
        'every field completed and its value; every field still pending; ' +
        'caseworker corrections and overrides; key facts about the client record. ' +
        'Do not include browser snapshot content or raw field lists. Be concise.',
      messages: oldMessages,
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
        return `[Apricot record loaded: ID ${rec.id ?? 'unknown'} — use session memory for key values]`;
      }
      return '[Apricot record: not found]';
    }

    case 'getApricotFormFields': {
      const fields = r?.fields as unknown[];
      return `[Apricot form fields: ${fields?.length ?? 0} fields loaded — already processed]`;
    }

    default: {
      const serialized = JSON.stringify(result);
      if (serialized.length > PRUNE_THRESHOLD) {
        return serialized.slice(0, PRUNE_THRESHOLD) + '…[truncated]';
      }
      return serialized;
    }
  }
}
