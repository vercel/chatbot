'use client';

import { useState, useCallback } from 'react';
import { useArtifact } from './use-artifact';

/**
 * Hook to manage browser session exit warnings
 * Returns methods to check if navigation should be intercepted
 * and to handle the confirmation flow
 */
export function useBrowserSessionExit() {
  const { artifact, metadata } = useArtifact();
  const [showExitWarning, setShowExitWarning] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  /**
   * Check if there's an active browser session that requires exit warning
   */
  const hasActiveBrowserSession = useCallback(() => {
    return artifact.kind === 'browser' && metadata?.isConnected === true;
  }, [artifact.kind, metadata?.isConnected]);

  /**
   * Intercept navigation and show warning if needed
   * @param action - The navigation action to perform after confirmation
   * @returns boolean - true if navigation should proceed immediately, false if intercepted
   */
  const interceptNavigation = useCallback((action: () => void) => {
    if (hasActiveBrowserSession()) {
      setPendingAction(() => action);
      setShowExitWarning(true);
      return false;
    }
    // No active session, proceed immediately
    action();
    return true;
  }, [hasActiveBrowserSession]);

  /**
   * Handle user confirming they want to leave the session
   */
  const handleConfirmLeave = useCallback(() => {
    setShowExitWarning(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  }, [pendingAction]);

  /**
   * Handle user canceling the exit
   */
  const handleCancelLeave = useCallback(() => {
    setShowExitWarning(false);
    setPendingAction(null);
  }, []);

  return {
    showExitWarning,
    setShowExitWarning,
    hasActiveBrowserSession: hasActiveBrowserSession(),
    interceptNavigation,
    handleConfirmLeave,
    handleCancelLeave,
  };
}

