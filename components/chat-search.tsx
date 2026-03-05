"use client";

import { useState, useCallback, useMemo } from "react";
import { Search, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ChatMessage } from "@/lib/types";

interface ChatSearchProps {
  messages: ChatMessage[];
  onMessageSelect?: (messageId: string) => void;
  onSearchClose?: () => void;
  className?: string;
}

interface SearchResult {
  message: ChatMessage;
  matches: {
    text: string;
    startIndex: number;
    endIndex: number;
    partIndex: number;
  }[];
}

export function ChatSearch({
  messages,
  onMessageSelect,
  onSearchClose,
  className = "",
}: ChatSearchProps) {
  const [query, setQuery] = useState("");
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  // Search functionality
  const searchMessages = useCallback((searchQuery: string, messageList: ChatMessage[]): SearchResult[] => {
    if (!searchQuery.trim()) return [];

    const results: SearchResult[] = [];
    const queryLower = searchQuery.toLowerCase();

    messageList.forEach((message) => {
      const matches: { text: string; startIndex: number; endIndex: number; partIndex: number }[] = [];
      
      // Search in text parts
      message.parts.forEach((part, partIndex) => {
        if (part.type === "text" && "text" in part && part.text) {
          const textLower = (part as any).text.toLowerCase();
          let index = textLower.indexOf(queryLower);
          
          while (index !== -1) {
            matches.push({
              text: (part as any).text.substring(index, index + queryLower.length),
              startIndex: index,
              endIndex: index + queryLower.length,
              partIndex,
            });
            index = textLower.indexOf(queryLower, index + 1);
          }
        }
      });

      // Search in file attachments
      message.parts.forEach((part, partIndex) => {
        if (part.type === "file" && "filename" in part && part.filename) {
          const filenameLower = (part as any).filename.toLowerCase();
          if (filenameLower.includes(queryLower)) {
            matches.push({
              text: (part as any).filename,
              startIndex: 0,
              endIndex: (part as any).filename.length,
              partIndex,
            });
          }
        }
      });

      if (matches.length > 0) {
        results.push({ message, matches });
      }
    });

    return results;
  }, []);

  const searchResults = useMemo(() => searchMessages(query, messages), [query, messages, searchMessages]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedResultIndex((prev) => 
          prev < searchResults.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedResultIndex((prev) => 
          prev > 0 ? prev - 1 : searchResults.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (searchResults[selectedResultIndex]) {
          onMessageSelect?.(searchResults[selectedResultIndex].message.id);
        }
        break;
      case "Escape":
        e.preventDefault();
        onSearchClose?.();
        break;
    }
  }, [searchResults, selectedResultIndex, onMessageSelect, onSearchClose]);

  // Highlight search matches in text
  const highlightMatches = useCallback((text: string, matches: { startIndex: number; endIndex: number }[]) => {
    if (matches.length === 0) return text;

    let result = "";
    let lastIndex = 0;

    matches.forEach((match, index) => {
      result += text.substring(lastIndex, match.startIndex);
      result += `<mark class="bg-yellow-200 text-yellow-900 px-1 rounded">${text.substring(match.startIndex, match.endIndex)}</mark>`;
      lastIndex = match.endIndex;
    });

    result += text.substring(lastIndex);
    return result;
  }, []);

  // Extract text content from message parts
  const getMessageText = useCallback((message: ChatMessage): string => {
    return message.parts
      .filter((part) => part.type === "text" && "text" in part && part.text)
      .map((part) => (part as any).text)
      .join(" ");
  }, []);

  // Get message preview with highlighted matches
  const getMessagePreview = useCallback((result: SearchResult) => {
    const { message, matches } = result;
    
    if (matches.length === 0) return getMessageText(message);

    // Group matches by part and show context around the first match
    const firstMatch = matches[0];
    const part = message.parts[firstMatch.partIndex];
    
    if (part.type === "text" && "text" in part && part.text) {
      const text = (part as any).text;
      const contextStart = Math.max(0, firstMatch.startIndex - 50);
      const contextEnd = Math.min(text.length, firstMatch.endIndex + 50);
      
      let preview = text.substring(contextStart, contextEnd);
      if (contextStart > 0) preview = "..." + preview;
      if (contextEnd < text.length) preview = preview + "...";

      // Adjust match indices for the preview
      const adjustedMatches = matches
        .filter(match => match.partIndex === firstMatch.partIndex)
        .map(match => ({
          ...match,
          startIndex: match.startIndex - contextStart,
          endIndex: match.endIndex - contextStart,
        }))
        .filter(match => match.startIndex >= 0 && match.endIndex <= preview.length);

      return highlightMatches(preview, adjustedMatches);
    } else if (part.type === "file" && "filename" in part && part.filename) {
      return `File: ${(part as any).filename}`;
    }

    return getMessageText(message);
  }, [getMessageText, highlightMatches]);

  const clearSearch = useCallback(() => {
    setQuery("");
    setSelectedResultIndex(0);
  }, []);

  if (!isExpanded) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(true)}
        className={`gap-2 ${className}`}
      >
        <Search className="h-4 w-4" />
        Search Messages
      </Button>
    );
  }

  return (
    <Card className={`p-4 space-y-4 ${className}`}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search messages..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedResultIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="pl-10 pr-10"
          />
          {query && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSearch}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(false)}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onSearchClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {query && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Badge variant="secondary">
              {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
            </Badge>
            {searchResults.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {selectedResultIndex + 1} of {searchResults.length}
              </span>
            )}
          </div>

          {searchResults.length > 0 && (
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {searchResults.map((result, index) => (
                  <div
                    key={result.message.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      index === selectedResultIndex
                        ? "bg-accent border-accent-foreground"
                        : "hover:bg-muted"
                    }`}
                    onClick={() => onMessageSelect?.(result.message.id)}
                    onMouseEnter={() => setSelectedResultIndex(index)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">
                        {result.message.role === "user" ? "You" : "Assistant"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {(result.message as any).created_at 
                          ? new Date((result.message as any).created_at).toLocaleTimeString()
                          : new Date().toLocaleTimeString()
                        }
                      </span>
                    </div>
                    <div 
                      className="text-sm text-muted-foreground line-clamp-3"
                      dangerouslySetInnerHTML={{ 
                        __html: getMessagePreview(result) 
                      }}
                    />
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {searchResults.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No messages found matching "{query}"</p>
            </div>
          )}
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        <p>Keyboard shortcuts:</p>
        <p>↑↓ - Navigate results | Enter - Select | Esc - Close</p>
      </div>
    </Card>
  );
}
