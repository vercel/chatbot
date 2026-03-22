import Image from "next/image";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useArtifactSelector } from "@/hooks/use-artifact";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";
import { CrossSmallIcon, TerminalWindowIcon } from "./icons";

export type ConsoleOutputContent = {
  type: "text" | "image";
  value: string;
};

export type ConsoleOutput = {
  id: string;
  status: "in_progress" | "loading_packages" | "completed" | "failed";
  contents: ConsoleOutputContent[];
};

type ConsoleProps = {
  consoleOutputs: ConsoleOutput[];
  setConsoleOutputs: Dispatch<SetStateAction<ConsoleOutput[]>>;
};

export function Console({ consoleOutputs, setConsoleOutputs }: ConsoleProps) {
  const [height, setHeight] = useState<number>(300);
  const [isResizing, setIsResizing] = useState(false);

  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  const minHeight = 100;
  const maxHeight = 800;

  const startResizing = useCallback(() => {
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (e: MouseEvent) => {
      if (isResizing) {
        const newHeight = window.innerHeight - e.clientY;
        if (newHeight >= minHeight && newHeight <= maxHeight) {
          setHeight(newHeight);
        }
      }
    },
    [isResizing]
  );

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  const consoleContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (consoleOutputs.length > 0) {
      consoleContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [consoleOutputs.length]);

  useEffect(() => {
    if (!isArtifactVisible) {
      setConsoleOutputs([]);
    }
  }, [isArtifactVisible, setConsoleOutputs]);

  return consoleOutputs.length > 0 ? (
    <>
      <div
        aria-label="Resize console"
        aria-orientation="horizontal"
        aria-valuemax={maxHeight}
        aria-valuemin={minHeight}
        aria-valuenow={height}
        className="fixed z-50 h-2 w-full cursor-ns-resize"
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") {
            setHeight((prev) => Math.min(prev + 10, maxHeight));
          } else if (e.key === "ArrowDown") {
            setHeight((prev) => Math.max(prev - 10, minHeight));
          }
        }}
        onMouseDown={startResizing}
        role="slider"
        style={{ bottom: height - 4 }}
        tabIndex={0}
      />

      <div
        className={cn(
          "fixed bottom-0 z-40 flex w-full flex-col overflow-x-hidden overflow-y-auto border-t border-border/50 bg-background",
          { "select-none": isResizing }
        )}
        ref={consoleContainerRef}
        style={{ height }}
      >
        <div className="sticky top-0 z-50 flex h-10 w-full items-center justify-between border-b border-border/50 bg-background px-3">
          <div className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
            <TerminalWindowIcon />
            <span>Console</span>
          </div>
          <Button
            className="size-7 text-muted-foreground/50 hover:text-foreground"
            onClick={() => setConsoleOutputs([])}
            size="icon-sm"
            variant="ghost"
          >
            <CrossSmallIcon />
          </Button>
        </div>

        <div className="bg-background">
          {[...consoleOutputs].reverse().map((consoleOutput, index) => (
            <div
              className="flex border-b border-border/30 px-4 py-2.5 font-mono text-[12px] leading-relaxed"
              key={consoleOutput.id}
            >
              <div
                className={cn("w-10 shrink-0 tabular-nums", {
                  "text-muted-foreground": [
                    "in_progress",
                    "loading_packages",
                  ].includes(consoleOutput.status),
                  "text-emerald-500": consoleOutput.status === "completed",
                  "text-red-400": consoleOutput.status === "failed",
                })}
              >
                [{consoleOutputs.length - index}]
              </div>
              {["in_progress", "loading_packages"].includes(
                consoleOutput.status
              ) ? (
                <div className="flex items-center gap-2">
                  <Spinner className="size-3.5" />
                  <span className="text-muted-foreground">
                    {consoleOutput.status === "in_progress"
                      ? "Initializing..."
                      : consoleOutput.status === "loading_packages"
                        ? consoleOutput.contents.map((content) =>
                            content.type === "text" ? content.value : null
                          )
                        : null}
                  </span>
                </div>
              ) : (
                <div className="no-scrollbar flex w-full min-w-0 flex-col gap-2 overflow-x-auto text-foreground">
                  {consoleOutput.contents.map((content) =>
                    content.type === "image" ? (
                      <Image
                        alt="output"
                        className="max-w-full rounded-md"
                        height={400}
                        key={`${consoleOutput.id}-img-${content.value.slice(0, 32)}`}
                        src={content.value}
                        unoptimized
                        width={600}
                      />
                    ) : (
                      <div
                        className="w-full whitespace-pre-line break-words"
                        key={`${consoleOutput.id}-txt-${content.value.slice(0, 32)}`}
                      >
                        {content.value}
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  ) : null;
}
