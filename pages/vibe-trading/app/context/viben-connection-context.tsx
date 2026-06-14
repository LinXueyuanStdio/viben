"use client";

import { createContext, useContext, useState, useCallback } from "react";
type ConnectionState = "connecting" | "connected" | "disconnected" | "error";

export interface ConnectionLog {
  time: string;
  msg: string;
  type: "msg" | "success" | "error";
}

interface VibenConnectionContextValue {
  connectionState: ConnectionState;
  clientId: string | null;
  logs: ConnectionLog[];
  registeredActions: Array<{ name: string; description: string }>;
  addLog: (msg: string, type?: ConnectionLog["type"]) => void;
  setConnectionState: (state: ConnectionState) => void;
  setClientId: (id: string | null) => void;
  setRegisteredActions: (actions: Array<{ name: string; description: string }>) => void;
}

const VibenConnectionCtx = createContext<VibenConnectionContextValue | null>(null);

export function useVibenConnection() {
  return useContext(VibenConnectionCtx);
}

export function VibenConnectionProvider({ children }: { children: React.ReactNode }) {
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [clientId, setClientId] = useState<string | null>(null);
  const [logs, setLogs] = useState<ConnectionLog[]>([]);
  const [registeredActions, setRegisteredActions] = useState<Array<{ name: string; description: string }>>([]);

  const addLog = useCallback((msg: string, type: ConnectionLog["type"] = "msg") => {
    const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    setLogs((prev) => {
      const next = [...prev, { time, msg, type }];
      if (next.length > 100) next.shift();
      return next;
    });
  }, []);

  return (
    <VibenConnectionCtx.Provider
      value={{
        connectionState,
        clientId,
        logs,
        registeredActions,
        addLog,
        setConnectionState,
        setClientId,
        setRegisteredActions,
      }}
    >
      {children}
    </VibenConnectionCtx.Provider>
  );
}
