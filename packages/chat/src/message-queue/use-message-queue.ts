import { useState, useCallback, useEffect, useRef } from "react";
import type { MessageAttachment } from "../types";
import type {
  MessageQueueItem,
  UseMessageQueueOptions,
  UseMessageQueueReturn,
} from "./types";

const MAX_QUEUED_MESSAGES = 20;
const STORAGE_PREFIX = "viben-message-queue/";

interface MessageQueueState {
  items: MessageQueueItem[];
  isPaused: boolean;
}

function loadState(id: string): MessageQueueState {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + id);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return { items: [], isPaused: false };
}

function saveState(id: string, state: MessageQueueState) {
  try {
    if (state.items.length === 0 && !state.isPaused) {
      sessionStorage.removeItem(STORAGE_PREFIX + id);
    } else {
      // Don't persist attachments with base64 data to avoid storage limits
      const serializable = {
        ...state,
        items: state.items.map((it) => ({
          ...it,
          attachments: it.attachments?.map((a) => ({ ...a, data: undefined })),
        })),
      };
      sessionStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(serializable));
    }
  } catch {
    // ignore quota exceeded
  }
}

export function useMessageQueue(options: UseMessageQueueOptions): UseMessageQueueReturn {
  const {
    id,
    enabled = true,
    isBusy,
    onSend,
    onQueued,
    onError,
  } = options;

  const [state, setState] = useState<MessageQueueState>(() => loadState(id));
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

    onSend(first.content, first.attachments).catch((err) => {
      // Restore item and pause on failure
      setState((prev) => ({
        items: [first, ...prev.items],
        isPaused: true,
      }));
      onError?.(err instanceof Error ? err : new Error(String(err)), first);
    });
  }, [enabled, isBusy, state.isPaused, state.items.length, onSend, onError]);

  const enqueue = useCallback(
    (content: string, attachments?: MessageAttachment[]) => {
      if (!enabled) return;

      // Idle + no queue → send immediately
      if (!isBusy && state.items.length === 0) {
        waitingForTurnRef.current = true;
        onSend(content, attachments).catch(() => {
          waitingForTurnRef.current = false;
        });
        return;
      }

      // Otherwise → enqueue
      if (state.items.length >= MAX_QUEUED_MESSAGES) return;

      const item: MessageQueueItem = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        content,
        attachments,
        createdAt: Date.now(),
      };

      setState((prev) => ({
        ...prev,
        items: [...prev.items, item],
      }));
      onQueued?.(item);
    },
    [enabled, isBusy, state.items.length, onSend, onQueued]
  );

  const update = useCallback((itemId: string, content: string) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((it) =>
        it.id === itemId ? { ...it, content } : it
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
    hasPendingMessages: state.items.length > 0,
    enqueue,
    update,
    remove,
    clear,
    reorder,
    pause,
    resume,
  };
}
