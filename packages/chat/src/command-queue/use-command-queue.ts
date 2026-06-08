import { useState, useCallback, useEffect } from "react";
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
}

function loadState(id: string): CommandQueueState {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + id);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return { items: [] };
}

function saveState(id: string, state: CommandQueueState) {
  try {
    if (state.items.length === 0) {
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

  // Persist state changes
  useEffect(() => {
    saveState(id, state);
  }, [id, state]);

  // Auto-execute: when agent goes idle and queue has items.
  // Dequeues one item per effect run. The setState(items: rest) changes
  // items.length which re-triggers this effect for the next item — cascading
  // until the queue is empty. No ref-based guard needed.
  useEffect(() => {
    if (!enabled) return;
    if (isBusy) return;
    if (state.items.length === 0) return;

    // Dequeue first item
    const [first, ...rest] = state.items;

    setState((prev) => ({ ...prev, items: rest }));

    onSend(first.content, first.attachments).catch((err) => {
      // Restore item on failure
      setState((prev) => ({
        items: [first, ...prev.items],
      }));
      onError?.(err instanceof Error ? err : new Error(String(err)), first);
    });
  }, [enabled, isBusy, state.items.length, onSend, onError]);

  const enqueue = useCallback(
    (content: string, attachments?: MessageAttachment[]): CommandQueueItem | null => {
      const trimmed = content.slice(0, MAX_INPUT_LENGTH);
      let queuedItem: CommandQueueItem | null = null;

      setState((prev) => {
        if (!enabled || prev.items.length >= MAX_QUEUED_COMMANDS) return prev;
        queuedItem = {
          id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          content: trimmed,
          attachments: attachments && attachments.length > 0 ? attachments : undefined,
          createdAt: Date.now(),
        };
        return {
          ...prev,
          items: [...prev.items, queuedItem],
        };
      });

      if (queuedItem) onQueued?.(queuedItem);
      return queuedItem;
    },
    [enabled, onQueued]
  );

  const send = useCallback(
    (content: string, attachments?: MessageAttachment[]) => {
      if (!enabled) return;
      const trimmed = content.slice(0, MAX_INPUT_LENGTH);

      // Idle + no queue → send immediately
      if (!isBusy && state.items.length === 0) {
        onSend(trimmed, attachments).catch(() => {
          // Silently fail direct send
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

      enqueue(trimmed, attachments);
    },
    [enabled, isBusy, supportsSteer, state.items.length, onSend, onSteer, enqueue]
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

  const recall = useCallback((): CommandQueueItem[] => {
    const recalled = state.items;
    setState((prev) => ({ ...prev, items: [] }));
    return recalled;
  }, [state.items]);

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

  return {
    items: state.items,
    hasPendingCommands: state.items.length > 0,
    send,
    enqueue,
    update,
    remove,
    clear,
    recall,
    reorder,
  };
}
