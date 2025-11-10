'use client';

import type { User } from 'next-auth';
import { useRouter } from 'next/navigation';

import { PlusIcon } from '@/components/icons';
import { SidebarHistory } from '@/components/sidebar-history';
import { SidebarToggle } from '@/components/sidebar-toggle';
import { SidebarUserNav } from '@/components/sidebar-user-nav';
import { Button } from '@/components/ui/button';
import { closeArtifact, useArtifact } from '@/hooks/use-artifact';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  useSidebar,
} from '@/components/ui/sidebar';
import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

export function AppSidebar({ user }: { user: User | undefined }) {
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  const { setArtifact } = useArtifact();

  return (
    <Sidebar className="group-data-[side=left]:border-r-0 w-[265px]">
      <SidebarHeader className="relative h-[176px] flex-shrink-0 overflow-hidden">
        <SidebarMenu>
          <div className="flex flex-row justify-between items-center">
            <div className="flex flex-row gap-3 items-center">
              <Link
                href="/home"
                onClick={() => {
                  closeArtifact(setArtifact);
                  setOpenMobile(false);
                }}
                className="flex flex-row gap-3 items-center"
              >
                <div className="absolute left-[27px] top-[25px] text-[18px] font-bold text-black dark:text-white leading-[1.15] not-italic font-source-serif">
                  <div>Form-Filling</div>
                  <div>Assistant</div>
                </div>
              </Link>
            </div>
            <div className="absolute top-[24px] right-[27px] z-10">
              <SidebarToggle />
            </div>
            {/* New Chat Button */}
            <div className="absolute left-[27px] top-[117px]">
              <Button
                variant="outline"
                className="w-[214px] h-[40px] bg-[#e6e5dc] dark:bg-gray-700 border-none rounded-[6px] px-[16px] py-[8px] flex items-center justify-center gap-[8px] hover:bg-custom-purple/20 dark:hover:bg-custom-purple/30"
                onClick={() => {
                  setOpenMobile(false);
                  closeArtifact(setArtifact);
                  router.push('/');
                  router.refresh();
                }}
              >
                <PlusIcon size={16} />
                <span className="text-[14px] font-medium text-black dark:text-white leading-[24px] not-italic font-inter">New chat</span>
              </Button>
            </div>
          </div>
        </SidebarMenu>
      </SidebarHeader>
      
      <SidebarContent className="relative overflow-y-auto">
        {/* Chat History */}
        <div className="px-[27px] pt-4 w-full">
          <SidebarHistory user={user} />
        </div>
      </SidebarContent>
      
      <SidebarFooter className="absolute bottom-0 left-[26px] w-[214px]">
        {user && <SidebarUserNav user={user} />}
      </SidebarFooter>
    </Sidebar>
  );
}
