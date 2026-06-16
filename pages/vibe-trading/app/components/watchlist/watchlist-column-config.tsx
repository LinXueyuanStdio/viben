"use client";

import { useState } from "react";
import { COLUMN_DEFINITIONS, type WatchlistColumnKey } from "./types";
import { IconColumns, IconClose } from "./icons";

interface WatchlistColumnConfigProps {
  selected: WatchlistColumnKey[];
  onChange: (columns: WatchlistColumnKey[]) => void;
}

export function WatchlistColumnConfig({ selected, onChange }: WatchlistColumnConfigProps) {
  const [open, setOpen] = useState(false);
  const selectedSet = new Set(selected);

  const categories = Array.from(new Set(COLUMN_DEFINITIONS.map((c) => c.category)));
  const allKeys = COLUMN_DEFINITIONS.map((c) => c.key);

  function toggle(key: WatchlistColumnKey) {
    if (selectedSet.has(key)) {
      onChange(selected.filter((k) => k !== key));
    } else {
      onChange([...selected, key]);
    }
  }

  function selectAll() {
    onChange(allKeys);
  }

  function selectNone() {
    onChange([]);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
        title="列设置"
      >
        <IconColumns size={14} />
        {selected.length > 0 && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary text-white text-[9px] font-medium rounded-full flex items-center justify-center">
            {selected.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-50 bg-card border border-border rounded-lg shadow-xl p-4 w-[380px] max-h-[420px] overflow-auto">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-medium text-foreground">选择显示列</span>
              <div className="flex items-center gap-2">
                <button onClick={selectAll} className="text-[10px] text-primary hover:underline">全选</button>
                <span className="text-muted-foreground/40">|</span>
                <button onClick={selectNone} className="text-[10px] text-muted-foreground hover:underline">清空</button>
                <button onClick={() => setOpen(false)} className="ml-2 p-0.5 text-muted-foreground hover:text-foreground"><IconClose size={10} /></button>
              </div>
            </div>

            {categories.map((cat) => (
              <div key={cat} className="mb-3">
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">{cat}</div>
                <div className="flex flex-wrap gap-1">
                  {COLUMN_DEFINITIONS.filter((c) => c.category === cat).map((col) => (
                    <button
                      key={col.key}
                      onClick={() => toggle(col.key)}
                      className={`px-2 py-0.5 text-xs rounded-md border transition-all ${
                        selectedSet.has(col.key)
                          ? "bg-primary/10 border-primary/30 text-primary font-medium"
                          : "border-border text-muted-foreground hover:border-border hover:bg-muted"
                      }`}
                    >
                      {col.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
