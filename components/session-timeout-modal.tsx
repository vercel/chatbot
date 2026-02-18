'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// SessionTimeoutModal
// ---------------------------------------------------------------------------

interface SessionTimeoutModalProps {
  /** Whether the dialog is visible. */
  open: boolean;
  /** Called when the dialog open state changes. */
  onOpenChange: (open: boolean) => void;
  /**
   * Initial countdown duration **in seconds**.
   * The timer starts counting down from this value when the dialog opens.
   */
  countdownSeconds: number;
  /** Called when the user clicks "End session" or the countdown reaches 0. */
  onEndSession: () => void;
  /** Called when the user clicks "Continue session". */
  onContinueSession: () => void;
}

export function SessionTimeoutModal({
  open,
  onOpenChange,
  countdownSeconds,
  onEndSession,
  onContinueSession,
}: SessionTimeoutModalProps) {
  const [remaining, setRemaining] = useState(countdownSeconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset and start timer whenever the dialog opens.
  useEffect(() => {
    if (!open) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setRemaining(countdownSeconds);
      return;
    }

    setRemaining(countdownSeconds);

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          onEndSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleEndSession = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    onOpenChange(false);
    onEndSession();
  };

  const handleContinueSession = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    onOpenChange(false);
    onContinueSession();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[480px] bg-card rounded-[6px] border border-border p-0 gap-0"
      >
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="font-sans text-[16px] font-bold leading-[24px] text-card-foreground text-left">
            Your session is ending soon
          </DialogTitle>

          <p
            className="font-sans text-[56px] font-light leading-[64px] text-card-foreground text-left mt-1"
            aria-live="polite"
            aria-atomic="true"
          >
            {formatTime(remaining)}
          </p>
        </DialogHeader>

        <div className="h-px bg-border mx-6" />

        <DialogDescription className="px-6 pt-4 pb-2 font-sans text-[14px] font-normal leading-[22px] text-foreground text-left">
          To keep the system running smoothly, sessions end after inactivity.
          Select <strong className="font-bold text-foreground">Continue session</strong> to keep
          working.
        </DialogDescription>

        <DialogFooter className="px-6 pb-6 pt-3 flex-row justify-end gap-3">
          <Button
            variant="outline"
            onClick={handleEndSession}
            className="border border-border bg-card text-card-foreground text-[14px] font-medium leading-[24px] px-5 py-2 rounded-[6px] hover:bg-secondary/80 transition-colors"
          >
            End session
          </Button>
          <Button
            onClick={handleContinueSession}
            className="bg-primary text-primary-foreground text-[14px] font-medium leading-[24px] px-5 py-2 rounded-[6px] hover:bg-primary/90 transition-colors border-0"
          >
            Continue session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// SessionTimeoutModalDemo  –  test harness with a 5-minute countdown
// TODO: remove this before production.
// ---------------------------------------------------------------------------

export function SessionTimeoutModalDemo() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center justify-center p-8">
      <Button
        onClick={() => setOpen(true)}
        variant="outline"
        className="text-[14px] font-medium"
      >
        Test timeout modal (5 min)
      </Button>

      <SessionTimeoutModal
        open={open}
        onOpenChange={setOpen}
        countdownSeconds={300}
        onEndSession={() => {
          setOpen(false);
          // Replace with your real end-session logic.
          console.log('Session ended');
        }}
        onContinueSession={() => {
          setOpen(false);
          // Replace with your real continue-session logic.
          console.log('Session continued');
        }}
      />
    </div>
  );
}
