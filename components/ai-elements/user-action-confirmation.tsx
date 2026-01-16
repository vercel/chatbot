'use client';

import { MousePointerClick, CheckIcon, XIcon } from 'lucide-react';
import {
  Confirmation,
  ConfirmationRequest,
  ConfirmationAccepted,
  ConfirmationRejected,
  ConfirmationActions,
  ConfirmationAction,
  ConfirmationState,
  ApprovalState,
} from './confirmation';

interface UserActionConfirmationProps {
  approval?: ApprovalState;
  state?: ConfirmationState;
  requestTitle?: string;
  requestMessage: string;
  acceptedMessage?: string;
  rejectedMessage?: string;
  onApprove: (approvalId: string) => void;
  onReject?: (approvalId: string) => void;
}

export function UserActionConfirmation({
  approval,
  state = 'approval-requested',
  requestTitle = 'Action required',
  requestMessage,
  acceptedMessage = 'You approved this action',
  rejectedMessage = 'You rejected this action',
  onApprove,
  onReject,
}: UserActionConfirmationProps) {
  return (
    <Confirmation approval={approval} state={state}>
      <ConfirmationRequest>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-px">
            <div className="font-serif font-normal leading-[1.5] text-[14px] text-[#171717]">
              <p className="font-bold mb-[14px]">{requestTitle}</p>
              <p>{requestMessage}</p>
            </div>
          </div>
        </div>
      </ConfirmationRequest>

      <ConfirmationAccepted>
        <CheckIcon className="w-4 h-4" />
        <span>{acceptedMessage}</span>
      </ConfirmationAccepted>

      <ConfirmationRejected>
        <XIcon className="w-4 h-4" />
        <span>{rejectedMessage}</span>
      </ConfirmationRejected>

      <ConfirmationActions>
        {onReject && (
          <ConfirmationAction
            variant="outline"
            onClick={() => approval?.id && onReject(approval.id)}
          >
            Reject
          </ConfirmationAction>
        )}
        <ConfirmationAction
          variant="default"
          onClick={() => approval?.id && onApprove(approval.id)}
        >
          <MousePointerClick className="w-[13.25px] h-[13.25px] mr-2" />
          <span className="font-inter font-medium text-[14px] leading-[1.5] tracking-[0.07px]">
            Take control
          </span>
        </ConfirmationAction>
      </ConfirmationActions>
    </Confirmation>
  );
}
