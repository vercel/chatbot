import { extensionDb } from '@/lib/db/database';
import type { TraceEventInput, TraceEventRecord } from '@/lib/types';

export async function appendTraceEvent(
  input: TraceEventInput,
): Promise<TraceEventRecord> {
  const event: TraceEventRecord = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...input,
  };
  await extensionDb.traceEvents.put(event);
  return event;
}

export async function listTraceEvents(threadId: string) {
  return extensionDb.traceEvents.where('threadId').equals(threadId).sortBy('createdAt');
}
