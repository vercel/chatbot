"use client";

/**
 * VpsDispatchButton — Lightning bolt ⚡ button in chat composer.
 *
 * Detects hermes-vps trigger words in the input and enables dispatches.
 * Shows in the PromptInputTools bar alongside Attachments, ModeToggle, etc.
 *
 * When clicked:
 *   1. Captures the current input as the dispatch prompt
 *   2. Opens VpsDispatchModal for confirmation
 *   3. On confirm, fires dispatch → shows VpsProgressCard in chat
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bolt, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { detectVpsTrigger } from "@/playbook-skills/connectors/hermes-vps/actions";
import { VpsDispatchModal } from "./vps-dispatch-modal";
import type { DispatchResult } from "@/playbook-skills/connectors/hermes-vps/actions";

export interface VpsDispatchButtonProps {
  /** Current composer input value */
  input: string;
  /** Chat status from useChat */
  status: string;
  /** Callback when dispatch is confirmed — returns dispatchId for progress card */
  onDispatch?: (dispatchResult: DispatchResult, prompt: string) => void;
  className?: string;
}

export function VpsDispatchButton({
  input,
  status,
  onDispatch,
  className,
}: VpsDispatchButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<DispatchResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Detect if input triggers hermes-vps
  const triggerWord = detectVpsTrigger(input);
  const isActive = status === "ready" && triggerWord !== null && input.trim().length > 0;

  const handleOpen = useCallback(() => {
    if (!isActive) return;
    setIsModalOpen(true);
  }, [isActive]);

  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      setIsModalOpen(false);
      setDispatchResult(null);
    }
  }, [isSubmitting]);

  const handleConfirm = useCallback(
    async (prompt: string) => {
      setIsSubmitting(true);
      try {
        const res = await fetch("/api/hermes-vps/dispatch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, context: input }),
        });

        const result: DispatchResult = await res.json();
        setDispatchResult(result);

        if (result.success) {
          onDispatch?.(result, prompt);
          // Close modal after short delay so user sees success
          setTimeout(() => {
            setIsModalOpen(false);
            setDispatchResult(null);
          }, 1200);
        }
      } catch (err) {
        setDispatchResult({
          success: false,
          error: `Network error: ${err instanceof Error ? err.message : "Unknown"}`,
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [input, onDispatch]
  );

  return (
    <>
      {/* ⚡ Trigger Button */}
      <Button
        className={cn(
          "h-7 rounded-lg px-2 gap-1 text-[12px] transition-all duration-200 border",
          isActive
            ? "border-amber-500/30 text-amber-400 hover:text-amber-300 hover:border-amber-500/50 hover:bg-amber-500/10"
            : "border-border/40 text-muted-foreground/30 cursor-not-allowed",
          className
        )}
        disabled={!isActive}
        onClick={(event) => {
          event.preventDefault();
          handleOpen();
        }}
        title={
          triggerWord
            ? `Dispatch to VPS (trigger: "${triggerWord}")`
            : "Use 'send to vps', 'run on vps', or similar intent words"
        }
        variant="ghost"
      >
        <Zap className="size-3.5" />
        <span className="hidden sm:inline">VPS</span>
      </Button>

      {/* Dispatch Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <VpsDispatchModal
            prompt={input}
            triggerWord={triggerWord}
            dispatchResult={dispatchResult}
            isSubmitting={isSubmitting}
            onConfirm={handleConfirm}
            onClose={handleClose}
          />
        )}
      </AnimatePresence>
    </>
  );
}
