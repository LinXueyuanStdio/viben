/**
 * Conversation Command Queue
 *
 * Integrates with the steering mechanism:
 * - Agent idle → send immediately as a new turn
 * - Agent running + steer-capable (SDK proxy) → send as steer (inject mid-stream)
 * - Agent running + NOT steer-capable (OpenClaw) → queue, auto-execute when idle
 *
 * Also queues when there are already pending items (maintains ordering).
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";

// ============================================================================
// Types
// ============================================================================

export interface CommandQueueItem {
  id: string;
  input: string;
  files: string[];
  createdAt: number;
}

interface CommandQueueState {
  items: CommandQueueItem[];
  isPaused: boolean;
}

export interface UseCommandQueueOptions {
  /** Unique conversation identifier for persistence */
  conversationId: string;
  /** Whether the queue feature is enabled */
  enabled?: boolean;
  /** Whether the agent is currently processing a turn */
  isBusy: boolean;
  /** Whether the current executor supports mid-stream steering */
  supportsSteer: boolean;
  /** Send a message as a new turn (when idle) */
  onSend: (input: string, files?: string[]) => Promise<void>;
  /** Inject a steer message mid-stream (when busy + steer-capable) */
  onSteer: (input: string) => Promise<void>;
}

export interface UseCommandQueueReturn {
  /** Queued items (not yet executed) */
  items: CommandQueueItem[];
  /** Whether auto-execution is paused */
  isPaused: boolean;
  /** Whether there are pending commands */
  hasPendingCommands: boolean;
  /**
   * Unified send entry point. Decides whether to:
   * - Send immediately (idle, no queue)
   * - Steer immediately (busy, steer-capable, no queue)
   * - Queue (busy + not steer-capable, or existing queue items)
   */
  send: (input: string, files?: string[]) => void;
  /** Update a queued item's text */
  update: (id: string, input: string) => void;
  /** Remove a queued item */
  remove: (id: string) => void;
  /** Clear entire queue */
  clear: () => void;
  /** Reorder items (drag-and-drop) */
  reorder: (activeId: string, overId: string) => void;
  /** Pause auto-execution */
  pause: () => void;
  /** Resume auto-execution */
  resume: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const MAX_QUEUED_COMMANDS = 20;
const MAX_INPUT_LENGTH = 20_000;
const STORAGE_PREFIX = "conversation-command-queue/";

// ============================================================================
// Persistence Helpers
// ============================================================================

function getStorageKey(conversationId: string): string {
  return `${STORAGE_PREFIX}${conversationId}`;
}

function readPersistedState(conversationId: string): CommandQueueState {
  try {
    const raw = sessionStorage.getItem(getStorageKey(conversationId));
    if (raw) {
      const parsed = JSON.parse(raw) as CommandQueueState;
      if (Array.isArray(parsed.items)) return parsed;
    }
  } catch {
    // Ignore parse errors
  }
  return { items: [], isPaused: false };
}

function persistState(conversationId: string, state: CommandQueueState): void {
  try {
    if (state.items.length === 0 && !state.isPaused) {
      sessionStorage.removeItem(getStorageKey(conversationId));
    } else {
      sessionStorage.setItem(getStorageKey(conversationId), JSON.stringify(state));
    }
  } catch {
    // Ignore quota errors
  }
}

// ============================================================================
// Hook
// ============================================================================

export function useCommandQueue({
  conversationId,
  enabled = true,
  isBusy,
  supportsSteer,
  onSend,
  onSteer,
}: UseCommandQueueOptions): UseCommandQueueReturn {
  const [state, setState] = useState<CommandQueueState>(() =>
    enabled ? readPersistedState(conversationId) : { items: [], isPaused: false }
  );

  // Refs to avoid stale closures in effects
  const isBusyRef = useRef(isBusy);
  const isPausedRef = useRef(state.isPaused);
  const waitingForTurnRef = useRef(false);
  const onSendRef = useRef(onSend);
  const onSteerRef = useRef(onSteer);

  isBusyRef.current = isBusy;
  isPausedRef.current = state.isPaused;
  onSendRef.current = onSend;
  onSteerRef.current = onSteer;

  // Persist on state change
  useEffect(() => {
    if (enabled) {
      persistState(conversationId, state);
    }
  }, [conversationId, enabled, state]);

  // Clear state when disabled
  useEffect(() => {
    if (!enabled) {
      setState({ items: [], isPaused: false });
      sessionStorage.removeItem(getStorageKey(conversationId));
    }
  }, [enabled, conversationId]);

  // Reset turn gate when agent becomes idle
  useEffect(() => {
    if (!isBusy) {
      waitingForTurnRef.current = false;
    }
  }, [isBusy]);

  // Auto-execute next queued command when agent becomes idle
  useEffect(() => {
    if (!enabled || state.isPaused || isBusy || waitingForTurnRef.current || state.items.length === 0) {
      return;
    }

    const [nextItem, ...remaining] = state.items;
    waitingForTurnRef.current = true;

    // Dequeue optimistically
    setState({ items: remaining, isPaused: false });

    onSendRef.current(nextItem.input, nextItem.files).catch(() => {
      // On failure: restore item to front and pause
      waitingForTurnRef.current = false;
      setState((prev) => ({
        items: [nextItem, ...prev.items],
        isPaused: true,
      }));
    });
  }, [enabled, isBusy, state.isPaused, state.items]);

  // ---- Unified send ----

  const send = useCallback((input: string, files: string[] = []) => {
    if (!input.trim()) return;

    const hasQueue = state.items.length > 0 || waitingForTurnRef.current;

    // Case 1: Agent idle + no queue → send immediately
    if (!isBusyRef.current && !hasQueue) {
      waitingForTurnRef.current = true;
      onSendRef.current(input, files).catch(() => {
        waitingForTurnRef.current = false;
      });
      return;
    }

    // Case 2: Agent busy + steer-capable + no queue → steer immediately
    if (isBusyRef.current && supportsSteer && !hasQueue) {
      onSteerRef.current(input).catch(() => {
        // Steer failed — silently ignore (server returns error message)
      });
      return;
    }

    // Case 3: Queue the message (agent busy without steer, or queue already has items)
    if (input.length > MAX_INPUT_LENGTH) return;
    setState((prev) => {
      if (prev.items.length >= MAX_QUEUED_COMMANDS) return prev;
      const newItems = [...prev.items, {
        id: crypto.randomUUID(),
        input: input.trim(),
        files,
        createdAt: Date.now(),
      }];
      // Notify user that message was queued
      toast.info("Message queued", { description: `${newItems.length} in queue`, duration: 2000 });
      return { ...prev, items: newItems };
    });
  }, [supportsSteer, state.items.length]);

  // ---- Queue operations ----

  const update = useCallback((id: string, input: string) => {
    if (input.length > MAX_INPUT_LENGTH) return;
    setState((prev) => ({
      ...prev,
      isPaused: false,
      items: prev.items.map((item) =>
        item.id === id ? { ...item, input: input.trim() } : item
      ),
    }));
  }, []);

  const remove = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      isPaused: prev.items.length <= 1 ? false : prev.isPaused,
      items: prev.items.filter((item) => item.id !== id),
    }));
  }, []);

  const clear = useCallback(() => {
    waitingForTurnRef.current = false;
    setState({ items: [], isPaused: false });
  }, []);

  const reorder = useCallback((activeId: string, overId: string) => {
    setState((prev) => {
      const activeIndex = prev.items.findIndex((i) => i.id === activeId);
      const overIndex = prev.items.findIndex((i) => i.id === overId);
      if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) return prev;

      const newItems = [...prev.items];
      const [moved] = newItems.splice(activeIndex, 1);
      newItems.splice(overIndex, 0, moved);
      return { ...prev, items: newItems };
    });
  }, []);

  const pause = useCallback(() => {
    waitingForTurnRef.current = false;
    setState((prev) => ({ ...prev, isPaused: true }));
  }, []);

  const resume = useCallback(() => {
    setState((prev) => ({ ...prev, isPaused: false }));
  }, []);

  return {
    items: state.items,
    isPaused: state.isPaused,
    hasPendingCommands: state.items.length > 0,
    send,
    update,
    remove,
    clear,
    reorder,
    pause,
    resume,
  };
}
