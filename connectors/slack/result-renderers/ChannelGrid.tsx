"use client";
/**
 * Slack ChannelGrid result renderer — renders listChannels/searchChannels output.
 */
import { HashIcon, LockIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

interface SlackChannel {
  id: string;
  name: string;
  isPrivate?: boolean;
  memberCount?: number;
  topic?: string;
}

interface ChannelsOutput {
  count?: number;
  channels?: SlackChannel[];
  error?: string;
}

export default function ChannelGrid({ output }: { output: ChannelsOutput }) {
  if (output?.error) {
    return (
      <Card className="border-red-500/20 bg-red-500/5 p-4">
        <p className="text-red-400 text-xs">{output.error}</p>
      </Card>
    );
  }
  const channels = output?.channels ?? [];
  return (
    <Card
      className="border-t-2 overflow-hidden"
      style={{ borderTopColor: "#4A154B" }}
    >
      <div className="px-4 py-3 border-b flex items-center gap-2">
        <HashIcon className="w-4 h-4 text-[#4A154B]" />
        <span className="font-medium text-sm text-[#4A154B]">
          {channels.length} channels
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3">
        {channels.map((ch) => (
          <div
            className="flex items-center gap-2 p-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors"
            key={ch.id}
          >
            <HashIcon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <span className="text-xs font-medium truncate">{ch.name}</span>
            {ch.isPrivate && (
              <LockIcon className="w-3 h-3 text-muted-foreground ml-auto flex-shrink-0" />
            )}
            {ch.memberCount && (
              <span className="text-[10px] text-muted-foreground ml-1">
                {ch.memberCount}
              </span>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
