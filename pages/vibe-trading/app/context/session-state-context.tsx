"use client";

import {
  createContext,
  useContext,
  useReducer,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import type { SessionState, SessionEvent } from "@/lib/types";
import { reduceEvent, createEmptyState } from "@/lib/state-reducer";

// ─── Types ──────────────────────────────────────────────────────────────────

type Mode = "live" | "replay";

export interface ReplayControls {
  isPlaying: boolean;
  speed: number;
  currentIndex: number;
  totalEvents: number;
  play: () => void;
  pause: () => void;
  step: () => void;
  stepBack: () => void;
  seek: (index: number) => void;
  setSpeed: (s: number) => void;
}

export interface SessionStateContextValue {
  state: SessionState;
  mode: Mode;
  replay: ReplayControls;
  setMode: (mode: Mode) => void;
  nextCycleAt: number | null;
}

// ─── Context ────────────────────────────────────────────────────────────────

const SessionStateCtx = createContext<SessionStateContextValue | null>(null);

export function useSessionState(): SessionStateContextValue {
  const ctx = useContext(SessionStateCtx);
  if (!ctx) throw new Error("useSessionState must be used within SessionStateProvider");
  return ctx;
}

// ─── Provider Props ─────────────────────────────────────────────────────────

interface ProviderProps {
  children: React.ReactNode;
  initialState: SessionState;
  allEvents: SessionEvent[];
  sessionId: string;
  intervalMinutes: number;
}

// ─── Reducer ────────────────────────────────────────────────────────────────

type Action =
  | { type: "PUSH_EVENTS"; events: SessionEvent[] }
  | { type: "SET_STATE"; state: SessionState };

function ensureArrays(s: SessionState): SessionState {
  if (!s.positions || !s.trades || !s.nav_history || !s.decisions || !s.tags) {
    return {
      ...s,
      positions: s.positions ?? [],
      trades: s.trades ?? [],
      nav_history: s.nav_history ?? [],
      decisions: s.decisions ?? [],
      tags: s.tags ?? [],
    };
  }
  return s;
}

function stateReducer(state: SessionState, action: Action): SessionState {
  switch (action.type) {
    case "PUSH_EVENTS": {
      let s = state;
      for (const event of action.events) {
        s = reduceEvent(s, event);
      }
      return ensureArrays(s);
    }
    case "SET_STATE":
      return ensureArrays(action.state);
  }
}

// ─── Helper: compute state from events[0..index] ────────────────────────────

function computeStateAtIndex(events: SessionEvent[], index: number): SessionState {
  let state = createEmptyState();
  for (let i = 0; i <= index && i < events.length; i++) {
    state = reduceEvent(state, events[i]);
  }
  return state;
}

// ─── Provider ───────────────────────────────────────────────────────────────

export function SessionStateProvider({
  children,
  initialState,
  allEvents,
  sessionId,
  intervalMinutes,
}: ProviderProps) {
  const [mode, setMode] = useState<Mode>("live");
  const [state, dispatch] = useReducer(stateReducer, ensureArrays(initialState));

  // ─── Live mode: WebSocket ─────────────────────────────────────────────────
  const fromLineRef = useRef(allEvents.length);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connectWs = useCallback(() => {
    if (mode !== "live") return;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname;
    const url = `${protocol}//${host}:3001?session_id=${sessionId}&from_line=${fromLineRef.current}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { events?: SessionEvent[]; total_lines?: number };
        if (data.events && data.events.length > 0) {
          fromLineRef.current = data.total_lines ?? fromLineRef.current;
          dispatch({ type: "PUSH_EVENTS", events: data.events });
        }
      } catch { /* ignore */ }
    };

    ws.onclose = () => {
      wsRef.current = null;
      reconnectTimeoutRef.current = setTimeout(connectWs, 2000);
    };

    ws.onerror = () => ws.close();
  }, [mode, sessionId]);

  useEffect(() => {
    if (mode === "live") {
      connectWs();
    } else {
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
      if (reconnectTimeoutRef.current) { clearTimeout(reconnectTimeoutRef.current); }
    }
    return () => {
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
      if (reconnectTimeoutRef.current) { clearTimeout(reconnectTimeoutRef.current); }
    };
  }, [mode, connectWs]);

  // ─── Replay mode ──────────────────────────────────────────────────────────
  const [replayIndex, setReplayIndex] = useState(allEvents.length - 1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const playTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const seek = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, allEvents.length - 1));
    setReplayIndex(clamped);
    const newState = computeStateAtIndex(allEvents, clamped);
    dispatch({ type: "SET_STATE", state: newState });
  }, [allEvents]);

  const step = useCallback(() => {
    setReplayIndex((prev) => {
      const next = Math.min(prev + 1, allEvents.length - 1);
      if (next !== prev) {
        const newState = computeStateAtIndex(allEvents, next);
        dispatch({ type: "SET_STATE", state: newState });
      }
      return next;
    });
  }, [allEvents]);

  const stepBack = useCallback(() => {
    setReplayIndex((prev) => {
      const next = Math.max(prev - 1, 0);
      if (next !== prev) {
        const newState = computeStateAtIndex(allEvents, next);
        dispatch({ type: "SET_STATE", state: newState });
      }
      return next;
    });
  }, [allEvents]);

  const play = useCallback(() => setIsPlaying(true), []);
  const pauseReplay = useCallback(() => setIsPlaying(false), []);

  useEffect(() => {
    if (isPlaying && mode === "replay") {
      const interval = Math.max(50, 500 / speed);
      playTimerRef.current = setInterval(step, interval);
      return () => { if (playTimerRef.current) clearInterval(playTimerRef.current); };
    } else {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    }
  }, [isPlaying, mode, speed, step]);

  // Stop playing when reaching end
  useEffect(() => {
    if (replayIndex >= allEvents.length - 1 && isPlaying) {
      setIsPlaying(false);
    }
  }, [replayIndex, allEvents.length, isPlaying]);

  // ─── Mode switching ───────────────────────────────────────────────────────
  const handleSetMode = useCallback((newMode: Mode) => {
    if (newMode === "replay") {
      setIsPlaying(false);
      setReplayIndex(allEvents.length - 1);
      // State already matches latest
    } else {
      // Back to live: restore to full state
      dispatch({ type: "SET_STATE", state: initialState });
      fromLineRef.current = allEvents.length;
    }
    setMode(newMode);
  }, [allEvents.length, initialState]);

  // ─── Next cycle countdown ─────────────────────────────────────────────────
  const [nextCycleAt, setNextCycleAt] = useState<number | null>(null);

  useEffect(() => {
    if (mode !== "live" || state.status !== "running") {
      setNextCycleAt(null);
      return;
    }

    // Fetch initial value
    fetch(`/api/scheduler/next?session_id=${sessionId}`)
      .then((r) => r.json())
      .then((data) => { if (data.next_cycle_at) setNextCycleAt(data.next_cycle_at); })
      .catch(() => {});

    // Poll every 10s
    const interval = setInterval(() => {
      fetch(`/api/scheduler/next?session_id=${sessionId}`)
        .then((r) => r.json())
        .then((data) => { if (data.next_cycle_at) setNextCycleAt(data.next_cycle_at); })
        .catch(() => {});
    }, 10000);

    return () => clearInterval(interval);
  }, [mode, state.status, sessionId]);

  // ─── Context value ────────────────────────────────────────────────────────
  const replay: ReplayControls = useMemo(() => ({
    isPlaying,
    speed,
    currentIndex: replayIndex,
    totalEvents: allEvents.length,
    play,
    pause: pauseReplay,
    step,
    stepBack,
    seek,
    setSpeed,
  }), [isPlaying, speed, replayIndex, allEvents.length, play, pauseReplay, step, stepBack, seek]);

  const value: SessionStateContextValue = useMemo(() => ({
    state,
    mode,
    replay,
    setMode: handleSetMode,
    nextCycleAt,
  }), [state, mode, replay, handleSetMode, nextCycleAt]);

  return (
    <SessionStateCtx.Provider value={value}>
      {children}
    </SessionStateCtx.Provider>
  );
}
