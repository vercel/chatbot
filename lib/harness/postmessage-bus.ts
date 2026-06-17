/**
 * PostMessageBus — Bidirectional Communication between Neptune Chat & Twenty CRM
 *
 * Phase 29: Neptune Command Center UI (Stream 2)
 *
 * ARCHITECTURE:
 *   Neptune Chat (parent) ←→ postMessage ←→ Twenty CRM (iframe)
 *
 * SECURITY:
 *   Strict origin verification — only messages from allowed origins are processed.
 *   Rejected origins are logged but never acted upon.
 *
 * COMMANDS (Chat → Twenty):
 *   navigate(path)     — Routes Twenty iframe to a path
 *   refresh(objectType) — Reloads list view for given object
 *   highlight(recordId) — Visual highlight + scroll-to in Twenty
 *   showActivity(id)  — Opens activity drawer in Twenty
 *
 * EVENTS (Twenty → Chat):
 *   contextChanged(record)   — Current record changed
 *   actionRequested(action, payload) — User triggered an action
 *   recordOpened(record)     — A record was opened
 *   fieldEdited(field, value) — A field was edited
 */

// ── Types ──────────────────────────────────────────────────────────────

export type CommandType = "navigate" | "refresh" | "highlight" | "showActivity";

export type EventType =
  | "contextChanged"
  | "actionRequested"
  | "recordOpened"
  | "fieldEdited";

export interface CommandMessage {
  source: "neptune-chat";
  type: "command";
  command: CommandType;
  payload?: Record<string, unknown>;
  timestamp: string;
}

export interface EventMessage {
  source: "twenty-crm";
  type: "event";
  event: EventType;
  payload?: Record<string, unknown>;
  timestamp: string;
}

export interface TwentyEvent {
  type: EventType;
  payload?: Record<string, unknown>;
}

type MessageHandler = (event: TwentyEvent) => void;

// ── Allowed Origins ────────────────────────────────────────────────────

const ALLOWED_ORIGINS: string[] = [
  "https://app.crm.newleaf.financial",
  "https://crm.newleaf.financial",
  "https://neptune-chat-ashy.vercel.app",
  "https://neptune.newleaf.financial",
  // Development
  "http://localhost:3002",
  "http://localhost:3000",
];

// ── Origin Verification ────────────────────────────────────────────────

function isValidOrigin(origin: string): boolean {
  return ALLOWED_ORIGINS.some(
    (allowed) => origin === allowed || (allowed.endsWith(":") && origin.startsWith(allowed))
  );
}

// ── PostMessageBus Class ───────────────────────────────────────────────

export class PostMessageBus {
  private targetOrigin: string;
  private handlers: Set<MessageHandler> = new Set();
  private boundHandleMessage: (event: MessageEvent) => void;

  constructor(targetOrigin: string) {
    this.targetOrigin = targetOrigin;
    this.boundHandleMessage = this.handleMessage.bind(this);
    window.addEventListener("message", this.boundHandleMessage);
  }

  // ── Public API ──────────────────────────────────────────────────

  /**
   * Send a command to the Twenty iframe
   */
  sendCommand(command: CommandType, payload?: Record<string, unknown>): void {
    const message: CommandMessage = {
      source: "neptune-chat",
      type: "command",
      command,
      payload,
      timestamp: new Date().toISOString(),
    };

    // Target the iframe via window.frames or postMessage to all frames
    // In practice, this goes to window.parent.frames[0] for the Twenty iframe
    window.postMessage(message, this.targetOrigin);
  }

  /**
   * Register an event listener for Twenty events
   * Returns an unsubscribe function
   */
  onEvent(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  /**
   * Send a response event back to Twenty (for acknowledgments)
   */
  sendResponse(
    event: EventType,
    payload?: Record<string, unknown>
  ): void {
    const message: EventMessage = {
      source: "neptune-chat",
      type: "event",
      event,
      payload,
      timestamp: new Date().toISOString(),
    };
    window.postMessage(message, this.targetOrigin);
  }

  /**
   * Cleanup — remove message listener
   */
  destroy(): void {
    window.removeEventListener("message", this.boundHandleMessage);
    this.handlers.clear();
  }

  // ── Internal ────────────────────────────────────────────────────

  private handleMessage(event: MessageEvent): void {
    // Strict origin verification
    if (!isValidOrigin(event.origin)) {
      console.warn(
        `[PostMessageBus] Rejected message from untrusted origin: ${event.origin}`
      );
      return;
    }

    // Validate message structure
    const data = event.data;
    if (!data || typeof data !== "object") return;
    if (data.source !== "twenty-crm") return;
    if (data.type !== "event") return;
    if (!data.event) return;

    const twentyEvent: TwentyEvent = {
      type: data.event as EventType,
      payload: data.payload as Record<string, unknown> | undefined,
    };

    // Notify all registered handlers
    for (const handler of this.handlers) {
      try {
        handler(twentyEvent);
      } catch (err) {
        console.error("[PostMessageBus] Handler error:", err);
      }
    }
  }
}

// ── Twenty Iframe PostMessage Shim ─────────────────────────────────────
//
// This shim should be injected into Twenty CRM as a custom UI extension.
// It listens for commands from Neptune Chat and emits events back.
//
// File: twenty-newleaf-extensions/src/extensions/postmessage-shim.ts
//
// ```typescript
// // Twenty PostMessage Shim — listens for Neptune commands, emits Twenty events
//
// const NEPTUNE_ORIGIN = "https://neptune-chat-ashy.vercel.app";
//
// function isValidNeptuneOrigin(origin: string): boolean {
//   const allowed = [
//     "https://neptune-chat-ashy.vercel.app",
//     "https://neptune.newleaf.financial",
//     "http://localhost:3000",
//   ];
//   return allowed.some((a) => origin === a || origin.startsWith(a));
// }
//
// function emitEvent(event: string, payload?: Record<string, unknown>) {
//   window.parent.postMessage(
//     {
//       source: "twenty-crm",
//       type: "event",
//       event,
//       payload,
//       timestamp: new Date().toISOString(),
//     },
//     NEPTUNE_ORIGIN
//   );
// }
//
// // Listen for commands from Neptune
// window.addEventListener("message", (event) => {
//   if (!isValidNeptuneOrigin(event.origin)) return;
//   const data = event.data;
//   if (!data || data.source !== "neptune-chat" || data.type !== "command") return;
//
//   switch (data.command) {
//     case "navigate":
//       if (data.payload?.path) {
//         window.location.hash = data.payload.path;
//       }
//       break;
//     case "refresh":
//       window.location.reload();
//       break;
//     case "highlight":
//       // Twenty-specific: scroll to and highlight a record
//       if (data.payload?.recordId) {
//         const el = document.querySelector(`[data-record-id="${data.payload.recordId}"]`);
//         if (el) {
//           el.scrollIntoView({ behavior: "smooth", block: "center" });
//           el.classList.add("ring-2", "ring-primary");
//           setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 3000);
//         }
//       }
//       break;
//     case "showActivity":
//       // Twenty-specific: open activity drawer
//       if (data.payload?.activityId) {
//         // Dispatch to Twenty's internal state management
//         window.dispatchEvent(
//           new CustomEvent("twenty:showActivity", {
//             detail: { activityId: data.payload.activityId },
//           })
//         );
//       }
//       break;
//   }
// });
//
// // Hook into Twenty's internal navigation to emit context changes
// // (This requires accessing Twenty's router/history — implementation depends on Twenty version)
// export function initPostMessageShim() {
//   // Listen for record opens
//   window.addEventListener("twenty:recordOpened", ((e: CustomEvent) => {
//     emitEvent("recordOpened", { record: e.detail });
//   }) as EventListener);
//
//   // Listen for field edits
//   window.addEventListener("twenty:fieldEdited", ((e: CustomEvent) => {
//     emitEvent("fieldEdited", { field: e.detail.field, value: e.detail.value });
//   }) as EventListener);
// }
// ```
