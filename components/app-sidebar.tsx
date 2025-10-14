'use client';

import type { User } from 'next-auth';
import { useRouter } from 'next/navigation';

import { PlusIcon } from '@/components/icons';
import { SidebarHistory } from '@/components/sidebar-history';
import { SidebarToggle } from '@/components/sidebar-toggle';
import { SidebarUserNav } from '@/components/sidebar-user-nav';
import { Button } from '@/components/ui/button';
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

  return (
    <Sidebar className="group-data-[side=left]:border-r-0 w-[265px]">
      <SidebarHeader className="relative h-[176px] flex-shrink-0 overflow-hidden">
        <SidebarMenu>
          <div className="flex flex-row justify-between items-center">
            <div className="flex flex-row gap-3 items-center">
              <Link
                href="/"
                onClick={() => {
                  setOpenMobile(false);
                }}
                className="flex flex-row gap-3 items-center"
              >
                <div className="absolute left-[27px] top-[25px] text-[18px] font-bold text-black leading-[1.15] not-italic font-serif">
                  <div>Application</div>
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
                className="w-[214px] h-[40px] bg-[#e6e5dc] border-none rounded-[6px] px-[16px] py-[8px] flex items-center justify-center gap-[8px] hover:bg-custom-purple/20"
                onClick={() => {
                  setOpenMobile(false);
                  router.push('/home');
                  router.refresh();
                }}
              >
                <PlusIcon size={16} />
                <span className="text-[14px] font-medium text-black leading-[24px] not-italic font-sans">New chat</span>
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
