"use client";

import { pauseSession, resumeSession, stopSession } from "@/app/actions/session-control";
import { runOneCycle } from "@/app/actions/trading-cycle";
import type { SessionStatus, SessionInitEvent } from "@/lib/types";
import type { SessionSummary } from "@/lib/session-store";
import { useTransition, useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { SessionSelector } from "./session-selector";
import { AccountManagerDialog } from "./account-manager";
import { StrategySettings } from "./strategy-settings";
import { useSessionState } from "@/app/context/session-state-context";

// -- Inline SVG Icons --

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11.04-6.86a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14z" />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function CycleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
      <path d="M21 2v6h-6" />
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M3 22v-6h6" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    </svg>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className ?? ""}`} width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

interface TopNavProps {
  sessionName: string;
  status: SessionStatus;
  tags: string[];
  sessionId: string;
  sessions: SessionSummary[];
  agentConfig?: SessionInitEvent["agent_config"];
}

export function TopNav({ sessionName, status, tags, sessionId, sessions, agentConfig }: TopNavProps) {
  const [isPending, startTransition] = useTransition();
  const [cycleResult, setCycleResult] = useState<string | null>(null);
  const [showAccounts, setShowAccounts] = useState(false);
  const [showStrategy, setShowStrategy] = useState(false);
  const [stopConfirm, setStopConfirm] = useState(false);
  const [stopCountdown, setStopCountdown] = useState(3);
  const stopTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();
  const { mode, setMode, nextCycleAt } = useSessionState();

  // Countdown display
  const [countdown, setCountdown] = useState<string | null>(null);
  useEffect(() => {
    if (!nextCycleAt || mode !== "live" || status !== "running") {
      setCountdown(null);
      return;
    }
    function tick() {
      const diff = Math.max(0, Math.ceil((nextCycleAt! - Date.now()) / 1000));
      if (diff <= 0) { setCountdown(null); return; }
      const m = Math.floor(diff / 60);
      const s = diff % 60;
      setCountdown(m > 0 ? `${m}m${s.toString().padStart(2, "0")}s` : `${s}s`);
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [nextCycleAt, mode, status]);

  // Clear stop confirmation timer on unmount
  useEffect(() => {
    return () => {
      if (stopTimerRef.current) {
        clearInterval(stopTimerRef.current);
      }
    };
  }, []);

  // Countdown logic for stop confirmation
  useEffect(() => {
    if (stopConfirm) {
      setStopCountdown(3);
      stopTimerRef.current = setInterval(() => {
        setStopCountdown((prev) => {
          if (prev <= 1) {
            // Auto-cancel
            setStopConfirm(false);
            if (stopTimerRef.current) {
              clearInterval(stopTimerRef.current);
              stopTimerRef.current = null;
            }
            return 3;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (stopTimerRef.current) {
          clearInterval(stopTimerRef.current);
          stopTimerRef.current = null;
        }
      };
    }
  }, [stopConfirm]);

  function handleRunCycle() {
    setCycleResult(null);
    startTransition(async () => {
      try {
        const result = await runOneCycle(sessionId);
        const action = result.decision.type === "agent_decision"
          ? result.decision.action
          : "error";
        setCycleResult(`Cycle #${result.cycle}: ${action} (${result.orders.length} orders)`);
      } catch (e) {
        setCycleResult(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
      }
    });
  }

  const statusColor = {
    running: "bg-green-500",
    paused: "bg-yellow-500",
    ended: "bg-gray-400",
  }[status];

  const statusLabel = {
    running: "运行中",
    paused: "已暂停",
    ended: "已停止",
  }[status];

  function handlePause() {
    startTransition(async () => {
      await pauseSession(sessionId);
      router.refresh();
    });
  }

  function handleResume() {
    startTransition(async () => {
      await resumeSession(sessionId);
      router.refresh();
    });
  }

  const handleStopClick = useCallback(() => {
    if (!stopConfirm) {
      // First click: show confirmation
      setStopConfirm(true);
    } else {
      // Second click: confirm stop
      setStopConfirm(false);
      if (stopTimerRef.current) {
        clearInterval(stopTimerRef.current);
        stopTimerRef.current = null;
      }
      startTransition(async () => {
        await stopSession(sessionId);
        router.refresh();
      });
    }
  }, [stopConfirm, sessionId, router]);

  const handleStopCancel = useCallback(() => {
    setStopConfirm(false);
    if (stopTimerRef.current) {
      clearInterval(stopTimerRef.current);
      stopTimerRef.current = null;
    }
  }, []);

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-card">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${statusColor} ${status === "running" ? "animate-pulse" : ""}`} />
        <h1 className="text-lg font-semibold">{sessionName}</h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Info group: strategy & account */}
        <button
          onClick={() => setShowStrategy(true)}
          className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted"
          title="查看和编辑策略配置"
        >
          策略
        </button>
        <button
          onClick={() => setShowAccounts(true)}
          className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted"
          title="管理交易账户"
        >
          账户
        </button>
        <SessionSelector sessions={sessions} currentId={sessionId} />

        {/* Replay toggle */}
        <button
          onClick={() => setMode(mode === "replay" ? "live" : "replay")}
          className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
            mode === "replay"
              ? "border-cyan-500 bg-cyan-50 text-cyan-700"
              : "border-border hover:bg-muted text-muted-foreground"
          }`}
          title={mode === "replay" ? "切回实时模式" : "进入回放模式"}
        >
          {mode === "replay" ? "回放中" : "回放"}
        </button>

        {/* Separator between info and control groups */}
        <div className="w-px h-6 bg-border" />

        {/* Control group: cycle, pause/resume, stop */}
        {status === "running" && (
          <button
            onClick={handleRunCycle}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-opacity"
            title="手动触发一次交易决策循环"
          >
            {isPending ? <Spinner /> : <CycleIcon />}
            <span>执行一轮</span>
            {countdown && (
              <span className="text-xs opacity-75 ml-1">({countdown})</span>
            )}
          </button>
        )}

        {cycleResult && (
          <span className="text-xs text-muted-foreground max-w-[200px] truncate" title={cycleResult}>
            {cycleResult}
          </span>
        )}

        {status === "running" && (
          <button
            onClick={handlePause}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted disabled:opacity-50 transition-opacity"
            title="暂停策略运行，可随时恢复"
          >
            {isPending ? <Spinner /> : <PauseIcon />}
            <span>暂停</span>
          </button>
        )}

        {status === "paused" && (
          <button
            onClick={handleResume}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-opacity"
            title="恢复策略运行"
          >
            {isPending ? <Spinner /> : <PlayIcon />}
            <span>恢复</span>
          </button>
        )}

        {status !== "ended" && (
          <div className="relative inline-flex items-center">
            <button
              onClick={handleStopClick}
              disabled={isPending}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-all disabled:opacity-50 ${
                stopConfirm
                  ? "border-red-500 bg-red-600 text-white hover:bg-red-700"
                  : "border-red-300 text-red-600 hover:bg-red-50"
              }`}
              title={stopConfirm ? "再次点击确认停止" : "停止策略（不可恢复）"}
            >
              {isPending ? <Spinner /> : <StopIcon />}
              <span>{stopConfirm ? `确认停止？(${stopCountdown}s)` : "停止"}</span>
            </button>
            {stopConfirm && (
              <button
                onClick={handleStopCancel}
                className="ml-1 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
                title="取消停止操作"
              >
                取消
              </button>
            )}
          </div>
        )}
      </div>

      <AccountManagerDialog open={showAccounts} onClose={() => setShowAccounts(false)} />
      {agentConfig && (
        <StrategySettings
          open={showStrategy}
          onClose={() => setShowStrategy(false)}
          sessionId={sessionId}
          currentConfig={agentConfig}
          locked={status !== "ended"}
        />
      )}
    </header>
  );
}
