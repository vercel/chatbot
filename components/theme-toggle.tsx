"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        size="icon-sm"
        variant="ghost"
        className={`h-8 w-8 rounded-lg border border-transparent bg-background/50 backdrop-blur-sm transition-all duration-300 hover:border-cyan-500/50 hover:bg-cyan-500/10 dark:hover:border-emerald-500/50 dark:hover:bg-emerald-500/10 flex items-center justify-center ${className || ''}`}
      >
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  const isDark = theme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`group relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border border-black bg-background/50 backdrop-blur-sm transition-all duration-300 hover:border-cyan-500/50 hover:bg-cyan-500/10 dark:border-emerald-500/50 dark:hover:bg-emerald-500/10 ${className || ''}`}
    >
      <div className="relative h-6 w-6">
        <Sun
          className={`absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${isDark
            ? "opacity-0 scale-0 rotate-90"
            : "opacity-100 scale-100 rotate-0 text-yellow-900"
            }`}
        />
        <Moon
          className={`absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${isDark
            ? "opacity-100 scale-100 rotate-0 text-cyan-400"
            : "opacity-0 scale-0 -rotate-90"
            }`}
        />
      </div>

      {/* Subtle glow effect */}
      <div
        className={`absolute inset-0 rounded-lg transition-opacity duration-300 ${isDark
          ? "bg-cyan-500/10 opacity-100"
          : "bg-yellow-500/10 opacity-100"
          }`}
      />

      {/* Hover ring effect */}
      <div
        className={`absolute inset-0 rounded-lg ring-2 transition-opacity duration-300 ${isDark
          ? "ring-cyan-500/20 opacity-0 group-hover:opacity-100"
          : "ring-yellow-500/20 opacity-0 group-hover:opacity-100"
          }`}
      />
    </Button>
  );
}
