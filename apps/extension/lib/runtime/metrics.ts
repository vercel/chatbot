import { extensionDb } from '@/lib/db/database';
import type { LocalMessageRecord } from '@/lib/types';

type ParsedUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  tokensPerSecond?: number;
  ttftMs?: number;
};

const parseNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

export const extractUsageFromMetadata = (
  metadata: Record<string, unknown> | undefined,
): ParsedUsage | null => {
  if (!metadata) return null;
  const usage = metadata.usage;
  if (!usage || typeof usage !== 'object') return null;

  const usageRecord = usage as Record<string, unknown>;
  const inputTokens = parseNumber(usageRecord.inputTokens) ?? 0;
  const outputTokens = parseNumber(usageRecord.outputTokens) ?? 0;
  const totalTokens =
    parseNumber(usageRecord.totalTokens) ?? inputTokens + outputTokens;
  const tokensPerSecond = parseNumber(usageRecord.tokensPerSecond);
  const ttftMs = parseNumber(usageRecord.ttftMs);

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    ...(tokensPerSecond !== undefined ? { tokensPerSecond } : {}),
    ...(ttftMs !== undefined ? { ttftMs } : {}),
  };
};

export const addUsageStatFromMessage = async (
  threadId: string,
  message: LocalMessageRecord,
) => {
  const parsedUsage = extractUsageFromMetadata(message.metadata);
  if (!parsedUsage) return null;

  const record = {
    id: crypto.randomUUID(),
    threadId,
    messageId: message.id,
    inputTokens: parsedUsage.inputTokens,
    outputTokens: parsedUsage.outputTokens,
    totalTokens: parsedUsage.totalTokens,
    tokensPerSecond: parsedUsage.tokensPerSecond,
    ttftMs: parsedUsage.ttftMs,
    createdAt: new Date().toISOString(),
  };

  await extensionDb.usageStats.put(record);
  return record;
};
