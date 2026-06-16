"use client";

/**
 * Phase 23A: Panel Chooser Sheet
 *
 * Shows 7 system presets as a grid of cards.
 * Mobile: vaul drawer from bottom (375px+ safe)
 * Desktop: popover anchored to picker button
 *
 * When user picks a preset, it updates localStorage + parent state.
 */

import { AnimatePresence, motion } from "framer-motion";
import { XIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { Drawer } from "vaul";
import { SYSTEM_PRESETS } from "@/lib/ai/fusion/presets";
import type { PanelPreset } from "@/lib/ai/fusion/types";
import { SCALE_IN, SPRING_BOUNCY } from "@/lib/motion/springs";
import { PanelPresetCard } from "./panel-preset-card";

interface PanelChooserSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPresetId?: string;
  onSelect: (preset: PanelPreset) => void;
  /** If true, render as desktop popover instead of mobile drawer */
  isDesktop?: boolean;
  /** Anchor element for desktop popover positioning */
  anchorRef?: React.RefObject<HTMLElement | null>;
}

export function PanelChooserSheet({
  open,
  onOpenChange,
  selectedPresetId,
  onSelect,
  isDesktop = false,
  anchorRef,
}: PanelChooserSheetProps) {
  const handleSelect = (preset: PanelPreset) => {
    onSelect(preset);
    onOpenChange(false);
  };

  // Desktop: render as popover anchored to picker button
  if (isDesktop) {
    return (
      <AnimatePresence>
        {open && (
          <DesktopPopover
            anchorRef={anchorRef}
            onClose={() => onOpenChange(false)}
            onSelect={handleSelect}
            presets={SYSTEM_PRESETS}
            selectedId={selectedPresetId}
          />
        )}
      </AnimatePresence>
    );
  }

  // Mobile: vaul drawer
  return (
    <Drawer.Root onOpenChange={onOpenChange} open={open} shouldScaleBackground>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 mt-24 flex max-h-[85dvh] flex-col rounded-t-2xl border border-border/30 bg-background">
          {/* Handle */}
          <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-muted-foreground/20" />

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <h2 className="text-[15px] font-semibold">Choose a Panel</h2>
            <button
              aria-label="Close"
              className="flex size-7 items-center justify-center rounded-full bg-muted/50 hover:bg-muted"
              onClick={() => onOpenChange(false)}
              type="button"
            >
              <XIcon className="size-3.5" />
            </button>
          </div>
          <p className="px-5 pb-3 text-[12px] text-muted-foreground">
            Panel mode uses multiple AI models to produce better answers. Pick
            your team.
          </p>

          {/* Preset grid */}
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            <div className="grid grid-cols-1 gap-2.5">
              {SYSTEM_PRESETS.map((preset, i) => (
                <motion.div
                  animate={{ opacity: 1, y: 0 }}
                  initial={{ opacity: 0, y: 12 }}
                  key={preset.name}
                  transition={{ delay: i * 0.04, ...SPRING_BOUNCY }}
                >
                  <PanelPresetCard
                    isSelected={preset.name === selectedPresetId}
                    onClick={() => handleSelect(preset)}
                    preset={preset}
                  />
                </motion.div>
              ))}
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

// ── Desktop Popover ───────────────────────────────────────────────────

function DesktopPopover({
  presets,
  selectedId,
  onSelect,
  onClose,
  anchorRef,
}: {
  presets: PanelPreset[];
  selectedId?: string;
  onSelect: (preset: PanelPreset) => void;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        !anchorRef?.current?.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose, anchorRef]);

  // Close on Escape
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <motion.div
      ref={popoverRef}
      {...SCALE_IN}
      className="absolute bottom-full left-0 mb-2 z-50 w-[320px] rounded-xl border border-border/30 bg-background shadow-xl shadow-black/10"
    >
      <div className="p-3">
        <h3 className="mb-2 text-[13px] font-semibold">Choose a Panel</h3>
        <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto">
          {presets.map((preset) => (
            <PanelPresetCard
              isSelected={preset.name === selectedId}
              key={preset.name}
              onClick={() => onSelect(preset)}
              preset={preset}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
