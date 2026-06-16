"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import type { SessionSummary } from "@/lib/session-store";

interface SessionSelectorProps {
  sessions: SessionSummary[];
  currentId: string | null;
}

const statusConfig = {
  running: { label: "运行中", dot: "bg-gain", bg: "bg-gain/10" },
  paused: { label: "已暂停", dot: "bg-warning", bg: "bg-warning/10" },
  ended: { label: "已停止", dot: "bg-muted-foreground", bg: "bg-muted" },
} as const;

export function SessionSelector({ sessions, currentId }: SessionSelectorProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentSession = sessions.find((s) => s.id === currentId);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted min-w-[160px] max-w-[220px]"
      >
        {currentSession && (
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusConfig[currentSession.status].dot}`} />
        )}
        <span className="truncate flex-1 text-left">
          {currentSession?.name ?? "选择会话"}
        </span>
        <svg className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 w-[280px] bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="max-h-[320px] overflow-y-auto">
            {sessions.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted-foreground text-center">暂无会话</div>
            ) : (
              sessions.map((session) => {
                const isActive = session.id === currentId;
                const cfg = statusConfig[session.status];
                return (
                  <button
                    key={session.id}
                    onClick={() => {
                      router.push(`/?session=${session.id}`);
                      setOpen(false);
                    }}
                    className={`w-full px-4 py-2.5 text-left hover:bg-muted flex items-center gap-3 transition-colors ${
                      isActive ? "bg-primary/5" : ""
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot} ${session.status === "running" ? "animate-pulse" : ""}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{session.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{session.id}</div>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${cfg.bg} text-foreground shrink-0`}>
                      {cfg.label}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          <div className="border-t border-border">
            <button
              onClick={() => {
                router.push("/?create=true");
                setOpen(false);
              }}
              className="w-full px-4 py-2.5 text-sm text-primary font-medium hover:bg-muted flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              新建会话
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
