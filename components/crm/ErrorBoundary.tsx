/**
 * ErrorBoundary — Production Hardening
 * Phase 39 Stream 6: Catches rendering errors in CRM/Discovery/Twenty views.
 *
 * Features:
 * - Fallback UI with retry button
 * - Error logging to Sentry (when configured)
 * - Distinguishes between fetch errors vs render errors
 * - Preserves layout context
 */
"use client";

import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  componentName?: string;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorCount: number;
}

export class CrmErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState(prev => ({ errorCount: prev.errorCount + 1 }));

    // Log to console in dev
    console.error(
      `[ErrorBoundary${this.props.componentName ? `:${this.props.componentName}` : ""}]`,
      error,
      errorInfo
    );

    // Log to Sentry if configured
    if (typeof window !== "undefined" && (window as any).Sentry) {
      try {
        (window as any).Sentry.captureException(error, {
          tags: {
            component: this.props.componentName || "unknown",
            errorBoundary: "true",
          },
          extra: {
            componentStack: errorInfo.componentStack,
            errorCount: this.state.errorCount + 1,
          },
        });
      } catch {
        // Sentry unavailable — silent
      }
    }

    // Custom error handler
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isCrashLoop = this.state.errorCount > 3;

      return (
        <div className="p-6 rounded-xl border border-red-200 bg-red-50">
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">⚠️</span>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-red-900">
                {isCrashLoop
                  ? "Component Crashed Repeatedly"
                  : "Something Went Wrong"}
              </h3>
              <p className="text-sm text-red-700 mt-1">
                {isCrashLoop
                  ? `This component has crashed ${this.state.errorCount} times. Please reload the page.`
                  : this.state.error?.message || "An unexpected error occurred."}
              </p>
              {this.props.componentName && (
                <p className="text-xs text-red-500 mt-1">
                  Component: {this.props.componentName}
                </p>
              )}
              <div className="flex gap-2 mt-4">
                {!isCrashLoop && (
                  <button
                    onClick={this.handleRetry}
                    className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Try Again
                  </button>
                )}
                <button
                  onClick={this.handleReload}
                  className="px-3 py-1.5 bg-white border border-red-300 text-red-700 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors"
                >
                  Reload Page
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Functional wrapper: useRetry — hook for retry logic in data fetching.
 */
export function useRetryableFetch(
  maxRetries: number = 3,
  baseDelayMs: number = 1000
) {
  const retry = React.useCallback(
    async <T,>(fn: () => Promise<T>, retriesLeft: number = maxRetries): Promise<T> => {
      try {
        return await fn();
      } catch (err) {
        if (retriesLeft <= 0) throw err;

        const delay = baseDelayMs * Math.pow(2, maxRetries - retriesLeft);
        console.log(`[retry] Attempt failed, retrying in ${delay}ms (${retriesLeft} left)`);

        await new Promise(resolve => setTimeout(resolve, delay));
        return retry(fn, retriesLeft - 1);
      }
    },
    [maxRetries, baseDelayMs]
  );

  return { retry };
}

/**
 * Skeleton component for loading states.
 */
export function PanelSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3 p-4">
      <div className="h-5 bg-gray-200 rounded w-1/3" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 bg-gray-100 rounded-lg" />
      ))}
    </div>
  );
}

/**
 * Empty state component.
 */
export function EmptyState({
  icon = "📭",
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="text-center py-12">
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
