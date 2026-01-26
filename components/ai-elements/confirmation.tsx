'use client';

import * as React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ApprovalState {
  id: string;
  approved?: boolean;
}

export type ConfirmationState = 'approval-requested' | 'approval-responded' | 'output-denied' | 'output-available';

type ConfirmationContextType = {
  approval?: ApprovalState;
  state?: ConfirmationState;
};

const ConfirmationContext = React.createContext<ConfirmationContextType | undefined>(undefined);

const useConfirmationContext = () => {
  const context = React.useContext(ConfirmationContext);
  if (!context) {
    throw new Error('Confirmation components must be used within <Confirmation>');
  }
  return context;
};

interface ConfirmationProps extends React.ComponentProps<typeof Alert> {
  approval?: ApprovalState;
  state?: ConfirmationState;
  children: React.ReactNode;
}

export function Confirmation({ approval, state, className, children, ...props }: ConfirmationProps) {
  return (
    <ConfirmationContext.Provider value={{ approval, state }}>
      <Alert
        className={cn(
          'bg-[rgba(245,228,240,0.25)] border-[#f5e4f0] dark:bg-[rgba(245,228,240,0.1)]',
          className
        )}
        {...props}
      >
        {children}
      </Alert>
    </ConfirmationContext.Provider>
  );
}

interface ConfirmationRequestProps {
  children: React.ReactNode;
}

export function ConfirmationRequest({ children }: ConfirmationRequestProps) {
  const { state } = useConfirmationContext();
  
  if (state !== 'approval-requested') {
    return null;
  }

  return <AlertDescription className="mb-4">{children}</AlertDescription>;
}

interface ConfirmationAcceptedProps {
  children: React.ReactNode;
}

export function ConfirmationAccepted({ children }: ConfirmationAcceptedProps) {
  const { approval, state } = useConfirmationContext();
  
  if (!approval?.approved || (state !== 'approval-responded' && state !== 'output-available')) {
    return null;
  }

  return (
    <AlertDescription className="flex items-center gap-2 text-green-600 dark:text-green-400">
      {children}
    </AlertDescription>
  );
}

interface ConfirmationRejectedProps {
  children: React.ReactNode;
}

export function ConfirmationRejected({ children }: ConfirmationRejectedProps) {
  const { approval, state } = useConfirmationContext();
  
  if (approval?.approved !== false || state !== 'output-denied') {
    return null;
  }

  return (
    <AlertDescription className="flex items-center gap-2 text-red-600 dark:text-red-400">
      {children}
    </AlertDescription>
  );
}

interface ConfirmationActionsProps extends React.ComponentProps<'div'> {
  children: React.ReactNode;
}

export function ConfirmationActions({ className, children, ...props }: ConfirmationActionsProps) {
  const { state } = useConfirmationContext();
  
  if (state !== 'approval-requested') {
    return null;
  }

  return (
    <div className={cn('flex gap-2 mt-4', className)} {...props}>
      {children}
    </div>
  );
}

interface ConfirmationActionProps extends React.ComponentProps<typeof Button> {}

export function ConfirmationAction({ className, variant = 'default', ...props }: ConfirmationActionProps) {
  return (
    <Button
      className={cn(
        variant === 'default' && 'bg-[#a11e83] hover:bg-[#a11e83]/90 text-white',
        className
      )}
      variant={variant}
      {...props}
    />
  );
}
