'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type CardShellProps = {
  children: ReactNode;
  expanded: boolean;
  onCollapse?: () => void;
  variant: 'cta' | 'detail';
};

// CardShell renders the outer container in two visual variants.
// `cta` = pink/accent summary used on the chat thread.
// `detail` = white card used inside the modal overlay.
// When `expanded` is true, the card is portaled to document.body and mounted
// inside a fixed full-page overlay with a backdrop; clicking the backdrop or
// pressing ESC calls onCollapse. The portal is required because the chat
// layout has transformed/filtered ancestors that would otherwise trap a
// `fixed` element inside the chat panel.
export function CardShell({ children, expanded, onCollapse, variant }: CardShellProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCollapse?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded, onCollapse]);

  const shellCls =
    variant === 'cta'
      ? 'relative rounded-2xl border overflow-hidden bg-[hsl(318_50%_97%)] border-[hsl(320_47%_85%)]'
      : 'relative bg-white rounded-2xl border border-border overflow-hidden';

  const shell = <div className={shellCls}>{children}</div>;

  if (!expanded) return shell;

  const overlay = (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[rgba(16,24,40,0.45)]"
      onClick={onCollapse}
    >
      {/* biome-ignore lint/nursery/noStaticElementInteractions: stopPropagation keeps clicks inside the content wrapper from closing the modal */}
      <div
        className="w-full max-w-[640px] max-h-full overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {shell}
      </div>
    </div>
  );

  return (
    <>
      <div aria-hidden="true" className="opacity-0 pointer-events-none">
        {shell}
      </div>
      {mounted ? createPortal(overlay, document.body) : null}
    </>
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
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
            {eyebrow}
          </div>
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
  onJump: (i: number) => void;
};

export function ProgressDots({ ids, current, onJump }: ProgressDotsProps) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {ids.map((id, i) => (
        <button
          key={id}
          type="button"
          onClick={() => onJump(i)}
          aria-label={`Go to section ${i + 1}`}
          aria-current={i === current ? 'step' : undefined}
          className={cn(
            'w-2 h-2 rounded-full transition-colors',
            i === current
              ? 'bg-primary'
              : 'bg-[hsl(220_13%_86%)] hover:bg-[hsl(220_13%_72%)]',
          )}
        />
      ))}
    </div>
  );
}

type FieldSourceBadgeProps = {
  source: 'database' | 'caseworker' | 'inferred' | 'missing';
  required?: boolean;
};

// Maps the existing four-value source enum to the design's pill variants.
// Database keeps the Nava-specific "Apricot 360" label.
export function FieldSourceBadge({ source, required }: FieldSourceBadgeProps) {
  if (source === 'missing') {
    if (required) {
      return (
        <span className="text-[10px] font-medium uppercase tracking-wider font-mono whitespace-nowrap px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
          Required
        </span>
      );
    }
    return (
      <span className="text-[10px] font-medium uppercase tracking-wider font-mono whitespace-nowrap px-2.5 py-1 rounded-full bg-stone-100 text-zinc-700">
        Optional
      </span>
    );
  }
  if (source === 'inferred') {
    return (
      <span className="text-[10px] font-medium uppercase tracking-wider font-mono whitespace-nowrap px-2.5 py-1 rounded-full bg-[hsl(318_50%_93%)] text-primary">
        Auto-filled
      </span>
    );
  }
  if (source === 'database') {
    return (
      <span className="text-[10px] font-medium uppercase tracking-wider font-mono whitespace-nowrap px-2.5 py-1 rounded-full bg-stone-100 text-zinc-700">
        Apricot 360
      </span>
    );
  }
  // caseworker
  return (
    <span className="text-[10px] font-medium uppercase tracking-wider font-mono whitespace-nowrap px-2.5 py-1 rounded-full bg-stone-100 text-zinc-700">
      Manual
    </span>
  );
}

type ModalNavBarProps = {
  current: number;
  sectionIds: string[];
  onPrev: () => void;
  onNext: () => void;
  onJump: (i: number) => void;
  isLast: boolean;
  rightSlot?: ReactNode;
};

// Sticky bottom bar inside the detail modal: Back | dots | Next/right slot.
// `rightSlot` lets the caller render the Submit button on the last section
// (or render nothing in read-only mode).
export function ModalNavBar({ current, sectionIds, onPrev, onNext, onJump, isLast, rightSlot }: ModalNavBarProps) {
  return (
    <div className="px-5 py-4 border-t border-border grid grid-cols-3 items-center gap-3 bg-white sticky bottom-0">
      <button
        type="button"
        onClick={onPrev}
        className="justify-self-start flex items-center gap-1.5 text-[14px] font-semibold px-4 py-2.5 rounded-full border border-border hover:bg-muted"
      >
        <ChevronLeft size={14} /> Back
      </button>
      <ProgressDots ids={sectionIds} current={current} onJump={onJump} />
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
