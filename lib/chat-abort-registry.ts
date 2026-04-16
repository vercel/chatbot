/**
 * Per-chat AbortController registry for explicit cancellation.
 *
 * We can't rely on `request.signal` firing when the client disconnects —
 * on Cloud Run over HTTP/1.1 the LB doesn't propagate client disconnects,
 * and even locally Node only detects disconnect lazily. A separate
 * POST /api/chat/stop endpoint lets the client explicitly abort the
 * in-flight streamText run by looking it up here.
 *
 * This map is per-process (no Redis). Session affinity keeps a given
 * chat pinned to one Cloud Run instance, so this works in practice.
 */
const controllers = new Map<string, AbortController>();

export function registerChatAbort(chatId: string): AbortController {
  const existing = controllers.get(chatId);
  if (existing) {
    existing.abort(new Error('superseded by new request'));
  }
  const controller = new AbortController();
  controllers.set(chatId, controller);
  return controller;
}

export function abortChat(chatId: string): boolean {
  const controller = controllers.get(chatId);
  if (!controller) return false;
  controller.abort(new Error('stopped by user'));
  controllers.delete(chatId);
  return true;
}

export function clearChatAbort(chatId: string, controller: AbortController): void {
  if (controllers.get(chatId) === controller) {
    controllers.delete(chatId);
  }
}
