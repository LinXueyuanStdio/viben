"use client";

import { useVibenConnection } from "@/app/context/viben-connection-context";

export function AgentPanel() {
  const conn = useVibenConnection();

  if (!conn) {
    return <div className="p-4 text-sm text-muted-foreground">Agent 连接未初始化</div>;
  }

  const { connectionState, clientId, logs, registeredActions } = conn;

  const statusConfig = {
    connected: { dot: "bg-gain", label: "已连接", animate: false },
    connecting: { dot: "bg-warning", label: "连接中...", animate: true },
    disconnected: { dot: "bg-muted-foreground", label: "未连接", animate: false },
    error: { dot: "bg-loss", label: "连接错误", animate: false },
  };

  const status = statusConfig[connectionState];

  return (
    <div className="flex flex-col h-full">
      {/* Status Bar */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 mb-2">
          <span className="relative flex h-2 w-2">
            {status.animate && (
              <span
                className={`absolute inline-flex h-full w-full animate-ping rounded-full ${status.dot} opacity-75`}
              />
            )}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${status.dot}`} />
          </span>
          <span className="text-sm font-medium">{status.label}</span>
        </div>
        {clientId && (
          <p className="text-xs text-muted-foreground font-mono truncate">ID: {clientId}</p>
        )}
      </div>

      {/* Registered Actions */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase">Actions</h3>
          <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
            {registeredActions.length}
          </span>
        </div>
        {registeredActions.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">暂无注册的 action</p>
        ) : (
          <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
            {registeredActions.map((a) => (
              <div
                key={a.name}
                className="rounded border border-border bg-muted px-2 py-1.5"
              >
                <p className="text-xs font-mono font-semibold text-cyan-700">
                  trading.{a.name}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{a.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Connection Logs */}
      <div className="flex-1 min-h-0 flex flex-col px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase">连接日志</h3>
        </div>
        <div className="flex-1 overflow-y-auto font-mono text-xs leading-relaxed space-y-0.5 bg-muted rounded border border-border p-2">
          {logs.length === 0 ? (
            <p className="text-muted-foreground italic text-center py-4">等待连接...</p>
          ) : (
            logs.map((l, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-muted-foreground shrink-0">[{l.time}]</span>
                <span
                  className={
                    l.type === "error"
                      ? "text-loss"
                      : l.type === "success"
                        ? "text-gain"
                        : "text-muted-foreground"
                  }
                >
                  {l.msg}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
