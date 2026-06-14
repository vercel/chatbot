import { cookies } from "next/headers";
import Script from "next/script";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { ChatLayoutClient } from "@/components/chat/chat-layout-client";
import { DataStreamProvider } from "@/components/chat/data-stream-provider";
import { ChatSettingsProvider } from "@/components/chat/chat-settings-provider";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ActiveChatProvider } from "@/hooks/use-active-chat";
import { V2SessionProvider } from "@/hooks/use-v2-session";
import { auth } from "../(auth)/auth";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js"
        strategy="afterInteractive"
      />
      <V2SessionProvider>
        <DataStreamProvider>
          <ChatSettingsProvider>
            <Suspense fallback={<div className="flex h-dvh bg-sidebar" />}>
              <SidebarShell>{children}</SidebarShell>
            </Suspense>
          </ChatSettingsProvider>
        </DataStreamProvider>
      </V2SessionProvider>
    </>
  );
}

async function SidebarShell({ children }: { children: React.ReactNode }) {
  const [session, cookieStore] = await Promise.all([auth(), cookies()]);
  const isCollapsed = cookieStore.get("sidebar_state")?.value !== "true";

  return (
    <SidebarProvider defaultOpen={!isCollapsed}>
      <Toaster
        position="top-center"
        theme="system"
        toastOptions={{
          className:
            "!bg-card !text-foreground !border-border/50 !shadow-[var(--shadow-float)]",
        }}
      />
      <Suspense fallback={<div className="flex h-dvh" />}>
        <ActiveChatProvider>
          <ChatLayoutClient user={session?.user} />
        </ActiveChatProvider>
      </Suspense>
      {children}
    </SidebarProvider>
  );
}
