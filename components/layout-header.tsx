'use client';

import { useRouter } from 'next/navigation';
import { PlusIcon, SidebarLeftIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { closeArtifact, useArtifact } from '@/hooks/use-artifact';

export function LayoutHeader() {
  const { state, toggleSidebar } = useSidebar();
  const router = useRouter();
  const { setArtifact } = useArtifact();

  // Don't show the component when sidebar is expanded
  if (state === 'expanded') {
    return null;
  }

  const handleNewChat = () => {
    closeArtifact(setArtifact);
    router.push('/home');
    router.refresh();
  };

  return (
    <div className="fixed left-0 top-0 w-[50px] h-screen bg-sidebar flex flex-col items-center py-4 gap-4 z-50">
      {/* Sidebar Toggle Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            data-testid="sidebar-toggle-button"
            onClick={toggleSidebar}
            variant="outline"
            className="w-8 h-8 p-0 bg-background border-sidebar-border hover:bg-custom-purple/20"
          >
            <SidebarLeftIcon size={16} />
          </Button>
        </TooltipTrigger>
        <TooltipContent align="start" side="right" sideOffset={8}>
          Toggle Sidebar
        </TooltipContent>
      </Tooltip>

      {/* New Chat Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={handleNewChat}
            variant="outline"
            className="w-8 h-8 p-0 bg-background border-sidebar-border hover:bg-custom-purple/20"
          >
            <PlusIcon size={16} />
          </Button>
        </TooltipTrigger>
        <TooltipContent align="start" side="right" sideOffset={8}>
          New Chat
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
