/**
 * POST /api/chat/abort — Abort an active chat stream.
 *
 * Body: { chatId: string }
 *
 * Sets a cancellation flag for the given chat. The streamText route
 * checks this flag via onChunk and aborts if flagged.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAllowlist } from "@/lib/auth/require-allowlist";

// In-memory cancellation set (cleared on process restart)
// For production, this should use Redis or a DB flag.
const cancelledChatIds = new Set<string>();

export function isChatAborted(chatId: string): boolean {
  return cancelledChatIds.has(chatId);
}

export function clearAbortFlag(chatId: string): void {
  cancelledChatIds.delete(chatId);
}

export const POST = requireAllowlist(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { chatId } = body;

    if (!chatId || typeof chatId !== "string") {
      return NextResponse.json(
        { error: "chatId is required" },
        { status: 400 },
      );
    }

    cancelledChatIds.add(chatId);

    // Auto-clear after 30 seconds to prevent memory leaks
    setTimeout(() => {
      cancelledChatIds.delete(chatId);
    }, 30_000);

    return NextResponse.json({ aborted: true, chatId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
});
