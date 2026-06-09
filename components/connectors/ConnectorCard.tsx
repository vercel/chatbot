"use client";
/**
 * ConnectorCard — shadcn Card with brand color top-border, status badge, and capability count.
 */
import { motion } from "framer-motion";
import { PlugIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ConnectorManifest } from "@/lib/connectors/types";
import { cn } from "@/lib/utils";

interface ConnectorCardProps {
  manifest: ConnectorManifest;
  status: { connected: boolean; message?: string };
  onClick?: () => void;
  index?: number;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  Connected: {
    color: "text-emerald-500",
    bg: "bg-emerald-500/10 ring-emerald-500/20",
  },
  "Not Configured": {
    color: "text-yellow-500",
    bg: "bg-yellow-500/10 ring-yellow-500/20",
  },
  Error: { color: "text-red-500", bg: "bg-red-500/10 ring-red-500/20" },
};

export function ConnectorCard({
  manifest,
  status,
  onClick,
  index = 0,
}: ConnectorCardProps) {
  const statusLabel = status.connected
    ? "Connected"
    : status.message?.includes("Missing")
      ? "Not Configured"
      : status.message || "Unknown";
  const cfg = STATUS_CONFIG[statusLabel] ?? STATUS_CONFIG["Not Configured"];
  const Icon = manifest.icon;

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      initial={{ opacity: 0, y: 12 }}
      transition={{ delay: index * 0.05, duration: 0.2 }}
    >
      <Card
        className="border-t-2 cursor-pointer hover:shadow-md transition-all duration-200 group"
        onClick={onClick}
        style={{ borderTopColor: manifest.brandColor }}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                backgroundColor: `${manifest.brandColor}15`,
                color: manifest.brandColor,
              }}
            >
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">
                  {manifest.name}
                </span>
                <Badge
                  className={cn("text-[10px] px-1.5 py-0 ring-1", cfg.bg)}
                  variant="secondary"
                >
                  {statusLabel}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {manifest.description}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] text-muted-foreground">
                  {manifest.capabilities.length} tools
                </span>
                {status.connected && (
                  <span className="text-[10px] text-emerald-500">● Active</span>
                )}
              </div>
            </div>
            <PlugIcon className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
