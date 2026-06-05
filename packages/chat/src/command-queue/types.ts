import type { MessageAttachment } from "../types";

/** A single item in the command queue */
export interface CommandQueueItem {
  id: string;
  /** Text content of the queued message */
  content: string;
  /** Optional attachments (images, files) for multimodal messages */
  attachments?: MessageAttachment[];
  createdAt: number;
}

/** Options for the useCommandQueue hook */
export interface UseCommandQueueOptions {
  /** Unique key for sessionStorage persistence */
  id: string;
  /** Whether the queue is enabled (default: true) */
  enabled?: boolean;
  /** Whether the agent is currently processing */
  isBusy: boolean;
  /** Whether the executor supports mid-stream steering */
  supportsSteer: boolean;
  /** Send a message to the agent */
  onSend: (content: string, attachments?: MessageAttachment[]) => Promise<void>;
  /** Steer the agent mid-stream */
  onSteer: (content: string) => Promise<void>;
  /** Called when a message is queued (for toast/notification) */
  onQueued?: (item: CommandQueueItem) => void;
  /** Called when auto-execution fails */
  onError?: (error: Error, item: CommandQueueItem) => void;
}

/** Return value of useCommandQueue */
export interface UseCommandQueueReturn {
  /** Current queue items */
  items: CommandQueueItem[];
  /** Whether auto-execution is paused */
  isPaused: boolean;
  /** Whether there are pending commands */
  hasPendingCommands: boolean;
  /** Route a message: immediate send, steer, or queue */
  send: (content: string, attachments?: MessageAttachment[]) => void;
  /** Add a message directly to the queue */
  enqueue: (content: string, attachments?: MessageAttachment[]) => CommandQueueItem | null;
  /** Update an existing queue item's content text */
  update: (id: string, content: string) => void;
  /** Remove an item from the queue */
  remove: (id: string) => void;
  /** Clear all queue items */
  clear: () => void;
  /** Return queued content in order and clear the queue for editing */
  recall: () => CommandQueueItem[];
  /** Reorder items (drag-and-drop) */
  reorder: (activeId: string, overId: string) => void;
  /** Pause auto-execution */
  pause: () => void;
  /** Resume auto-execution */
  resume: () => void;
}
