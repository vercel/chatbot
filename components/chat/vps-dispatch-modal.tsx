"use client";

/**
 * VpsDispatchModal — confirmation dialog before dispatching to VPS.
 *
 * Shows:
 *   - The detected trigger word
 *   - The full prompt text (editable)
 *   - Config summary (profile: deepseek-v4-pro, runtime: claude_sdk, maxTurns: 60)
 *   - Confirm / Cancel buttons
 *   - Success/error state after dispatch
 *
 * Uses the same glassmorphism design as SendToV2 modal.
 */

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Bolt, X, Zap, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DispatchResult } from "@/playbook-skills/connectors/hermes-vps/actions";

export interface VpsDispatchModalProps {
  prompt: string;
  triggerWord: string | null;
  dispatchResult: DispatchResult | null;
  isSubmitting: boolean;
  onConfirm: (prompt: string) => void;
  onClose: () => void;
}

export function VpsDispatchModal({
  prompt,
  triggerWord,
  dispatchResult,
  isSubmitting,
  onConfirm,
  onClose,
}: VpsDispatchModalProps) {
  const [editedPrompt, setEditedPrompt] = useState(prompt);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditedPrompt(prompt);
  }, [prompt]);

  // Auto-focus textarea
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isSubmitting) {
      onClose();
    }
  };

  const hasResult = dispatchResult !== null;
  const isSuccess = hasResult && dispatchResult.success;
  const isError = hasResult && !dispatchResult.success;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={handleBackdrop}
      />

      {/* Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div
          className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0A0A0F]/95 backdrop-blur-xl
                      shadow-[0_16px_64px_rgba(0,0,0,0.4)] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/5">
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Zap className="size-3.5 text-amber-400" />
              </div>
              <div>
                <span className="text-sm font-semibold text-white/90 block">
                  Dispatch to VPS
                </span>
                {triggerWord && (
                  <span className="text-[10px] text-white/30">
                    Trigger: &ldquo;{triggerWord}&rdquo;
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80"
              disabled={isSubmitting}
            >
              <X className="size-4" />
            </button>
          </div>

          {isSuccess ? (
            /* ✅ Success state */
            <div className="p-6 text-center space-y-3">
              <div className="size-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                <CheckCircle2 className="size-6 text-emerald-400" />
              </div>
              <p className="text-sm text-white/80">
                Task dispatched!
              </p>
              <p className="text-xs text-white/30 font-mono">
                {dispatchResult.dispatchId}
              </p>
            </div>
          ) : isError ? (
            /* ❌ Error state */
            <div className="p-6 text-center space-y-3">
              <div className="size-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
                <AlertTriangle className="size-6 text-red-400" />
              </div>
              <p className="text-sm text-red-400">
                Dispatch failed
              </p>
              <p className="text-xs text-white/40">
                {dispatchResult.error}
              </p>
              <button
                onClick={onClose}
                className="block w-full mt-2 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60 hover:bg-white/10"
              >
                Close
              </button>
            </div>
          ) : (
            /* 📝 Prompt input state */
            <div className="p-4 space-y-4">
              {/* Prompt textarea */}
              <div>
                <label className="text-[10px] font-medium text-white/40 uppercase tracking-wider mb-2 block">
                  Task Prompt
                </label>
                <textarea
                  ref={textareaRef}
                  value={editedPrompt}
                  onChange={(e) => setEditedPrompt(e.target.value)}
                  className={cn(
                    "w-full min-h-[80px] max-h-[200px] p-3 rounded-xl text-sm",
                    "bg-white/[0.03] border border-white/10",
                    "text-white/80 placeholder:text-white/20",
                    "resize-none focus:outline-none focus:border-amber-500/30 focus:bg-white/[0.05]",
                    "transition-colors"
                  )}
                  placeholder="Describe the task to run on VPS..."
                  disabled={isSubmitting}
                />
              </div>

              {/* Config summary */}
              <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/30">Profile</span>
                  <span className="text-white/60 font-mono">deepseek-v4-pro</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/30">Runtime</span>
                  <span className="text-white/60 font-mono">claude_sdk</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/30">Max Turns</span>
                  <span className="text-white/60 font-mono">60</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/30">Target</span>
                  <span className="text-white/60 font-mono">/home/hermes/</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-white/10
                             text-white/50 hover:text-white/80 hover:bg-white/[0.04] transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => onConfirm(editedPrompt)}
                  disabled={isSubmitting || !editedPrompt.trim()}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2",
                    editedPrompt.trim() && !isSubmitting
                      ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-[0_4px_16px_rgba(245,158,11,0.25)]"
                      : "bg-white/5 text-white/20 cursor-not-allowed"
                  )}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Dispatching...
                    </>
                  ) : (
                    <>
                      <Zap className="size-4" />
                      Dispatch to VPS
                    </>
                  )}
                </button>
              </div>

              {/* Cardinal reminder */}
              <p className="text-[10px] text-white/15 text-center">
                Slack #jarvis-admin C0AQDDC3HAB only · &lt;60 turns · Ephemeral
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}
