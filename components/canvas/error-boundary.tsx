"use client";

/**
 * components/canvas/error-boundary.tsx — Error boundary for canvas modes.
 *
 * Phase 16: Each mode is independently error-bounded.
 * A crash in one mode shows a compact error card + retry CTA
 * and does NOT affect chat or other modes.
 */

import { Component, type ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface CanvasErrorBoundaryProps {
  mode: string;
  onRetry: () => void;
  children: ReactNode;
  fallback?: ReactNode;
}

interface CanvasErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class CanvasErrorBoundary extends Component<
  CanvasErrorBoundaryProps,
  CanvasErrorBoundaryState
> {
  constructor(props: CanvasErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): CanvasErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(
      `[CanvasErrorBoundary] mode="${this.props.mode}"`,
      error,
      errorInfo,
    );
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center h-64 gap-4 px-6 text-center">
          <div
            className={cn(
              "flex items-center justify-center w-12 h-12 rounded-full",
              "bg-destructive/10",
            )}
          >
            <AlertCircle className="h-6 w-6 text-destructive/60" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-foreground/80">
              Failed to load {this.props.mode}
            </h3>
            <p className="text-xs text-muted-foreground/50 mt-1 max-w-[280px]">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
          </div>
          <button
            onClick={this.handleRetry}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg",
              "text-xs font-medium",
              "bg-primary/10 text-primary border border-primary/20",
              "hover:bg-primary/15 transition-colors",
            )}
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
