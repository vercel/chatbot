"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { motion } from "framer-motion";
import { memo } from "react";
import { 
  GlobeIcon, 
  Code2Icon, 
  BookOpenIcon, 
  CloudSunIcon 
} from "lucide-react";
import type { ChatMessage } from "@/lib/types";
import { Suggestion } from "../ai-elements/suggestion";
import type { VisibilityType } from "./visibility-selector";

type SuggestedActionsProps = {
  chatId: string;
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  selectedVisibilityType: VisibilityType;
};

const curatedActions = [
  {
    title: "Explain Next.js",
    description: "Learn about Server Components & the App Router.",
    prompt: "What are the advantages of using Next.js?",
    icon: <GlobeIcon className="size-3.5" />,
  },
  {
    title: "Dijkstra's Algorithm",
    description: "Generate a clean implementation in Python.",
    prompt: "Write code to demonstrate Dijkstra's algorithm",
    icon: <Code2Icon className="size-3.5" />,
  },
  {
    title: "Silicon Valley Essay",
    description: "Outline a historical analysis of technology hubs.",
    prompt: "Help me write an essay about Silicon Valley",
    icon: <BookOpenIcon className="size-3.5" />,
  },
  {
    title: "Weather in San Francisco",
    description: "Check current meteorological conditions.",
    prompt: "What is the weather in San Francisco?",
    icon: <CloudSunIcon className="size-3.5" />,
  },
];

function PureSuggestedActions({ chatId, sendMessage }: SuggestedActionsProps) {
  return (
    <div
      className="flex w-full gap-2.5 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible"
      data-testid="suggested-actions"
      style={{
        scrollbarWidth: "none",
        WebkitOverflowScrolling: "touch",
        msOverflowStyle: "none",
      }}
    >
      {curatedActions.map((action, index) => (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="min-w-[220px] shrink-0 sm:min-w-0 sm:shrink"
          exit={{ opacity: 0, y: 12 }}
          initial={{ opacity: 0, y: 12 }}
          key={action.title}
          transition={{
            delay: 0.05 * index,
            duration: 0.45,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <Suggestion
            className="h-auto w-full flex flex-row items-start gap-3 rounded-xl border border-border/50 bg-card/35 px-3.5 py-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:bg-card/65 hover:border-border/80 hover:shadow-[0_1.5px_6px_rgba(0,0,0,0.02)] dark:hover:shadow-[0_1.5px_6px_rgba(0,0,0,0.15)] group"
            onClick={(suggestion) => {
              window.history.pushState(
                {},
                "",
                `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/chat/${chatId}`
              );
              sendMessage({
                role: "user",
                parts: [{ type: "text", text: suggestion }],
              });
            }}
            suggestion={action.prompt}
          >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-background/50 text-muted-foreground/75 transition-colors group-hover:text-foreground/90 group-hover:border-border/80">
              {action.icon}
            </div>
            <div className="flex flex-col gap-0.5 min-w-0 pr-1">
              <span className="font-medium text-[13px] text-foreground/90 tracking-tight leading-normal">
                {action.title}
              </span>
              <span className="text-[11px] text-muted-foreground/60 leading-normal truncate sm:whitespace-normal">
                {action.description}
              </span>
            </div>
          </Suggestion>
        </motion.div>
      ))}
    </div>
  );
}

export const SuggestedActions = memo(
  PureSuggestedActions,
  (prevProps, nextProps) => {
    if (prevProps.chatId !== nextProps.chatId) {
      return false;
    }
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType) {
      return false;
    }

    return true;
  }
);
