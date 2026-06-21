/**
 * Hermes VPS Dispatch Connector — barrel exports
 *
 * @module hermes-vps
 */
export { HermesVpsClient, getHermesVpsClient } from "./client";
export {
  dispatchToVps,
  pollVpsDispatch,
  cancelVpsDispatch,
  smartPollLoop,
  quickDispatch,
  detectVpsTrigger,
  isQuickFix,
  TRIGGER_WORDS,
  POLL_INTERVAL_MS,
  MAX_POLL_ATTEMPTS,
  JARVIS_ADMIN_CHANNEL,
} from "./actions";
export type {
  DispatchInput,
  DispatchResult,
  PollResult,
  CancelResult,
  HermesVpsClientConfig,
  SmartPollOptions,
  QuickDispatchOptions,
} from "./actions";
