"use client";

import { useCallback, useEffect, useState } from "react";

export type ConnectionStatus = "online" | "offline" | "connecting" | "reconnecting";

export type UseOnlineStatusOptions = {
  pingUrl?: string;
  pingInterval?: number;
  pingTimeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  enablePing?: boolean;
};

export function useOnlineStatus({
  pingUrl = "/api/health",
  pingInterval = 30000, // 30 seconds
  pingTimeout = 5000, // 5 seconds
  retryAttempts = 3,
  retryDelay = 1000, // 1 second
  enablePing = true,
}: UseOnlineStatusOptions = {}) {
  const [status, setStatus] = useState<ConnectionStatus>("online");
  const [lastOnline, setLastOnline] = useState<Date>(new Date());
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Check browser's online status
  const isBrowserOnline = useCallback(() => {
    return typeof navigator !== "undefined" ? navigator.onLine : true;
  }, []);

  // Ping server to check actual connectivity
  const pingServer = useCallback(async (): Promise<boolean> => {
    if (!enablePing) return isBrowserOnline();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), pingTimeout);

      const response = await fetch(pingUrl, {
        method: "HEAD",
        signal: controller.signal,
        cache: "no-cache",
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.warn("Ping failed:", error);
      return false;
    }
  }, [pingUrl, pingTimeout, enablePing, isBrowserOnline]);

  // Update connection status
  const updateStatus = useCallback(async (forcePing = false) => {
    const browserOnline = isBrowserOnline();
    
    if (!browserOnline) {
      setStatus("offline");
      return;
    }

    if (enablePing || forcePing) {
      const serverReachable = await pingServer();
      
      if (serverReachable) {
        setStatus("online");
        setLastOnline(new Date());
        setIsReconnecting(false);
        setRetryCount(0);
      } else if (status === "online") {
        setStatus("connecting");
        setIsReconnecting(true);
      } else if (status === "connecting" || status === "reconnecting") {
        setStatus("reconnecting");
      } else {
        setStatus("offline");
      }
    } else {
      setStatus(browserOnline ? "online" : "offline");
      if (browserOnline) {
        setLastOnline(new Date());
        setIsReconnecting(false);
        setRetryCount(0);
      }
    }
  }, [isBrowserOnline, enablePing, pingServer, status]);

  // Manual reconnection attempt
  const reconnect = useCallback(async () => {
    if (isReconnecting) return;

    setIsReconnecting(true);
    setStatus("reconnecting");

    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      setRetryCount(attempt);
      
      const success = await pingServer();
      if (success) {
        setStatus("online");
        setLastOnline(new Date());
        setIsReconnecting(false);
        setRetryCount(0);
        return true;
      }

      if (attempt < retryAttempts) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      }
    }

    setStatus("offline");
    setIsReconnecting(false);
    setRetryCount(0);
    return false;
  }, [isReconnecting, retryAttempts, retryDelay, pingServer]);

  // Handle browser online/offline events
  useEffect(() => {
    const handleOnline = () => {
      updateStatus();
    };

    const handleOffline = () => {
      setStatus("offline");
    };

    if (typeof window !== "undefined") {
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, [updateStatus]);

  // Periodic ping to check connection
  useEffect(() => {
    if (!enablePing) return;

    const interval = setInterval(() => {
      updateStatus();
    }, pingInterval);

    // Initial check
    updateStatus();

    return () => clearInterval(interval);
  }, [enablePing, pingInterval, updateStatus]);

  // Visibility change - check status when tab becomes visible
  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        updateStatus(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [updateStatus]);

  return {
    status,
    isOnline: status === "online",
    isOffline: status === "offline",
    isConnecting: status === "connecting" || status === "reconnecting",
    lastOnline,
    isReconnecting,
    retryCount,
    reconnect,
    updateStatus,
  };
}

// Hook for showing connection status to users
export function useConnectionIndicator() {
  const { status, isOnline, isOffline, isConnecting, lastOnline, reconnect } = useOnlineStatus();

  const getStatusMessage = () => {
    switch (status) {
      case "online":
        return "Connected";
      case "offline":
        return "Offline";
      case "connecting":
        return "Connecting...";
      case "reconnecting":
        return "Reconnecting...";
      default:
        return "Unknown";
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case "online":
        return "text-green-500";
      case "offline":
        return "text-red-500";
      case "connecting":
      case "reconnecting":
        return "text-yellow-500";
      default:
        return "text-gray-500";
    }
  };

  const getTimeSinceLastOnline = () => {
    const now = new Date();
    const diff = now.getTime() - lastOnline.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
    return "Just now";
  };

  return {
    status,
    isOnline,
    isOffline,
    isConnecting,
    lastOnline,
    reconnect,
    getStatusMessage,
    getStatusColor,
    getTimeSinceLastOnline,
  };
}
