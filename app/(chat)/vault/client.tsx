"use client";

import {
  AlertTriangle,
  CheckCircle,
  EyeOffIcon,
  Key,
  Loader2,
  XCircle,
} from "lucide-react";
import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";

interface VaultKey {
  name: string;
  category: string;
  description: string;
}

type KeyStatus =
  | "idle"
  | "testing"
  | "connected"
  | "configured"
  | "missing"
  | "error";

interface KeyState {
  status: KeyStatus;
  message?: string;
  latency?: number;
}

export function VaultClient({ keys }: { keys: VaultKey[] }) {
  const [keyStates, setKeyStates] = useState<Record<string, KeyState>>({});

  const testKey = useCallback(async (keyName: string) => {
    setKeyStates((prev) => ({
      ...prev,
      [keyName]: { status: "testing" },
    }));

    try {
      const res = await fetch(`/api/vault/test/${keyName}`, {
        method: "POST",
      });

      const data = await res.json();
      setKeyStates((prev) => ({
        ...prev,
        [keyName]: {
          status: data.status || "error",
          message: data.message,
          latency: data.latency,
        },
      }));
    } catch {
      setKeyStates((prev) => ({
        ...prev,
        [keyName]: { status: "error", message: "Test request failed" },
      }));
    }
  }, []);

  const groupedKeys = keys.reduce(
    (acc, key) => {
      if (!acc[key.category]) acc[key.category] = [];
      acc[key.category].push(key);
      return acc;
    },
    {} as Record<string, VaultKey[]>
  );

  const statusIcon = (status: KeyStatus) => {
    switch (status) {
      case "testing":
        return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
      case "connected":
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case "configured":
        return <CheckCircle className="w-4 h-4 text-yellow-400" />;
      case "missing":
        return <XCircle className="w-4 h-4 text-red-400" />;
      case "error":
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
      default:
        return <EyeOffIcon className="w-4 h-4 text-gray-500" />;
    }
  };

  const statusBadge = (status: KeyStatus) => {
    const styles: Record<KeyStatus, string> = {
      idle: "bg-gray-800 text-gray-400 ring-gray-700",
      testing: "bg-blue-950 text-blue-400 ring-blue-800",
      connected: "bg-green-950 text-green-400 ring-green-800",
      configured: "bg-yellow-950 text-yellow-400 ring-yellow-800",
      missing: "bg-red-950 text-red-400 ring-red-800",
      error: "bg-red-950 text-red-400 ring-red-800",
    };
    return cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1",
      styles[status]
    );
  };

  return (
    <div className="space-y-8">
      {Object.entries(groupedKeys).map(([category, categoryKeys]) => (
        <div key={category}>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
            {category}
          </h2>
          <div className="grid gap-3">
            {categoryKeys.map((key) => {
              const state = keyStates[key.name];
              const status = state?.status || "idle";
              return (
                <div
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                  key={key.name}
                >
                  <Key className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono truncate">
                        {key.name}
                      </code>
                      <span className={statusBadge(status)}>
                        {statusIcon(status)}
                        <span className="capitalize">{status}</span>
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {state?.message || key.description}
                    </p>
                    {state?.latency != null && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Latency: {state.latency}ms
                      </p>
                    )}
                  </div>
                  <button
                    className="px-3 py-1.5 text-xs rounded-md bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors"
                    disabled={status === "testing"}
                    onClick={() => testKey(key.name)}
                  >
                    {status === "testing" ? "Testing..." : "Test"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
