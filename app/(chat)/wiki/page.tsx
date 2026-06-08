"use client";

/**
 * Wiki Page — Karpathy 3-layer second brain.
 *
 * Desktop: ResizablePanels — file tree (left) + content viewer (right).
 * Mobile: single column with tabs — Tree | Content | Index | Log.
 */
import {
  BookOpenIcon,
  BrainCircuitIcon,
  ChevronRightIcon,
  ClockIcon,
  FileIcon,
  FileTextIcon,
  FolderIcon,
  ListTreeIcon,
  RefreshCwIcon,
  SearchIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface WikiFile {
  name: string;
  path: string;
}

interface WikiTree {
  schema: WikiFile[];
  concepts: WikiFile[];
  connectors: WikiFile[];
  projects: WikiFile[];
  operations: WikiFile[];
  entities?: WikiFile[];
  sources?: WikiFile[];
}

type ContentTab = "tree" | "content" | "index" | "log";

export default function WikiPage() {
  const [tree, setTree] = useState<WikiTree | null>(null);
  const [content, setContent] = useState<string>("");
  const [currentPath, setCurrentPath] = useState<string>("");
  const [currentTitle, setCurrentTitle] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [mobileTab, setMobileTab] = useState<ContentTab>("tree");

  // Load tree on mount
  useEffect(() => {
    fetch("/api/wiki")
      .then((r) => r.json())
      .then((data) => {
        if (data.tree) setTree(data.tree);
      })
      .catch(() => {});
  }, []);

  const loadFile = useCallback(async (path: string, name: string) => {
    setLoading(true);
    setCurrentPath(path);
    setCurrentTitle(name.replace(".md", ""));
    setMobileTab("content");
    try {
      const res = await fetch(`/api/wiki?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      setContent(data.content || "*No content available*");
    } catch {
      setContent("*Error loading content. Is the VPS bridge connected?*");
    }
    setLoading(false);
  }, []);

  const flatFiles: (WikiFile & { category: string })[] = tree
    ? Object.entries(tree).flatMap(([category, files]) =>
        files.map((f: WikiFile) => ({ ...f, category }))
      )
    : [];

  const filtered = search
    ? flatFiles.filter(
        (f) =>
          f.name.toLowerCase().includes(search.toLowerCase()) ||
          f.path.toLowerCase().includes(search.toLowerCase())
      )
    : flatFiles;

  // ── File Tree Component ──
  const FileTree = () => (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-zinc-800">
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50"
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search wiki..."
            type="text"
            value={search}
          />
        </div>
      </div>

      {/* Tree */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {search ? (
            filtered.length === 0 ? (
              <p className="text-xs text-zinc-500 p-4 text-center">
                No matches found
              </p>
            ) : (
              filtered.map((file: WikiFile & { category: string }) => (
                <button
                  className={cn(
                    "w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                    currentPath === file.path
                      ? "bg-cyan-400/10 text-cyan-400"
                      : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                  )}
                  key={file.path}
                  onClick={() => loadFile(file.path, file.name)}
                >
                  <FileIcon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">
                    {file.name.replace(".md", "")}
                  </span>
                  <Badge
                    className="text-[9px] h-3.5 px-1 py-0 ml-auto flex-shrink-0"
                    variant="outline"
                  >
                    {file.category}
                  </Badge>
                </button>
              ))
            )
          ) : tree ? (
            Object.entries(tree).map(([category, files]) => (
              <div className="mb-3" key={category}>
                <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  <FolderIcon className="w-3 h-3" />
                  {category}
                </div>
                {files.map((file: WikiFile) => (
                  <button
                    className={cn(
                      "w-full text-left flex items-center gap-2 pl-5 pr-2 py-1.5 rounded-md text-sm transition-colors",
                      currentPath === file.path
                        ? "bg-cyan-400/10 text-cyan-400"
                        : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                    )}
                    key={file.path}
                    onClick={() => loadFile(file.path, file.name)}
                  >
                    <ChevronRightIcon className="w-3 h-3 flex-shrink-0 text-zinc-600" />
                    <span className="truncate">
                      {file.name.replace(".md", "")}
                    </span>
                  </button>
                ))}
              </div>
            ))
          ) : (
            <div className="p-4 text-center">
              <RefreshCwIcon className="w-5 h-5 text-zinc-600 mx-auto mb-2 animate-spin" />
              <p className="text-xs text-zinc-500">Loading tree...</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Quick nav: Index + Log */}
      <div className="border-t border-zinc-800 p-2 flex gap-1">
        <button
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition-colors"
          onClick={() => loadFile("_schema/index.md", "Index")}
        >
          <ListTreeIcon className="w-3.5 h-3.5" /> Index
        </button>
        <button
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition-colors"
          onClick={() => loadFile("_schema/log.md", "Log")}
        >
          <ClockIcon className="w-3.5 h-3.5" /> Log
        </button>
      </div>
    </div>
  );

  // ── Content Viewer ──
  const ContentViewer = () => (
    <div className="flex flex-col h-full">
      {/* Content header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800 flex-shrink-0">
        <FileTextIcon className="w-4 h-4 text-cyan-400" />
        <h2 className="text-sm font-medium text-zinc-200 truncate">
          {currentTitle || "Select a page"}
        </h2>
        {currentPath && (
          <code className="text-[10px] text-zinc-600 font-mono truncate hidden sm:inline">
            {currentPath}
          </code>
        )}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCwIcon className="w-5 h-5 text-cyan-400 animate-spin" />
            </div>
          ) : content ? (
            <article className="prose prose-invert prose-sm max-w-none">
              {/* Simple markdown rendering: preserve pre/code, convert headers, bold, links */}
              <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-300 leading-relaxed">
                {content}
              </pre>
            </article>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <BookOpenIcon className="w-12 h-12 text-zinc-700 mb-4" />
              <h2 className="text-lg font-medium text-zinc-300 mb-2">
                Wiki Content
              </h2>
              <p className="text-sm text-zinc-500 max-w-sm">
                Select a page from the file tree to view its content. The wiki
                contains skills, PRDs, operational memory, and connector
                documentation.
              </p>
              <div className="flex gap-2 mt-4">
                <Badge className="text-[10px]" variant="outline">
                  <ListTreeIcon className="w-3 h-3 mr-1" /> Index
                </Badge>
                <Badge className="text-[10px]" variant="outline">
                  <ClockIcon className="w-3 h-3 mr-1" /> Log
                </Badge>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  // ── Main Render ──
  return (
    <div className="flex flex-col h-full w-full overflow-x-hidden bg-zinc-950">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800 flex-shrink-0">
        <BrainCircuitIcon className="size-5 text-cyan-400" />
        <h1 className="text-base font-semibold text-zinc-100">Wiki</h1>
        <Badge
          className="text-[10px] h-4 px-1.5 py-0 text-cyan-400 border-cyan-400/30"
          variant="outline"
        >
          Karpathy 3-Layer
        </Badge>
        <span className="text-[10px] text-zinc-600 ml-auto hidden sm:inline">
          {flatFiles.length} pages
        </span>
      </div>

      {/* Desktop: ResizablePanels */}
      <div className="flex-1 hidden md:flex min-h-0">
        <ResizablePanelGroup className="flex-row">
          <ResizablePanel defaultSize={30} maxSize={45} minSize={20}>
            <FileTree />
          </ResizablePanel>
          <ResizableHandle className="bg-zinc-800" />
          <ResizablePanel defaultSize={70}>
            <ContentViewer />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Mobile: Tabs */}
      <div className="flex-1 md:hidden min-h-0">
        <Tabs
          className="flex flex-col h-full"
          onValueChange={(v) => setMobileTab(v as ContentTab)}
          value={mobileTab}
        >
          <TabsList className="mx-2 mt-1 bg-transparent border-b border-zinc-800 rounded-none justify-start gap-1">
            <TabsTrigger
              className="text-[11px] px-3 data-[state=active]:bg-muted"
              value="tree"
            >
              Tree
            </TabsTrigger>
            <TabsTrigger
              className="text-[11px] px-3 data-[state=active]:bg-muted"
              value="content"
            >
              Content
            </TabsTrigger>
            <TabsTrigger
              className="text-[11px] px-3 data-[state=active]:bg-muted"
              value="index"
            >
              Index
            </TabsTrigger>
            <TabsTrigger
              className="text-[11px] px-3 data-[state=active]:bg-muted"
              value="log"
            >
              Log
            </TabsTrigger>
          </TabsList>
          <TabsContent className="flex-1 mt-0" value="tree">
            <FileTree />
          </TabsContent>
          <TabsContent className="flex-1 mt-0" value="content">
            <ContentViewer />
          </TabsContent>
          <TabsContent className="flex-1 mt-0" value="index">
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800">
                <ListTreeIcon className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-medium text-zinc-200">Index</span>
              </div>
              <ScrollArea className="flex-1 p-4">
                <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-300 leading-relaxed">
                  {content || "Tap a page in the Tree tab, then return here."}
                </pre>
              </ScrollArea>
            </div>
          </TabsContent>
          <TabsContent className="flex-1 mt-0" value="log">
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800">
                <ClockIcon className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-medium text-zinc-200">Log</span>
              </div>
              <ScrollArea className="flex-1 p-4">
                <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-300 leading-relaxed">
                  {content || "Activity log. Tap a page in the Tree tab first."}
                </pre>
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
