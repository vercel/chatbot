"use client";
/**
 * Slack MessageList result renderer — renders pullMessages output as channel card + message rows.
 */
import { ChevronDown, MessageSquareIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface SlackMessage {
  user: string;
  text: string;
  ts: string;
  type: string;
}

interface PullMessagesOutput {
  channel?: string;
  channelName?: string;
  count?: number;
  hasMore?: boolean;
  messages?: SlackMessage[];
  error?: string;
}

function formatSlackTs(ts: string): string {
  const d = new Date(Number.parseFloat(ts) * 1000);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString();
}

export default function MessageList({
  output,
}: {
  output: PullMessagesOutput;
}) {
  if (output?.error) {
    return (
      <Card className="border-red-500/20 bg-red-500/5 p-4">
        <p className="text-red-400 text-xs font-medium">Slack Error</p>
        <p className="text-red-300 text-xs mt-1">{output.error}</p>
      </Card>
    );
  }

  const messages = output?.messages ?? [];

  return (
    <Card
      className="border-t-2 overflow-hidden"
      style={{ borderTopColor: "#4A154B" }}
    >
      {/* Channel Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-[#4A154B]/5 border-b">
        <MessageSquareIcon className="w-4 h-4 text-[#4A154B]" />
        <span className="font-medium text-sm text-[#4A154B]">
          #{output?.channelName ?? "channel"}
        </span>
        <Badge className="ml-auto text-[10px]" variant="secondary">
          {output?.count ?? messages.length} msgs
        </Badge>
      </div>

      {/* Messages */}
      <ScrollArea className="max-h-64">
        <div className="divide-y">
          {messages.map((msg, i) => (
            <div
              className="flex items-start gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors"
              key={msg.ts || i}
            >
              <div className="w-7 h-7 rounded bg-[#4A154B]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[10px] font-bold text-[#4A154B]">
                  {(msg.user || "?").slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-xs">{msg.user}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatSlackTs(msg.ts)}
                  </span>
                </div>
                <p
                  className={cn(
                    "text-xs mt-0.5 leading-relaxed",
                    msg.text?.length > 200 && "line-clamp-3"
                  )}
                >
                  {msg.text || (
                    <span className="italic text-muted-foreground">
                      [no text]
                    </span>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Footer */}
      {output?.hasMore && (
        <div className="flex items-center justify-center px-4 py-2 border-t bg-muted/20">
          <ChevronDown className="w-3 h-3 text-muted-foreground mr-1" />
          <span className="text-[10px] text-muted-foreground">
            More messages available
          </span>
        </div>
      )}
    </Card>
  );
}
