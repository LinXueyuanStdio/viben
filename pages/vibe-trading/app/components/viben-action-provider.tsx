"use client";

import { useMemo, useEffect, useRef } from "react";
import { useSessionState } from "@/app/context/session-state-context";
import { useVibenPage } from "@/app/hooks/use-viben-page";
import { useVibenConnection } from "@/app/context/viben-connection-context";

interface VibenActionProviderProps {
  sessionId: string;
}

export function VibenActionProvider({ sessionId }: VibenActionProviderProps) {
  const { state, mode, setMode, replay } = useSessionState();

  const actions = useMemo(
    () => ({
      get_status: {
        description: "获取交易会话状态概览：状态、指标、持仓数量等",
        execute: async () => ({
          session_id: sessionId,
          status: state.status,
          current_cycle: state.current_cycle,
          mode,
          nav: state.metrics.nav,
          total_pnl: state.metrics.total_pnl,
          win_rate: state.metrics.win_rate,
          positions_count: state.positions.length,
          total_trades: state.metrics.total_trades,
        }),
      },

      get_positions: {
        description: "获取当前所有持仓的详细信息",
        execute: async () => state.positions,
      },

      get_metrics: {
        description: "获取完整交易指标：NAV、PnL、胜率、回撤、夏普比率等",
        execute: async () => state.metrics,
      },

      get_recent_decisions: {
        description: "获取最近的 AI 决策记录",
        inputSchema: {
          type: "object",
          properties: {
            count: { type: "number", description: "返回的决策数量，默认 5" },
          },
        },
        execute: async (payload: unknown) => {
          const p = payload as { count?: number } | null;
          const count = p?.count ?? 5;
          return state.decisions.slice(-count);
        },
      },

      run_cycle: {
        description: "手动触发一次交易决策周期",
        execute: async () => {
          const res = await fetch(`/api/sessions/${sessionId}/cycle`, { method: "POST" });
          const data = await res.json();
          if (data.error) throw new Error(data.error);
          return data;
        },
      },

      pause_session: {
        description: "暂停当前交易会话",
        execute: async () => {
          const res = await fetch(`/api/sessions/${sessionId}/control`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "pause" }),
          });
          const data = await res.json();
          if (data.error) throw new Error(data.error);
          return "Session paused";
        },
      },

      resume_session: {
        description: "恢复暂停的交易会话",
        execute: async () => {
          const res = await fetch(`/api/sessions/${sessionId}/control`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "resume" }),
          });
          const data = await res.json();
          if (data.error) throw new Error(data.error);
          return "Session resumed";
        },
      },

      stop_session: {
        description: "永久停止当前交易会话（不可逆）",
        execute: async () => {
          const res = await fetch(`/api/sessions/${sessionId}/control`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "stop" }),
          });
          const data = await res.json();
          if (data.error) throw new Error(data.error);
          return "Session stopped";
        },
      },

      set_mode: {
        description: '切换前端显示模式："live"（实时）或 "replay"（回放）',
        inputSchema: {
          type: "object",
          properties: {
            mode: { type: "string", enum: ["live", "replay"], description: "显示模式" },
          },
          required: ["mode"],
        },
        execute: async (payload: unknown) => {
          const p = payload as { mode?: string } | null;
          const newMode = p?.mode;
          if (newMode !== "live" && newMode !== "replay") {
            throw new Error('Invalid mode, must be "live" or "replay"');
          }
          setMode(newMode);
          return `Switched to ${newMode} mode`;
        },
      },

      replay_seek: {
        description: "在回放模式下，跳转到指定的事件索引",
        inputSchema: {
          type: "object",
          properties: {
            index: { type: "number", description: "要跳转到的事件索引（从 0 开始）" },
          },
          required: ["index"],
        },
        execute: async (payload: unknown) => {
          if (mode !== "replay") {
            throw new Error("Not in replay mode. Switch to replay mode first.");
          }
          const p = payload as { index?: number } | null;
          const index = p?.index ?? 0;
          replay.seek(index);
          return `Seeked to event #${index + 1}/${replay.totalEvents}`;
        },
      },
    }),
    [sessionId, state, mode, setMode, replay]
  );

  const { connected, clientId } = useVibenPage("trading", actions);

  const conn = useVibenConnection();
  const prevConnectedRef = useRef(connected);

  useEffect(() => {
    if (!conn) return;
    conn.setConnectionState(connected ? "connected" : "disconnected");
    conn.setClientId(clientId);
    if (connected !== prevConnectedRef.current) {
      if (connected) {
        conn.addLog("SDK 已连接，actions 已注册", "success");
        conn.setRegisteredActions(
          Object.entries(actions).map(([name, def]) => ({
            name,
            description: typeof def === "function" ? name : def.description,
          }))
        );
      } else {
        conn.addLog("已断开连接", "msg");
      }
      prevConnectedRef.current = connected;
    }
  }, [connected, clientId, conn, actions]);

  return null;
}
