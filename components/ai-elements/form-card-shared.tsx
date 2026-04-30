'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type CardShellProps = {
  children: ReactNode;
  variant: 'cta' | 'detail';
  className?: string;
};

// Inline shell used in the chat thread. `cta` = pink/accent summary card,
// `detail` = white card (used inside the modal or for non-CTA chat states
// like "Information submitted" / "Skipped for now"). Modal expansion is
// handled by the `Modal` component below.
export function CardShell({ children, variant, className }: CardShellProps) {
  const baseCls =
    variant === 'cta'
      ? 'relative rounded-2xl border overflow-hidden bg-[hsl(318_50%_97%)] border-[hsl(320_47%_85%)]'
      : 'relative bg-white rounded-2xl border border-border overflow-hidden shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.04)]';
  return <div className={cn(baseCls, className)}>{children}</div>;
}

type ModalProps = {
  children: ReactNode;
  onCollapse: () => void;
};

// Full-screen modal portaled to document.body so the overlay covers the
// chat panel + the artifact pane. Backdrop click and ESC both call
// onCollapse. The wrapper allows up to 90vh; children are typically a
// CardShell sized to a fixed height (e.g. 70vh) with their own internal
// scroll between a sticky header and footer.
export function Modal({ children, onCollapse }: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCollapse();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCollapse]);

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[rgba(16,24,40,0.45)]"
      onClick={onCollapse}
    >
      {/* biome-ignore lint/nursery/noStaticElementInteractions: stopPropagation keeps clicks inside the content wrapper from closing the modal */}
      <div
        className="w-full max-w-[640px] max-h-[90vh] overflow-y-auto rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

type SectionHeaderProps = {
  title: string;
  eyebrow?: string;
  onClose?: () => void;
};

export function SectionHeader({ title, eyebrow, onClose }: SectionHeaderProps) {
  return (
    <div className="px-5 pt-5 pb-3 border-b border-border flex items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[12px] font-inter text-muted-foreground mb-1">{eyebrow}</div>
        )}
        {title && (
          <h3 className="font-source-serif text-[22px] font-semibold text-foreground">
            {title}
          </h3>
        )}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-1 -mt-1 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}

type ProgressDotsProps = {
  ids: string[];
  current: number;
};

// Pill-shaped active dot (w-6) and round inactive dots (w-2). Dots are
// non-interactive in the modal footer; navigation happens via Back/Next.
export function ProgressDots({ ids, current }: ProgressDotsProps) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {ids.map((id, i) => (
        <div
          key={id}
          aria-hidden="true"
          className={cn(
            'h-2 rounded-full transition-all',
            i === current ? 'w-6 bg-primary' : 'w-2 bg-[hsl(220_13%_86%)]',
          )}
        />
      ))}
    </div>
  );
}

type FieldSourceBadgeProps = {
  source: 'database' | 'caseworker' | 'inferred' | 'missing';
  required?: boolean;
  inferredFrom?: string;
};

// Maps the four-value source enum to a design pill variant + a tooltip
// explaining what the source means. The `database` label keeps the
// Nava-specific "Apricot 360" wording.
export function FieldSourceBadge({ source, required, inferredFrom }: FieldSourceBadgeProps) {
  const baseCls =
    'text-[10px] font-normal uppercase font-mono tracking-wider px-2.5 py-1 rounded-full whitespace-nowrap cursor-default';

  let label: string;
  let toneCls: string;
  let tooltip: string;

  if (source === 'missing') {
    if (required) {
      label = 'Required';
      toneCls = 'bg-red-50 text-red-700 border border-red-200';
      tooltip = 'Required to submit.';
    } else {
      label = 'Optional';
      toneCls = 'bg-stone-100 text-zinc-600';
      tooltip = 'Not required to submit.';
    }
  } else if (source === 'inferred') {
    label = 'Autofilled';
    toneCls = 'bg-[hsl(318_50%_93%)] text-[hsl(320_47%_47%)]';
    tooltip = inferredFrom ? `Filled by AI; based on ${inferredFrom}.` : 'Filled by AI.';
  } else if (source === 'database') {
    label = 'Apricot 360';
    toneCls = 'bg-stone-100 text-zinc-600';
    tooltip = 'Filled in automatically from Apricot 360.';
  } else {
    label = 'Manual';
    toneCls = 'bg-stone-100 text-zinc-600';
    tooltip = 'Entered by you.';
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn(baseCls, toneCls)}>{label}</span>
        </TooltipTrigger>
        <TooltipContent align="end">{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

type SectionFooterProps = {
  current: number;
  sectionIds: string[];
  onPrev: () => void;
  onNext: () => void;
  isLast: boolean;
  rightSlot?: ReactNode;
};

// Sticky bottom bar inside the detail modal: Back | dots | Next/right slot.
// `rightSlot` renders on the last section (typically a Submit or Done
// button). On non-last sections, Next is shown automatically.
export function SectionFooter({ current, sectionIds, onPrev, onNext, isLast, rightSlot }: SectionFooterProps) {
  return (
    <div className="px-5 py-4 border-t border-border grid grid-cols-3 items-center gap-3 bg-white sticky bottom-0">
      <button
        type="button"
        onClick={onPrev}
        className="justify-self-start flex items-center gap-1.5 text-[14px] font-semibold px-4 py-2.5 rounded-full border border-border hover:bg-muted"
      >
        <ChevronLeft size={14} /> Back
      </button>
      <ProgressDots ids={sectionIds} current={current} />
      <div className="justify-self-end flex items-center gap-2">
        {isLast ? (
          rightSlot
        ) : (
          <button
            type="button"
            onClick={onNext}
            className="flex items-center gap-1.5 text-[14px] font-semibold px-5 py-2.5 rounded-full border border-border hover:bg-muted"
          >
            Next <ChevronRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// Filled circle with a white check inside, matching the design mockup.
// Used in success-state CTAs alongside primary-colored copy.
export function CheckCircleFilled({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path
        d="m9 12 2 2 4-4"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
