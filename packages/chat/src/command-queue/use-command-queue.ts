import { useState, useCallback, useEffect, useRef } from "react";
import type { MessageAttachment } from "../types";
import type {
  CommandQueueItem,
  UseCommandQueueOptions,
  UseCommandQueueReturn,
} from "./types";

const MAX_QUEUED_COMMANDS = 20;
const MAX_INPUT_LENGTH = 20_000;
const STORAGE_PREFIX = "viben-command-queue/";

interface CommandQueueState {
  items: CommandQueueItem[];
  isPaused: boolean;
}

function loadState(id: string): CommandQueueState {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + id);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return { items: [], isPaused: false };
}

function saveState(id: string, state: CommandQueueState) {
  try {
    if (state.items.length === 0 && !state.isPaused) {
      sessionStorage.removeItem(STORAGE_PREFIX + id);
    } else {
      sessionStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(state));
    }
  } catch {
    // ignore
  }
}

export function useCommandQueue(options: UseCommandQueueOptions): UseCommandQueueReturn {
  const {
    id,
    enabled = true,
    isBusy,
    supportsSteer,
    onSend,
    onSteer,
    onQueued,
    onError,
  } = options;

  const [state, setState] = useState<CommandQueueState>(() => loadState(id));
  const waitingForTurnRef = useRef(false);

  // Persist state changes
  useEffect(() => {
    saveState(id, state);
  }, [id, state]);

  // Auto-execute: when agent goes idle and queue has items
  useEffect(() => {
    if (!enabled) return;
    if (isBusy) {
      waitingForTurnRef.current = false;
      return;
    }
    if (state.isPaused || state.items.length === 0) return;
    if (waitingForTurnRef.current) return;

    // Dequeue first item
    const [first, ...rest] = state.items;
    waitingForTurnRef.current = true;

    setState({ ...state, items: rest });

    onSend(first.content, first.attachments).catch(
      (err) => {
        // Restore item and pause on failure
        setState((prev) => ({
          items: [first, ...prev.items],
          isPaused: true,
        }));
        onError?.(err instanceof Error ? err : new Error(String(err)), first);
      }
    );
  }, [enabled, isBusy, state.isPaused, state.items.length, onSend, onError]);

  const send = useCallback(
    (content: string, attachments?: MessageAttachment[]) => {
      if (!enabled) return;
      const trimmed = content.slice(0, MAX_INPUT_LENGTH);

      // Idle + no queue → send immediately
      if (!isBusy && state.items.length === 0) {
        waitingForTurnRef.current = true;
        onSend(trimmed, attachments).catch(() => {
          waitingForTurnRef.current = false;
        });
        return;
      }

      // Busy + supports steer + no queue → steer immediately
      if (isBusy && supportsSteer && state.items.length === 0) {
        onSteer(trimmed).catch(() => {
          // Silently fail steer
        });
        return;
      }

      // Otherwise → enqueue
      if (state.items.length >= MAX_QUEUED_COMMANDS) return;

      const item: CommandQueueItem = {
        id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        content: trimmed,
        attachments: attachments && attachments.length > 0 ? attachments : undefined,
        createdAt: Date.now(),
      };

      setState((prev) => ({
        ...prev,
        items: [...prev.items, item],
      }));
      onQueued?.(item);
    },
    [enabled, isBusy, supportsSteer, state.items.length, onSend, onSteer, onQueued]
  );

  const update = useCallback((itemId: string, content: string) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((it) =>
        it.id === itemId ? { ...it, content: content.slice(0, MAX_INPUT_LENGTH) } : it
      ),
    }));
  }, []);

  const remove = useCallback((itemId: string) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.filter((it) => it.id !== itemId),
    }));
  }, []);

  const clear = useCallback(() => {
    setState((prev) => ({ ...prev, items: [] }));
  }, []);

  const reorder = useCallback((activeId: string, overId: string) => {
    setState((prev) => {
      const items = [...prev.items];
      const activeIdx = items.findIndex((it) => it.id === activeId);
      const overIdx = items.findIndex((it) => it.id === overId);
      if (activeIdx === -1 || overIdx === -1) return prev;
      const [moved] = items.splice(activeIdx, 1);
      items.splice(overIdx, 0, moved);
      return { ...prev, items };
    });
  }, []);

  const pause = useCallback(() => {
    setState((prev) => ({ ...prev, isPaused: true }));
  }, []);

  const resume = useCallback(() => {
    setState((prev) => ({ ...prev, isPaused: false }));
    waitingForTurnRef.current = false;
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
