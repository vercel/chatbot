'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ExitWarningModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLeaveSession: () => void;
}

export function ExitWarningModal({
  open,
  onOpenChange,
  onLeaveSession,
}: ExitWarningModalProps) {
  const handleCancel = () => {
    onOpenChange(false);
  };

  const handleLeaveSession = () => {
    onOpenChange(false);
    onLeaveSession();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-[512px] bg-white rounded-[6px] border border-slate-300 p-6">
        <AlertDialogHeader className="gap-2">
          <AlertDialogTitle className="font-serif text-[20px] font-semibold leading-[28px] text-slate-900 text-left">
            Leave this application session?
          </AlertDialogTitle>
          <AlertDialogDescription className="font-sans text-[18px] font-normal leading-[28px] text-black text-left">
            If you start a new application or open another one, your current
            session will end.
            <br />
            <br />
            You&apos;ll be able to view it, but you won&apos;t be able to continue or
            submit the application.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row justify-end gap-2 mt-0">
          <AlertDialogCancel
            onClick={handleCancel}
            className="bg-white border border-slate-200 text-slate-900 text-[14px] font-medium leading-[24px] px-4 py-2 rounded-[6px] hover:bg-slate-50 transition-colors"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleLeaveSession}
            className="bg-[#b14092] text-white text-[14px] font-medium leading-[24px] px-4 py-2 rounded-[6px] hover:bg-[#9a3680] transition-colors border-0"
          >
            Leave session
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

