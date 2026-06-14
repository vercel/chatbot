import Link from "next/link";
import { Home, BookOpen, MessageSquare, Wrench } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 bg-background">
      {/* Brand */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar-accent">
          <MessageSquare className="h-5 w-5 text-muted-foreground" />
        </div>
        <span className="text-lg font-semibold tracking-tight">Neptune</span>
      </div>

      <h1 className="text-3xl font-bold tracking-tight">404</h1>
      <p className="text-muted-foreground text-center max-w-sm">
        This page doesn&apos;t exist. It may have moved or been removed during
        the navigation cleanup.
      </p>

      <div className="flex flex-wrap gap-3 justify-center mt-2">
        <Link
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          href="/"
        >
          <Home className="h-4 w-4" />
          Go Home
        </Link>
        <Link
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          href="/tools"
        >
          <Wrench className="h-4 w-4" />
          Tools
        </Link>
        <Link
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          href="/playbooks"
        >
          <BookOpen className="h-4 w-4" />
          Playbooks
        </Link>
      </div>

      <p className="text-xs text-muted-foreground mt-6">
        Try Cmd+K to search for anything in the library.
      </p>
    </div>
  );
}
