import Link from "next/link";
import { ArrowLeft, Cpu, Sliders } from "lucide-react";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Settings Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-border/40">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to Chat
        </Link>
        <div className="flex items-center gap-2 ml-auto">
          <Link
            href="/settings/models"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm hover:bg-accent transition-colors"
          >
            <Cpu className="size-4" />
            Models
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm hover:bg-accent transition-colors"
          >
            <Sliders className="size-4" />
            General
          </Link>
        </div>
      </div>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
