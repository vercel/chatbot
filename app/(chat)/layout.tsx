import { cookies } from "next/headers";
import Script from "next/script";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { AppSidebar } from "@/components/chat/app-sidebar";
import { DataStreamProvider } from "@/components/chat/data-stream-provider";
import { ChatShell } from "@/components/chat/shell";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ActiveChatProvider } from "@/hooks/use-active-chat";
import { auth } from "../(auth)/auth";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js"
        strategy="lazyOnload"
      />
      <DataStreamProvider>
        <Suspense fallback={<div className="flex h-dvh bg-sidebar" />}>
          <SidebarShell>{children}</SidebarShell>
        </Suspense>
      </DataStreamProvider>
    </>
  );
}

async function SidebarShell({ children }: { children: React.ReactNode }) {
  const isDbConfigured = Boolean(process.env.POSTGRES_URL);

  if (!isDbConfigured) {
    return (
      <div className="flex min-h-dvh w-full flex-col items-center justify-center bg-zinc-950 text-zinc-100 p-6 font-sans selection:bg-zinc-800">
        <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-lg bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-400">⚠️</span>
            <h1 className="text-sm font-semibold tracking-tight text-zinc-100">
              Database Connection Required
            </h1>
          </div>
          <p className="mt-3 text-xs text-zinc-400 leading-relaxed">
            This chatbot requires a database connection to persist conversation history and manage active sessions.
          </p>
          <div className="mt-4 rounded-lg bg-zinc-950 border border-zinc-800 p-4 font-mono text-[11px] text-zinc-400">
            <p className="font-semibold text-zinc-200 mb-1.5">To fix this, create a <span className="text-zinc-100 font-mono">.env.local</span> file in the root:</p>
            <pre className="overflow-x-auto whitespace-pre-wrap select-all bg-zinc-900/50 p-2.5 rounded border border-zinc-800/80 leading-relaxed">POSTGRES_URL="postgres://username:password@host:port/database"</pre>
          </div>
          <p className="mt-4 text-[10px] text-zinc-500 leading-relaxed">
            Once you've configured your <span className="font-mono">.env.local</span> file, restart the development server. You can provision a free Postgres database using Neon, Vercel Postgres, or run a local instance via Docker.
          </p>
        </div>
      </div>
    );
  }

  const [session, cookieStore] = await Promise.all([auth(), cookies()]);
  const isCollapsed = cookieStore.get("sidebar_state")?.value !== "true";

  return (
    <SidebarProvider defaultOpen={!isCollapsed}>
      <AppSidebar user={session?.user} />
      <SidebarInset>
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
            <ChatShell />
          </ActiveChatProvider>
        </Suspense>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
