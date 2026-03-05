"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { SidebarInset, SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import type { User } from "next-auth";
import { useEffect, useRef, useState } from "react";
import { ImperativePanelHandle } from "react-resizable-panels";
import { SignOutWithConfirmation } from "./sign-out-with-confirmation";
import { isValidEmail } from "@/lib/utils";

export function ChatResizableLayout({
  children,
  user,
}: {
  children: React.ReactNode;
  user: User | undefined;
}) {
  const isMobile = useIsMobile();
  const { open } = useSidebar();
  const [sidebarSize, setSidebarSize] = useState(25);

  const panelRef = useRef<ImperativePanelHandle>(null);

  // Imperatively collapse/expand when `open` changes
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    if (open) {
      panel.expand();
    } else {
      panel.collapse();
    }
  }, [open]);

  // Handle sidebar toggle and resizing logic
  // const handleSidebarToggle = useCallback(() => {
  //   if (open) {
  //     // When closing sidebar, reset to default size
  //     setSidebarSize(30);
  //   }
  //   setOpen(!open);
  // }, [open]);

  if (isMobile) {
    return (
      <>
        <AppSidebar user={user} />
        <SidebarInset className="h-dvh w-dvw">{children}</SidebarInset>
      </>
    );
  }

  return (
    <ResizablePanelGroup direction="horizontal" className="h-dvh"
      // Persist layout so sizes survive re-renders
      autoSaveId="chat-layout">

      <ResizablePanel
        ref={panelRef}
        defaultSize={sidebarSize}
        minSize={10}
        maxSize={40}
        collapsible={true}
        onResize={(size) => {
          // Only save non-zero sizes so we restore properly on expand
          if (size > 0) setSidebarSize(size);
        }}
        className="overflow-hidden"
      // className="border border-black"
      >
        <AppSidebar user={user} />
      </ResizablePanel>

      {open && (
        <ResizableHandle
          withHandle={true}
          className="dark:bg-gray-700 w-0.5"
        />
      )}

      {/* Main Content Panel - always rendered */}
      <ResizablePanel
        minSize={60}
        // defaultSize={open ? 100 - sidebarSize : 100}
      // maxSize={open ? 100 : 80}
      >
        {children}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}


// todo new file, check the naming maybe
interface AuthVerificationWrapperProps {
  children: React.ReactNode;
  isCollapsed: boolean;
}

export function AuthVerificationWrapper({ children, isCollapsed }: AuthVerificationWrapperProps) {
  const [session, setSession] = useState<any>(null);
  const [userVerified, setUserVerified] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const [sessionData, verificationResponse] = await Promise.all([
          fetch('/api/auth/session'),
          fetch('/api/check-verification')
        ]);

        const sessionJson = await sessionData.json();
        const verificationData = await verificationResponse.json();
        setSession(sessionJson);
        setUserVerified(verificationData.verified);
      } catch (error) {
        console.error("Auth check failed:", error);
        setUserVerified(false);
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, []);

  if (loading) {
    return <div className="flex h-dvh" />;
  }

  if (!session?.user) {
    return (
      <div className="flex h-dvh w-screen items-center justify-center bg-background">
        <div className="text-center space-y-4 p-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4a2 2 0 012-2v4a2 2 0 012 2v6a2 2 0 01-2 2z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5-5z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-red-800">Authentication Required</h1>
          <p className="text-red-700 mb-4">
            Please sign in to access the chat application.
          </p>
          <a
            href="/login"
            className="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
          >
            Sign In
          </a>
        </div>
      </div>
    );
  }

  if (!userVerified && session?.user.type === "regular") {
    return (
      <div className="flex h-dvh w-screen items-center justify-center bg-background">
        <div className="text-center space-y-4 p-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
            <svg className="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4a2 2 0 012-2v4a2 2 0 012 2v6a2 2 0 01-2 2z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5-5z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-yellow-800">Email Verification Required</h1>
          <p className="text-yellow-700 mb-4">
            Please verify your email address before accessing the chat application.
          </p>
          <div className="space-y-3">
            <p className="text-sm text-yellow-600">
              Check your email for a verification code or verification link.
            </p>
            <p className="text-sm text-yellow-600">
              If you didn't receive an email, check your spam folder or request a new verification code.
            </p>
          </div>
          <div className="space-y-3">
            {session.user.email && isValidEmail(session.user.email) && (
              <a
                href={`/verify/code?email=${encodeURIComponent(session.user.email)}`}
                className="inline-flex items-center px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-md transition-colors"
              >
                Enter Verification Code
              </a>
            )}
            <SignOutWithConfirmation />
          </div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen={!isCollapsed}>
      <ChatResizableLayout user={session?.user}>{children}</ChatResizableLayout>
    </SidebarProvider>
  );
}
