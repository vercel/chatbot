'use client';

import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { memo } from 'react';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { VisibilityType } from './visibility-selector';
import type { ChatMessage } from '@/lib/types';

interface SuggestedActionsProps {
  chatId: string;
  sendMessage: UseChatHelpers<ChatMessage>['sendMessage'];
  selectedVisibilityType: VisibilityType;
}

function PureSuggestedActions({
  chatId,
  sendMessage,
  selectedVisibilityType,
}: SuggestedActionsProps) {
  const suggestedActions = [
    {
      title: 'Help Rosa Flores',
      label: 'ruhealth.org/appointments/apply-4-wic-form',
      action: 'Help Rosa Flores, date of birth 1988-07-13 apply for WIC at https://www.ruhealth.org/appointments/apply-4-wic-form#. She is pregnant and has a child.',
    },
    {
      title: 'Help Carolina Delgado',
      label: 'riversideihss.org/Home/IHSSApply',
      action: 'Help Carolina Delgado, date of birth 1958-03-25 apply for IHSS at https://riversideihss.org/Home/IHSSApply. She has cancer and needs her daughter to help take care of herself.',
    },
    {
      title: 'Help Daniela Muñoz',
      label: 'ruhealth.org/appointments/apply-4-wic-form',
      action: 'Help Daniela Muñoz, date of birth 2004-03-31 apply WIC at https://www.ruhealth.org/appointments/apply-4-wic-form#. She is pregnant. ',
    },
    {
      title: 'Help Ana Hernández',
      label: 'ruhealth.org/appointments/apply-4-wic-form',
      action: 'Help Ana Hernández, date of birth 1982-04-08 apply for WIC since she is pregnant. Application: https://www.ruhealth.org/appointments/apply-4-wic-form#',
    },
  ];

  return (
    <div
      data-testid="suggested-actions"
      className="grid sm:grid-cols-2 gap-2 w-full"
    >
      {suggestedActions.map((suggestedAction, index) => (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ delay: 0.05 * index }}
          key={`suggested-action-${suggestedAction.title}-${index}`}
          className={index > 1 ? 'hidden sm:block' : 'block'}
        >
          <Button
            variant="ghost"
            onClick={async () => {
              window.history.replaceState({}, '', `/chat/${chatId}`);

              sendMessage({
                role: 'user',
                parts: [{ type: 'text', text: suggestedAction.action }],
              });
            }}
            className="text-left border border-sidebar-border rounded-xl px-4 py-3.5 text-sm flex-1 gap-1 sm:flex-col w-full h-auto justify-start items-start transition-colors duration-200 bg-[#E8D0E0] hover:bg-[#DCC0D0] hover:text-black dark:bg-[#2D1B2E] dark:hover:bg-[#3D2A3E]"
          >
            <span className="font-medium">{suggestedAction.title}</span>
            <span className="text-muted-foreground text-xs font-mono">
              {suggestedAction.label}
            </span>
          </Button>
        </motion.div>
      ))}
    </div>
  );
}

export const SuggestedActions = memo(
  PureSuggestedActions,
  (prevProps, nextProps) => {
    if (prevProps.chatId !== nextProps.chatId) return false;
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType)
      return false;

    return true;
  },
);
