"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { SessionEvent } from "@/lib/types";

const WS_PORT = 3001;

interface UseRealtimeEventsResult {
  events: SessionEvent[];
  isConnected: boolean;
  reconnectCount: number;
}

export function useRealtimeEvents(sessionId: string): UseRealtimeEventsResult {
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);

  const fromLineRef = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(1000);

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname;
    const url = `${protocol}//${host}:${WS_PORT}?session_id=${sessionId}&from_line=${fromLineRef.current}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      backoffRef.current = 1000;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as {
          events: SessionEvent[];
          total_lines: number;
        };
        if (data.events.length > 0) {
          fromLineRef.current = data.total_lines;
          setEvents((prev) => [...prev, ...data.events]);
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      setIsConnected(false);

      const delay = backoffRef.current;
      backoffRef.current = Math.min(backoffRef.current * 2, 30000);

      reconnectTimeoutRef.current = setTimeout(() => {
        setReconnectCount((c) => c + 1);
        connect();
      }, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [sessionId]);

  useEffect(() => {
    setEvents([]);
    setIsConnected(false);
    setReconnectCount(0);
    fromLineRef.current = 0;
    backoffRef.current = 1000;

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [sessionId, connect]);

  return { events, isConnected, reconnectCount };
}
