import type { MessageAttachment } from "../types";

/** A single item in the message queue */
export interface MessageQueueItem {
  id: string;
  content: string;
  attachments?: MessageAttachment[];
  createdAt: number;
}

/** Options for the useMessageQueue hook */
export interface UseMessageQueueOptions {
  /** Unique key for sessionStorage persistence */
  id: string;
  /** Whether the queue is enabled (default: true) */
  enabled?: boolean;
  /** Whether the agent is currently processing */
  isBusy: boolean;
  /** Send a message with optional attachments */
  onSend: (content: string, attachments?: MessageAttachment[]) => Promise<void>;
  /** Called when a message is queued (for toast/notification) */
  onQueued?: (item: MessageQueueItem) => void;
  /** Called when auto-execution fails */
  onError?: (error: Error, item: MessageQueueItem) => void;
}

/** Return value of useMessageQueue */
export interface UseMessageQueueReturn {
  /** Current queue items */
  items: MessageQueueItem[];
  /** Whether auto-execution is paused */
  isPaused: boolean;
  /** Whether there are pending messages */
  hasPendingMessages: boolean;
  /** Add a message to the queue (or send immediately if idle) */
  enqueue: (content: string, attachments?: MessageAttachment[]) => void;
  /** Update an existing queue item's content */
  update: (id: string, content: string) => void;
  /** Remove an item from the queue */
  remove: (id: string) => void;
  /** Clear all queue items */
  clear: () => void;
  /** Reorder items (drag-and-drop) */
  reorder: (activeId: string, overId: string) => void;
  /** Pause auto-execution */
  pause: () => void;
  /** Resume auto-execution */
  resume: () => void;
}
