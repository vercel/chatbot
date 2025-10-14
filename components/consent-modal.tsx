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

interface ConsentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: () => void;
}

export function ConsentModal({ open, onOpenChange, onContinue }: ConsentModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md bg-[#ece6f0] rounded-[28px] border-0">
        <AlertDialogHeader className="px-6 pt-6 pb-0">
          <AlertDialogTitle className="text-[24px] font-normal text-[#1d1b20] leading-[32px] text-left">
            You will be redirected to the home screen
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[14px] text-[#49454f] leading-[20px] tracking-[0.25px] text-left mt-4">
            Client consent is required to use the agentic submission tool.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="px-6 pb-6 pt-5 flex-row justify-end gap-2">
          <AlertDialogCancel 
            onClick={() => onOpenChange(false)}
            className="bg-transparent border-0 text-[#b14092] text-[14px] font-medium px-4 py-2 rounded-[100px] hover:bg-[#b14092]/10 transition-colors"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={() => {
              onOpenChange(false);
              onContinue();
            }}
            className="bg-transparent border-0 text-[#b14092] text-[14px] font-medium px-4 py-2 rounded-[100px] hover:bg-[#b14092]/10 transition-colors"
          >
            Continue
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
