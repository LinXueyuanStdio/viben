/**
 * Task SSE Manager
 *
 * Manages Server-Sent Events connections for task state changes.
 * Each task can have multiple SSE subscribers.
 */

import { EventEmitter } from "node:events";

// =============================================================================
// Types
// =============================================================================

/**
 * Task SSE event types
 */
export type TaskSSEEventType =
  | "STATE_CHANGED"
  | "TASK_RECOVERED"
  | "TASK_UPDATED"
  | "TASK_DELETED"
  | "CONNECTED"
  | "HEARTBEAT";

/**
 * Task SSE event data
 */
export interface TaskSSEEvent {
  type: TaskSSEEventType;
  task_id: string;
  timestamp: number;
  // Additional fields based on type
  event?: unknown;
  new_state?: string;
  reason?: string;
  [key: string]: unknown;
}

/**
 * SSE event listener callback
 */
export type TaskSSEListener = (event: TaskSSEEvent) => void | Promise<void>;

/**
 * Connection info for a subscriber
 */
interface SubscriberInfo {
  id: string;
  taskId: string;
  listener: TaskSSEListener;
  connectedAt: number;
}

// =============================================================================
// Task SSE Manager
// =============================================================================

/**
 * Manager for task-specific SSE connections
 *
 * Features:
 * - Per-task subscriptions
 * - Broadcast to all subscribers of a task
 * - Global broadcast to all subscribers
 * - Heartbeat support
 */
export class TaskSSEManager {
  private emitter: EventEmitter;
  private subscribers: Map<string, SubscriberInfo>;
  private taskSubscribers: Map<string, Set<string>>; // taskId -> subscriberIds

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(1000);
    this.subscribers = new Map();
    this.taskSubscribers = new Map();
  }

  /**
   * Subscribe to events for a specific task
   *
   * @param taskId - Task ID to subscribe to
   * @param listener - Callback for events
   * @returns Unsubscribe function
   */
  subscribe(taskId: string, listener: TaskSSEListener): () => void {
    const subscriberId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Store subscriber info
    const info: SubscriberInfo = {
      id: subscriberId,
      taskId,
      listener,
      connectedAt: Date.now(),
    };
    this.subscribers.set(subscriberId, info);

    // Add to task subscribers map
    if (!this.taskSubscribers.has(taskId)) {
      this.taskSubscribers.set(taskId, new Set());
    }
    this.taskSubscribers.get(taskId)!.add(subscriberId);

    // Set up event listener
    const eventName = `task:${taskId}`;
    this.emitter.on(eventName, listener);

    // Send connected event
    this.sendToSubscriber(subscriberId, {
      type: "CONNECTED",
      task_id: taskId,
      timestamp: Date.now(),
    });

    // Return unsubscribe function
    return () => {
      this.emitter.off(eventName, listener);
      this.subscribers.delete(subscriberId);
      this.taskSubscribers.get(taskId)?.delete(subscriberId);

      // Clean up empty task subscriber sets
      if (this.taskSubscribers.get(taskId)?.size === 0) {
        this.taskSubscribers.delete(taskId);
      }
    };
  }

  /**
   * Subscribe to all task events (global listener)
   *
   * @param listener - Callback for all events
   * @returns Unsubscribe function
   */
  subscribeAll(listener: TaskSSEListener): () => void {
    const subscriberId = `sub_all_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Store with special "all" taskId
    const info: SubscriberInfo = {
      id: subscriberId,
      taskId: "*",
      listener,
      connectedAt: Date.now(),
    };
    this.subscribers.set(subscriberId, info);

    // Add to global subscribers
    if (!this.taskSubscribers.has("*")) {
      this.taskSubscribers.set("*", new Set());
    }
    this.taskSubscribers.get("*")!.add(subscriberId);

    // Listen to all events
    this.emitter.on("task:*", listener);

    return () => {
      this.emitter.off("task:*", listener);
      this.subscribers.delete(subscriberId);
      this.taskSubscribers.get("*")?.delete(subscriberId);
    };
  }

  /**
   * Broadcast an event to all subscribers of a task
   *
   * @param taskId - Task ID to broadcast to
   * @param event - Event data (task_id and timestamp are auto-filled)
   */
  broadcast(
    taskId: string,
    event: { type: TaskSSEEventType; timestamp?: number; [key: string]: unknown }
  ): void {
    const fullEvent: TaskSSEEvent = {
      ...event,
      type: event.type,
      task_id: taskId,
      timestamp: event.timestamp ?? Date.now(),
    };

    // Emit to task-specific listeners
    this.emitter.emit(`task:${taskId}`, fullEvent);

    // Emit to global listeners
    this.emitter.emit("task:*", fullEvent);
  }

  /**
   * Broadcast an event to all subscribers
   *
   * @param event - Event data (must include task_id)
   */
  broadcastAll(event: TaskSSEEvent): void {
    // Emit to specific task listeners
    this.emitter.emit(`task:${event.task_id}`, event);

    // Emit to global listeners
    this.emitter.emit("task:*", event);
  }

  /**
   * Send a heartbeat to all subscribers
   */
  sendHeartbeat(): void {
    const timestamp = Date.now();

    // Send to all task subscribers
    for (const taskId of this.taskSubscribers.keys()) {
      if (taskId !== "*") {
        this.broadcast(taskId, { type: "HEARTBEAT", timestamp });
      }
    }

    // Send to global subscribers
    for (const subscriberId of this.taskSubscribers.get("*") ?? []) {
      const info = this.subscribers.get(subscriberId);
      if (info) {
        info.listener({ type: "HEARTBEAT", task_id: "*", timestamp });
      }
    }
  }

  /**
   * Start periodic heartbeat
   *
   * @param intervalMs - Heartbeat interval (default: 30 seconds)
   * @returns Stop function
   */
  startHeartbeat(intervalMs: number = 30000): () => void {
    const intervalId = setInterval(() => {
      this.sendHeartbeat();
    }, intervalMs);

    return () => clearInterval(intervalId);
  }

  /**
   * Get count of subscribers for a task
   *
   * @param taskId - Task ID (or "*" for global)
   * @returns Subscriber count
   */
  getSubscriberCount(taskId: string): number {
    return this.taskSubscribers.get(taskId)?.size ?? 0;
  }

  /**
   * Get total subscriber count
   */
  getTotalSubscriberCount(): number {
    return this.subscribers.size;
  }

  /**
   * Get list of tasks with active subscribers
   */
  getActiveTaskIds(): string[] {
    return Array.from(this.taskSubscribers.keys()).filter((id) => id !== "*");
  }

  /**
   * Send event to a specific subscriber
   */
  private sendToSubscriber(subscriberId: string, event: TaskSSEEvent): void {
    const info = this.subscribers.get(subscriberId);
    if (info) {
      try {
        info.listener(event);
      } catch (error) {
        console.error(`[TaskSSEManager] Error sending to subscriber ${subscriberId}:`, error);
      }
    }
  }

  /**
   * Close all connections (cleanup)
   */
  close(): void {
    this.emitter.removeAllListeners();
    this.subscribers.clear();
    this.taskSubscribers.clear();
  }
}

/**
 * Singleton SSE manager instance
 */
export const taskSSEManager = new TaskSSEManager();
