"use client";

import { useMemo, useState, useCallback } from "react";
import { useWatchlists } from "@/app/hooks/use-watchlists";
import { useMarketQuote } from "@/app/hooks/use-market-quote";
import { WatchlistTabs } from "./watchlist-tabs";
import { WatchlistTable } from "./watchlist-table";
import { WatchlistColumnConfig } from "./watchlist-column-config";
import { PortfolioSummary } from "./portfolio-summary";
import { ListConfigDialog } from "./list-config-dialog";
import { IconRefresh, IconSpinner, IconClipboardPlus } from "./icons";
import { DEFAULT_COLUMNS, type WatchlistColumnKey } from "./types";
import { watchlistEvents } from "@/app/hooks/watchlist-events";

interface WatchlistProps {
  workspacePath?: string;
  onSymbolClick?: (symbol: string) => void;
}

async function runRefreshPrompt(listId: string, prompt: string, workspacePath?: string): Promise<void> {
  const res = await fetch("/api/watchlist/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, list_id: listId, workspace_path: workspacePath }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Refresh failed: ${res.status}`);
  }
  watchlistEvents.emit();
}

export function Watchlist({ workspacePath, onSymbolClick }: WatchlistProps) {
  const {
    lists, activeList, activeListId, setActiveListId,
    loading, createList, updateList, deleteList, addSymbols, refresh: refreshLists,
  } = useWatchlists(workspacePath);

  const symbols = useMemo(() => activeList?.symbols.map((s) => s.symbol) ?? [], [activeList]);
  const refreshInterval = activeList?.refresh_interval ? activeList.refresh_interval * 1000 : 5000;

  const { quotes, refresh: refreshQuotes } = useMarketQuote({
    symbols,
    interval: refreshInterval,
    enabled: symbols.length > 0,
  });

  const columns: WatchlistColumnKey[] = (activeList?.column_config?.length ?? 0) > 0
    ? (activeList!.column_config as WatchlistColumnKey[])
    : DEFAULT_COLUMNS;

  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const handleCreateList = useCallback(async (config: {
    name: string; color: string; refresh_interval: number; refresh_prompt: string;
    initial_symbols?: string[]; run_refresh_prompt?: boolean;
  }) => {
    const { initial_symbols, run_refresh_prompt, ...listConfig } = config;
    const list = await createList(listConfig);
    if (!list) return;

    if (initial_symbols && initial_symbols.length > 0) {
      await addSymbols(list.id, initial_symbols);
    } else if (run_refresh_prompt && config.refresh_prompt.trim()) {
      runRefreshPrompt(list.id, config.refresh_prompt, workspacePath);
    }
  }, [createList, addSymbols, workspacePath]);

  const handleRefreshPrompt = useCallback(async (prompt: string) => {
    if (!activeListId) return;
    await runRefreshPrompt(activeListId, prompt, workspacePath);
  }, [activeListId, workspacePath]);

  function handleColumnChange(newColumns: WatchlistColumnKey[]) {
    if (activeListId) {
      updateList(activeListId, { column_config: newColumns });
    }
  }

  function handleRefresh() {
    refreshLists();
    refreshQuotes();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        <IconSpinner size={16} className="mr-2" />
        加载中...
      </div>
    );
  }

  if (lists.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <IconClipboardPlus size={28} className="text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="text-sm text-muted-foreground font-medium">暂无自选列表</p>
          <p className="text-xs text-muted-foreground mt-1">创建列表后可添加标的，实时追踪行情</p>
        </div>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          创建第一个列表
        </button>
        <ListConfigDialog
          open={showCreateDialog}
          onClose={() => setShowCreateDialog(false)}
          onSave={(config) => { handleCreateList(config); setShowCreateDialog(false); }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between pr-3">
        <WatchlistTabs
          lists={lists}
          activeListId={activeListId}
          onSelect={setActiveListId}
          onCreate={handleCreateList}
          onUpdate={updateList}
          onDelete={deleteList}
          onRefreshPrompt={handleRefreshPrompt}
        />
        <div className="flex items-center gap-1">
          <WatchlistColumnConfig selected={columns} onChange={handleColumnChange} />
          <button
            onClick={handleRefresh}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
            title="刷新行情"
          >
            <IconRefresh size={14} />
          </button>
        </div>
      </div>

      <PortfolioSummary quotes={quotes} symbols={symbols} />

      <WatchlistTable
        symbols={activeList?.symbols ?? []}
        quotes={quotes}
        columns={columns}
        onAddSymbols={activeListId ? (syms) => addSymbols(activeListId, syms) : undefined}
        onSymbolClick={onSymbolClick}
      />
    </div>
  );
}
