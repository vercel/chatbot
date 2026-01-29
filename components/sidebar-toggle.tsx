import type { ComponentProps } from 'react';

import { type SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { SidebarLeftIcon } from './icons';
import { Button } from './ui/button';
import { useArtifact } from '@/hooks/use-artifact';
import { cn } from '@/lib/utils';

export function SidebarToggle({
  className,
}: ComponentProps<typeof SidebarTrigger>) {
  const { toggleSidebar } = useSidebar();
  const { metadata, artifact } = useArtifact();
  
  // Check if browser artifact sheet is open
  const isSheetOpen = artifact.kind === 'browser' && metadata?.isSheetOpen;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          data-testid="sidebar-toggle-button"
          onClick={toggleSidebar}
          variant="outline"
          className={cn(
            "md:px-2 md:h-fit hover:bg-accent",
            isSheetOpen && "opacity-30 cursor-not-allowed pointer-events-auto bg-gray-100 dark:bg-gray-800"
          )}
        >
          <SidebarLeftIcon size={16} />
        </Button>
      </TooltipTrigger>
      <TooltipContent align="start" side="bottom" sideOffset={8}>
        Toggle sidebar
      </TooltipContent>
    </Tooltip>
  );
}
