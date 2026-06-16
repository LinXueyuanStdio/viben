"use client";

import { useState } from "react";
import type { WatchlistConfig } from "@/lib/types";
import { ListConfigDialog } from "./list-config-dialog";
import { IconPlus, IconEdit, IconTrash } from "./icons";

interface WatchlistTabsProps {
  lists: WatchlistConfig[];
  activeListId: string | null;
  onSelect: (id: string) => void;
  onCreate: (config: { name: string; color: string; refresh_interval: number; refresh_prompt: string; initial_symbols?: string[]; run_refresh_prompt?: boolean }) => void;
  onUpdate: (listId: string, config: { name?: string; color?: string; refresh_interval?: number; refresh_prompt?: string }) => void;
  onDelete: (listId: string) => void;
  onRefreshPrompt?: (prompt: string) => Promise<void>;
}

export function WatchlistTabs({ lists, activeListId, onSelect, onCreate, onUpdate, onDelete, onRefreshPrompt }: WatchlistTabsProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingList, setEditingList] = useState<WatchlistConfig | null>(null);
  const [contextMenu, setContextMenu] = useState<{ listId: string; x: number; y: number } | null>(null);

  function handleContextMenu(e: React.MouseEvent, list: WatchlistConfig) {
    e.preventDefault();
    setContextMenu({ listId: list.id, x: e.clientX, y: e.clientY });
  }

  function handleEdit() {
    const list = lists.find((l) => l.id === contextMenu?.listId);
    if (list) { setEditingList(list); setShowDialog(true); }
    setContextMenu(null);
  }

  function handleDelete() {
    if (contextMenu) onDelete(contextMenu.listId);
    setContextMenu(null);
  }

  return (
    <>
      <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-border overflow-x-auto">
        {lists.map((list) => (
          <button
            key={list.id}
            onClick={() => onSelect(list.id)}
            onContextMenu={(e) => handleContextMenu(e, list)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md whitespace-nowrap transition-all ${
              activeListId === list.id
                ? "font-medium text-foreground bg-muted shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: list.color }}
            />
            {list.name}
          </button>
        ))}
        <button
          onClick={() => { setEditingList(null); setShowDialog(true); }}
          className="ml-1 px-2 py-1.5 text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-md transition-colors"
          title="新建列表"
        >
          <IconPlus size={12} />
        </button>
      </div>

      {contextMenu && (
        <div
          className="fixed z-50 bg-card border border-border rounded-lg shadow-lg py-1 text-xs min-w-[100px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseLeave={() => setContextMenu(null)}
        >
          <button onClick={handleEdit} className="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-muted transition-colors">
            <IconEdit size={12} />
            编辑
          </button>
          <button onClick={handleDelete} className="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-destructive/10 text-destructive transition-colors">
            <IconTrash size={12} />
            删除
          </button>
        </div>
      )}

      <ListConfigDialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        initial={editingList}
        onRefreshPrompt={editingList ? onRefreshPrompt : undefined}
        onSave={(config) => {
          if (editingList) {
            const { initial_symbols, run_refresh_prompt, ...updates } = config;
            onUpdate(editingList.id, updates);
          } else {
            onCreate(config);
          }
        }}
      />
    </>
  );
}
