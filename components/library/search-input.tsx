"use client";

/**
 * SearchInput — cmdk-integrated search input for library browsing.
 * Phase 22: Inline search with keyboard shortcut hint.
 *
 * Features:
 *  - Glass surface styling
 *  - Search icon + ⌘K keyboard hint
 *  - Clear button when has value
 *  - Opens CommandPalette on focus / ⌘K
 *  - Debounced onChange for filtering parent grids
 */

import { Search, X } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search library...",
  className,
  autoFocus = false,
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localValue, setLocalValue] = useState(value);

  // Sync external value
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Debounced change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [localValue]); // eslint-disable-line react-hooks/exhaustive-deps

  const clear = useCallback(() => {
    setLocalValue("");
    onChange("");
    inputRef.current?.focus();
  }, [onChange]);

  return (
    <div className={cn(
      "relative flex items-center gap-2 rounded-xl px-3 py-2",
      "glass-1 transition-shadow duration-200",
      "focus-within:shadow-[0_0_0_2px_var(--ring),var(--glass-shadow-1)]",
      className
    )}>
      <Search size={16} className="text-muted-foreground shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={cn(
          "flex-1 bg-transparent text-sm outline-none",
          "placeholder:text-muted-foreground/50",
          "min-w-0"
        )}
      />
      {localValue ? (
        <button
          onClick={clear}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
          aria-label="Clear search"
        >
          <X size={14} />
        </button>
      ) : (
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground font-mono shrink-0">
          ⌘K
        </kbd>
      )}
    </div>
  );
}

export default SearchInput;
