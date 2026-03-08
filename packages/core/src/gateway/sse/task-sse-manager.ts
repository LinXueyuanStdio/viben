/**
 * Task SSE Manager
 *
 * Manages Server-Sent Events connections for task state changes.
 * Each task can have multiple SSE subscribers.
 *
 * IMPORTANT: Includes automatic cleanup of stale subscribers to prevent
 * memory leaks when network disconnects don't trigger close events.
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
  /** Workspace path - supports multi-workspace scenarios */
  workspace_path?: string;
  timestamp: number;
  // Additional fields based on type
  event?: unknown;
  new_state?: string;
  reason?: string;
  [key: string]: unknown;
}

/**
 * SSE event listener callback
 * Returns true if the event was successfully delivered, false otherwise.
 * This is used for dead connection detection.
 */
export type TaskSSEListener = (event: TaskSSEEvent) => void | boolean | Promise<void | boolean>;

/**
 * Connection info for a subscriber
 */
interface SubscriberInfo {
  id: string;
  taskId: string;
  /** Workspace path for workspace-level subscriptions */
  workspacePath?: string;
  /** Task IDs for batch subscriptions */
  taskIds?: string[];
  /** Subscription type */
  subscriptionType: "task" | "workspace" | "batch" | "global";
  listener: TaskSSEListener;
  connectedAt: number;
  /** Last successful activity timestamp (event sent or heartbeat ack) */
  lastActivity: number;
  /** Number of consecutive failed sends */
  failedSends: number;
}

// =============================================================================
// Task SSE Manager
// =============================================================================

/**
 * Configuration for TaskSSEManager
 */
export interface TaskSSEManagerConfig {
  /** Max listeners for EventEmitter (default: 1000) */
  maxListeners?: number;
  /** Heartbeat interval in ms (default: 30000) */
  heartbeatIntervalMs?: number;
  /** Stale subscriber timeout in ms - subscribers inactive longer are cleaned up (default: 120000 = 2 min) */
  staleTimeoutMs?: number;
  /** Max consecutive failed sends before marking subscriber as dead (default: 3) */
  maxFailedSends?: number;
  /** Cleanup interval in ms (default: 60000 = 1 min) */
  cleanupIntervalMs?: number;
}

const DEFAULT_CONFIG: Required<TaskSSEManagerConfig> = {
  maxListeners: 1000,
  heartbeatIntervalMs: 30000,
  staleTimeoutMs: 120000,
  maxFailedSends: 3,
  cleanupIntervalMs: 60000,
};

/**
 * Manager for task-specific SSE connections
 *
 * Features:
 * - Per-task subscriptions
 * - Workspace-level subscriptions (all tasks in a workspace)
 * - Batch subscriptions (multiple specific tasks)
 * - Broadcast to all subscribers of a task
 * - Global broadcast to all subscribers
 * - Heartbeat support with dead connection detection
 * - Automatic cleanup of stale/dead subscribers
 */
export class TaskSSEManager {
  private emitter: EventEmitter;
  private subscribers: Map<string, SubscriberInfo>;
  private taskSubscribers: Map<string, Set<string>>; // taskId -> subscriberIds
  /** Workspace-level subscribers: workspacePath -> subscriberIds */
  private workspaceSubscribers: Map<string, Set<string>>;
  private config: Required<TaskSSEManagerConfig>;
  private heartbeatIntervalId: NodeJS.Timeout | null = null;
  private cleanupIntervalId: NodeJS.Timeout | null = null;

  constructor(config?: TaskSSEManagerConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(this.config.maxListeners);
    this.subscribers = new Map();
    this.taskSubscribers = new Map();
    this.workspaceSubscribers = new Map();
  }

  /**
   * Subscribe to events for a specific task
   *
   * @param taskId - Task ID to subscribe to
   * @param listener - Callback for events
   * @param workspacePath - Optional workspace path for context
   * @returns Unsubscribe function
   */
  subscribe(taskId: string, listener: TaskSSEListener, workspacePath?: string): () => void {
    const subscriberId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();

    // Store subscriber info
    const info: SubscriberInfo = {
      id: subscriberId,
      taskId,
      workspacePath,
      subscriptionType: "task",
      listener,
      connectedAt: now,
      lastActivity: now,
      failedSends: 0,
    };
    this.subscribers.set(subscriberId, info);

    // Add to task subscribers map
    if (!this.taskSubscribers.has(taskId)) {
      this.taskSubscribers.set(taskId, new Set());
    }
    const taskSubs = this.taskSubscribers.get(taskId);
    if (taskSubs) {
      taskSubs.add(subscriberId);
    }

    // Set up event listener
    const eventName = `task:${taskId}`;
    this.emitter.on(eventName, listener);

    // Send connected event
    this.sendToSubscriber(subscriberId, {
      type: "CONNECTED",
      task_id: taskId,
      workspace_path: workspacePath,
      timestamp: now,
    });

    // Return unsubscribe function
    return () => {
      this.unsubscribeById(subscriberId);
    };
  }

  /**
   * Internal method to unsubscribe by ID
   * Used by both explicit unsubscribe and automatic cleanup
   */
  private unsubscribeById(subscriberId: string): void {
    const info = this.subscribers.get(subscriberId);
    if (!info) return;

    // Remove event listeners based on subscription type
    if (info.subscriptionType === "workspace" && info.workspacePath) {
      const eventName = `workspace:${info.workspacePath}`;
      this.emitter.off(eventName, info.listener);
      this.workspaceSubscribers.get(info.workspacePath)?.delete(subscriberId);
      if (this.workspaceSubscribers.get(info.workspacePath)?.size === 0) {
        this.workspaceSubscribers.delete(info.workspacePath);
      }
    } else if (info.subscriptionType === "batch" && info.taskIds) {
      // Remove from each task's subscriber set
      for (const taskId of info.taskIds) {
        const eventName = `task:${taskId}`;
        this.emitter.off(eventName, info.listener);
        this.taskSubscribers.get(taskId)?.delete(subscriberId);
        if (this.taskSubscribers.get(taskId)?.size === 0) {
          this.taskSubscribers.delete(taskId);
        }
      }
    } else if (info.subscriptionType === "global") {
      this.emitter.off("task:*", info.listener);
      this.taskSubscribers.get("*")?.delete(subscriberId);
      if (this.taskSubscribers.get("*")?.size === 0) {
        this.taskSubscribers.delete("*");
      }
    } else {
      // Single task subscription
      const eventName = info.taskId === "*" ? "task:*" : `task:${info.taskId}`;
      this.emitter.off(eventName, info.listener);
      this.taskSubscribers.get(info.taskId)?.delete(subscriberId);
      if (this.taskSubscribers.get(info.taskId)?.size === 0) {
        this.taskSubscribers.delete(info.taskId);
      }
    }

    this.subscribers.delete(subscriberId);
  }

  /**
   * Subscribe to all task events (global listener)
   *
   * @param listener - Callback for all events
   * @returns Unsubscribe function
   */
  subscribeAll(listener: TaskSSEListener): () => void {
    const subscriberId = `sub_all_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();

    // Store with special "all" taskId
    const info: SubscriberInfo = {
      id: subscriberId,
      taskId: "*",
      subscriptionType: "global",
      listener,
      connectedAt: now,
      lastActivity: now,
      failedSends: 0,
    };
    this.subscribers.set(subscriberId, info);

    // Add to global subscribers
    if (!this.taskSubscribers.has("*")) {
      this.taskSubscribers.set("*", new Set());
    }
    const globalSubs = this.taskSubscribers.get("*");
    if (globalSubs) {
      globalSubs.add(subscriberId);
    }

    // Listen to all events
    this.emitter.on("task:*", listener);

    return () => {
      this.unsubscribeById(subscriberId);
    };
  }

  /**
   * Subscribe to all task events in a workspace
   *
   * @param workspacePath - Workspace path to subscribe to
   * @param listener - Callback for events
   * @returns Unsubscribe function
   */
  subscribeWorkspace(workspacePath: string, listener: TaskSSEListener): () => void {
    const subscriberId = `sub_ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();

    // Store subscriber info
    const info: SubscriberInfo = {
      id: subscriberId,
      taskId: "", // Not used for workspace subscriptions
      workspacePath,
      subscriptionType: "workspace",
      listener,
      connectedAt: now,
      lastActivity: now,
      failedSends: 0,
    };
    this.subscribers.set(subscriberId, info);

    // Add to workspace subscribers map
    if (!this.workspaceSubscribers.has(workspacePath)) {
      this.workspaceSubscribers.set(workspacePath, new Set());
    }
    const wsSubs = this.workspaceSubscribers.get(workspacePath);
    if (wsSubs) {
      wsSubs.add(subscriberId);
    }

    // Set up event listener for workspace events
    const eventName = `workspace:${workspacePath}`;
    this.emitter.on(eventName, listener);

    // Send connected event
    this.sendToSubscriber(subscriberId, {
      type: "CONNECTED",
      task_id: "",
      workspace_path: workspacePath,
      timestamp: now,
    });

    return () => {
      this.unsubscribeById(subscriberId);
    };
  }

  /**
   * Subscribe to multiple specific tasks (batch subscription)
   *
   * @param taskIds - Array of task IDs to subscribe to
   * @param listener - Callback for events
   * @param workspacePath - Optional workspace path for context
   * @returns Unsubscribe function
   */
  subscribeTasks(taskIds: string[], listener: TaskSSEListener, workspacePath?: string): () => void {
    const subscriberId = `sub_batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();

    // Store subscriber info
    const info: SubscriberInfo = {
      id: subscriberId,
      taskId: taskIds[0] || "", // Primary task for heartbeat
      taskIds,
      workspacePath,
      subscriptionType: "batch",
      listener,
      connectedAt: now,
      lastActivity: now,
      failedSends: 0,
    };
    this.subscribers.set(subscriberId, info);

    // Add to task subscribers map for each task
    for (const taskId of taskIds) {
      if (!this.taskSubscribers.has(taskId)) {
        this.taskSubscribers.set(taskId, new Set());
      }
      const taskSubs = this.taskSubscribers.get(taskId);
      if (taskSubs) {
        taskSubs.add(subscriberId);
      }

      // Set up event listener for each task
      const eventName = `task:${taskId}`;
      this.emitter.on(eventName, listener);
    }

    // Send connected event
    this.sendToSubscriber(subscriberId, {
      type: "CONNECTED",
      task_id: taskIds.join(","),
      workspace_path: workspacePath,
      timestamp: now,
    });

    return () => {
      this.unsubscribeById(subscriberId);
    };
  }

  /**
   * Broadcast an event to all subscribers of a task
   *
   * @param taskId - Task ID to broadcast to
   * @param event - Event data (task_id and timestamp are auto-filled)
   * @param workspacePath - Optional workspace path for workspace-level broadcasting
   */
  broadcast(
    taskId: string,
    event: { type: TaskSSEEventType; timestamp?: number; [key: string]: unknown },
    workspacePath?: string
  ): void {
    const fullEvent: TaskSSEEvent = {
      ...event,
      type: event.type,
      task_id: taskId,
      workspace_path: workspacePath,
      timestamp: event.timestamp ?? Date.now(),
    };

    // Emit to task-specific listeners
    this.emitter.emit(`task:${taskId}`, fullEvent);

    // Emit to workspace-level listeners (if workspace path is provided)
    if (workspacePath) {
      this.emitter.emit(`workspace:${workspacePath}`, fullEvent);
    }

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

    // Emit to workspace-level listeners (if workspace path is present)
    if (event.workspace_path) {
      this.emitter.emit(`workspace:${event.workspace_path}`, event);
    }

    // Emit to global listeners
    this.emitter.emit("task:*", event);
  }

  /**
   * Send a heartbeat to all subscribers and detect dead connections
   *
   * Returns the number of subscribers that failed to receive the heartbeat
   */
  sendHeartbeat(): number {
    const timestamp = Date.now();
    let failedCount = 0;

    // Send heartbeat to all subscribers
    for (const [subscriberId, info] of this.subscribers) {
      const event: TaskSSEEvent = {
        type: "HEARTBEAT",
        task_id: info.taskId,
        timestamp,
      };

      const success = this.sendToSubscriberWithTracking(subscriberId, event);
      if (!success) {
        failedCount++;
      }
    }

    return failedCount;
  }

  /**
   * Send event to subscriber with success/failure tracking
   * Returns true if sent successfully, false otherwise
   */
  private sendToSubscriberWithTracking(subscriberId: string, event: TaskSSEEvent): boolean {
    const info = this.subscribers.get(subscriberId);
    if (!info) return false;

    try {
      const result = info.listener(event);

      // If listener returns false explicitly, treat as failure
      if (result === false) {
        info.failedSends++;
        return false;
      }

      // Success - reset failure count and update activity
      info.failedSends = 0;
      info.lastActivity = Date.now();
      return true;
    } catch (error) {
      // Exception during send - connection is likely dead
      info.failedSends++;
      console.error(`[TaskSSEManager] Error sending to subscriber ${subscriberId}:`, error);
      return false;
    }
  }

  /**
   * Clean up stale or dead subscribers
   *
   * A subscriber is considered stale/dead if:
   * 1. No activity for longer than staleTimeoutMs, OR
   * 2. Consecutive failed sends exceed maxFailedSends
   *
   * @returns Number of subscribers cleaned up
   */
  cleanupStaleSubscribers(): number {
    const now = Date.now();
    const staleThreshold = now - this.config.staleTimeoutMs;
    const toRemove: string[] = [];

    for (const [subscriberId, info] of this.subscribers) {
      const isStale = info.lastActivity < staleThreshold;
      const isDead = info.failedSends >= this.config.maxFailedSends;

      if (isStale || isDead) {
        toRemove.push(subscriberId);
        console.log(
          `[TaskSSEManager] Cleaning up subscriber ${subscriberId}: ` +
            `stale=${isStale} (lastActivity=${now - info.lastActivity}ms ago), ` +
            `dead=${isDead} (failedSends=${info.failedSends})`
        );
      }
    }

    // Remove stale subscribers
    for (const subscriberId of toRemove) {
      this.unsubscribeById(subscriberId);
    }

    if (toRemove.length > 0) {
      console.log(`[TaskSSEManager] Cleaned up ${toRemove.length} stale subscribers`);
    }

    return toRemove.length;
  }

  /**
   * Start periodic heartbeat and cleanup
   *
   * This should be called when the gateway starts.
   * It starts two intervals:
   * 1. Heartbeat - sends ping to all subscribers to detect dead connections
   * 2. Cleanup - removes stale/dead subscribers to prevent memory leaks
   *
   * @returns Stop function that clears both intervals
   */
  startHeartbeat(intervalMs?: number): () => void {
    const heartbeatMs = intervalMs ?? this.config.heartbeatIntervalMs;

    // Start heartbeat interval
    this.heartbeatIntervalId = setInterval(() => {
      this.sendHeartbeat();
    }, heartbeatMs);

    // Start cleanup interval
    this.cleanupIntervalId = setInterval(() => {
      this.cleanupStaleSubscribers();
    }, this.config.cleanupIntervalMs);

    console.log(
      `[TaskSSEManager] Started heartbeat (${heartbeatMs}ms) and cleanup (${this.config.cleanupIntervalMs}ms) intervals`
    );

    return () => this.stopHeartbeat();
  }

  /**
   * Stop heartbeat and cleanup intervals
   */
  stopHeartbeat(): void {
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
    console.log("[TaskSSEManager] Stopped heartbeat and cleanup intervals");
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
   * Get statistics about subscribers
   */
  getStats(): {
    totalSubscribers: number;
    taskCount: number;
    staleCount: number;
    failingCount: number;
  } {
    const now = Date.now();
    const staleThreshold = now - this.config.staleTimeoutMs;
    let staleCount = 0;
    let failingCount = 0;

    for (const info of this.subscribers.values()) {
      if (info.lastActivity < staleThreshold) staleCount++;
      if (info.failedSends > 0) failingCount++;
    }

    return {
      totalSubscribers: this.subscribers.size,
      taskCount: this.taskSubscribers.size,
      staleCount,
      failingCount,
    };
  }

  /**
   * Send event to a specific subscriber (without tracking)
   * Used for initial connection events
   */
  private sendToSubscriber(subscriberId: string, event: TaskSSEEvent): void {
    const info = this.subscribers.get(subscriberId);
    if (info) {
      try {
        info.listener(event);
        info.lastActivity = Date.now();
      } catch (error) {
        info.failedSends++;
        console.error(`[TaskSSEManager] Error sending to subscriber ${subscriberId}:`, error);
      }
    }
  }

  /**
   * Mark a subscriber as active (called when receiving data from client)
   * This can be used by routes that receive acknowledgments from clients
   */
  markActive(subscriberId: string): void {
    const info = this.subscribers.get(subscriberId);
    if (info) {
      info.lastActivity = Date.now();
      info.failedSends = 0;
    }
  }

  /**
   * Close all connections (cleanup)
   */
  close(): void {
    this.stopHeartbeat();
    this.emitter.removeAllListeners();
    this.subscribers.clear();
    this.taskSubscribers.clear();
    this.workspaceSubscribers.clear();
    console.log("[TaskSSEManager] Closed and cleaned up all resources");
  }

  /**
   * Get count of workspace subscribers
   *
   * @param workspacePath - Workspace path
   * @returns Subscriber count
   */
  getWorkspaceSubscriberCount(workspacePath: string): number {
    return this.workspaceSubscribers.get(workspacePath)?.size ?? 0;
  }

  /**
   * Get list of workspaces with active subscribers
   */
  getActiveWorkspaces(): string[] {
    return Array.from(this.workspaceSubscribers.keys());
  }
}

/**
 * Singleton SSE manager instance
 */
export const taskSSEManager = new TaskSSEManager();
