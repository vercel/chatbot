"use client";

import { useCallback, useEffect, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import type { ChatHistory } from "@/components/sidebar-history";
import { getChatHistoryPaginationKey } from "@/components/sidebar-history";

export type UseChatHistoryParams = {
  userId?: string;
  pageSize?: number;
};

export function useChatHistory({ userId, pageSize = 20 }: UseChatHistoryParams) {
  const { mutate } = useSWRConfig();
  const [page, setPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const { data: history, error, isLoading, mutate: mutateHistory } = useSWR<ChatHistory>(
    userId ? "/api/history" : null,
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch chat history");
      }
      return response.json();
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 1000,
    }
  );

  const chats = history?.chats || [];
  const hasMore = history?.hasMore || false;

  // Paginated chats
  const paginatedChats = chats.slice(0, page * pageSize);
  const displayedChats = isLoadingMore ? paginatedChats : chats;

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      // In a real implementation, you'd fetch the next page
      // For now, we'll just increase the page to show more items
      setPage(prev => prev + 1);
      
      // Trigger revalidation to get more data
      await mutateHistory();
    } catch (error) {
      console.error("Failed to load more chats:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, mutateHistory]);

  const deleteChat = useCallback(async (chatId: string) => {
    try {
      const response = await fetch(`/api/chat/${chatId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        throw new Error("Failed to delete chat");
      }
      
      // Update local cache
      mutate(unstable_serialize(getChatHistoryPaginationKey));
      
      // Also mutate the main history endpoint
      await mutateHistory();
    } catch (error) {
      console.error("Failed to delete chat:", error);
      throw error;
    }
  }, [mutate, mutateHistory]);

  const refreshHistory = useCallback(async () => {
    setPage(1);
    await mutateHistory();
  }, [mutateHistory]);

  const searchChats = useCallback((query: string) => {
    if (!query.trim()) return chats;
    
    const lowercaseQuery = query.toLowerCase();
    return chats.filter(chat => 
      chat.title?.toLowerCase().includes(lowercaseQuery)
    );
  }, [chats]);

  // Auto-refresh on interval for real-time updates
  useEffect(() => {
    if (!userId) return;

    const interval = setInterval(() => {
      mutateHistory();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [userId, mutateHistory]);

  return {
    chats: displayedChats,
    allChats: chats,
    isLoading,
    error,
    hasMore,
    isLoadingMore,
    page,
    loadMore,
    deleteChat,
    refreshHistory,
    searchChats,
    mutate: mutateHistory,
  };
}
