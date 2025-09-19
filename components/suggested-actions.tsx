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
      title: 'Apply Ximena Vargas',
      label: 'ruhealth.org/appointments/apply-4-wic-form',
      action: 'Please apply Ximena Vargas to this WIC benefit: https://www.ruhealth.org/appointments/apply-4-wic-form',
    },
    {
      title: 'Aplica a Yolanda Fuentes',
      label: 'riversideihss.org/IntakeApp',
      action: 'Por favor aplica a Yolanda Fuentes (DOB 30 de octubre 2001) para el beneficio de Riverside IHSS: https://riversideihss.org/IntakeApp',
    },
    {
      title: 'Apply Daniel Scott',
      label: 'riversideihss.org/IntakeApp',
      action: 'Lookup Daniel Scott. His birthday is 3/15/2004. Apply him to IHSS please: https://riversideihss.org/IntakeApp',
    },
    {
      title: 'Aplica a Juan Pacheco',
      label: 'ruhealth.org/appointments/apply-4-wic-form',
      action: 'Por favor aplica a Juan Pacheco para este beneficio de WIC: https://www.ruhealth.org/appointments/apply-4-wic-form',
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
            className="text-left border border-sidebar-border rounded-xl px-4 py-3.5 text-sm flex-1 gap-1 sm:flex-col w-full h-auto justify-start items-start transition-colors duration-200 bg-[#E8D0E0] hover:bg-[#DCC0D0] dark:bg-[#2D1B2E] dark:hover:bg-[#3D2A3E]"
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
