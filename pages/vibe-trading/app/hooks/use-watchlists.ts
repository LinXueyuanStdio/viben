"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { WatchlistConfig } from "@/lib/types";
import { watchlistEvents } from "./watchlist-events";

export function useWatchlists(workspacePath?: string) {
  const [lists, setLists] = useState<WatchlistConfig[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const activeListIdRef = useRef(activeListId);
  activeListIdRef.current = activeListId;

  const qp = workspacePath ? `?workspace_path=${encodeURIComponent(workspacePath)}` : "";

  const fetchLists = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/watchlist${qp}`);
      const data = await res.json() as { lists: WatchlistConfig[] };
      setLists(data.lists);
      if (data.lists.length > 0 && !activeListIdRef.current) {
        setActiveListId(data.lists[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [qp]);

  useEffect(() => { fetchLists(); }, [fetchLists]);

  useEffect(() => watchlistEvents.subscribe(fetchLists), [fetchLists]);

  const createList = useCallback(async (params: { name: string; color?: string; refresh_interval?: number; refresh_prompt?: string }) => {
    const res = await fetch(`/api/watchlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...params, workspace_path: workspacePath }),
    });
    const data = await res.json() as { list: WatchlistConfig };
    setLists((prev) => [...prev, data.list]);
    setActiveListId(data.list.id);
    return data.list;
  }, [workspacePath]);

  const updateList = useCallback(async (listId: string, updates: Record<string, unknown>) => {
    const res = await fetch(`/api/watchlist/${listId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...updates, workspace_path: workspacePath }),
    });
    const data = await res.json() as { list: WatchlistConfig };
    setLists((prev) => prev.map((l) => l.id === listId ? data.list : l));
    return data.list;
  }, [workspacePath]);

  const deleteList = useCallback(async (listId: string) => {
    await fetch(`/api/watchlist/${listId}?${workspacePath ? `workspace_path=${encodeURIComponent(workspacePath)}` : ""}`, {
      method: "DELETE",
    });
    setLists((prev) => {
      const remaining = prev.filter((l) => l.id !== listId);
      if (activeListIdRef.current === listId) {
        setActiveListId(remaining[0]?.id ?? null);
      }
      return remaining;
    });
  }, [workspacePath]);

  const addSymbols = useCallback(async (listId: string, symbols: string[]) => {
    const res = await fetch(`/api/watchlist/${listId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add_symbols", symbols, workspace_path: workspacePath }),
    });
    const data = await res.json() as { list: WatchlistConfig };
    setLists((prev) => prev.map((l) => l.id === listId ? data.list : l));
    return data.list;
  }, [workspacePath]);

  const removeSymbols = useCallback(async (listId: string, symbols: string[]) => {
    const res = await fetch(`/api/watchlist/${listId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove_symbols", symbols, workspace_path: workspacePath }),
    });
    const data = await res.json() as { list: WatchlistConfig };
    setLists((prev) => prev.map((l) => l.id === listId ? data.list : l));
    return data.list;
  }, [workspacePath]);

  const setAnnotation = useCallback(async (listId: string, symbol: string, annotation: string) => {
    await fetch(`/api/watchlist/${listId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_annotation", symbol, annotation, workspace_path: workspacePath }),
    });
    setLists((prev) => prev.map((l) => {
      if (l.id !== listId) return l;
      return { ...l, symbols: l.symbols.map((s) => s.symbol === symbol ? { ...s, annotation } : s) };
    }));
  }, [workspacePath]);

  const activeList = lists.find((l) => l.id === activeListId) ?? null;

  return {
    lists,
    activeList,
    activeListId,
    setActiveListId,
    loading,
    createList,
    updateList,
    deleteList,
    addSymbols,
    removeSymbols,
    setAnnotation,
    refresh: fetchLists,
  };
}
