/**
 * Event service for SSE streaming
 *
 * Provides event broadcasting and streaming for the gateway, including:
 * - Gateway events (agent spawned, completed, etc.)
 * - JSON Patch streams for task/session updates
 *
 * All field names use snake_case for consistency.
 */
import { EventEmitter } from "node:events";
import type { Task, Session } from "../db/types";
import type { Device } from "../devices/types";

/**
 * Gateway event types
 * All data fields use snake_case naming convention
 */
export type GatewayEvent =
  | { type: "agent_spawned"; data: { agent_id: string; session_id: string } }
  | { type: "agent_completed"; data: { agent_id: string; session_id: string; success: boolean } }
  | { type: "task_status_changed"; data: { task_id: string; old_status: string; new_status: string } }
  | { type: "task_created"; data: { task_id: string } }
  | { type: "task_updated"; data: { task_id: string } }
  | { type: "task_deleted"; data: { task_id: string } }
  | { type: "session_created"; data: { session_id: string } }
  | { type: "session_updated"; data: { session_id: string } }
  | { type: "session_deleted"; data: { session_id: string } }
  | { type: "session_message"; data: { session_id: string; content: string; role: string } }
  | { type: "execution_log"; data: { session_id: string; log_type: string; content: string } }
  | { type: "json_patch"; data: { patch: unknown } }
  | { type: "error"; data: { message: string; code?: string } }
  // Group chat events
  | { type: "group_chat_created"; data: { group_chat_id: string } }
  | { type: "group_chat_updated"; data: { group_chat_id: string } }
  | { type: "group_chat_deleted"; data: { group_chat_id: string } }
  | { type: "group_chat_member_joined"; data: { group_chat_id: string; member_id: string } }
  | { type: "group_chat_member_left"; data: { group_chat_id: string; member_id: string } }
  | { type: "group_chat_message"; data: { group_chat_id: string; message_id: string } }
  | { type: "group_chat_agent_thinking"; data: { group_chat_id: string; session_id: string; agent_id: string; agent_name: string } }
  | { type: "group_chat_agent_progress"; data: { group_chat_id: string; session_id: string; agent_id: string; delta: string } }
  | { type: "group_chat_agent_response"; data: { group_chat_id: string; session_id: string; agent_id: string; agent_name: string; content: string; duration?: number } }
  | { type: "group_chat_agent_error"; data: { group_chat_id: string; session_id: string; agent_id: string; agent_name: string; error: string } }
  | { type: "group_chat_error"; data: { group_chat_id: string; session_id: string; error: string } }
  | { type: "group_chat_round_complete"; data: { group_chat_id: string; session_id: string; success_count: number; error_count: number; duration: number } }
  // Cron job events
  | { type: "cron_job_created"; data: { job: CronJobData } }
  | { type: "cron_job_updated"; data: { job: CronJobData } }
  | { type: "cron_job_deleted"; data: { job_id: string } }
  | { type: "cron_job_triggered"; data: { job_id: string; triggered_at: number } }
  | { type: "cron_job_completed"; data: { job_id: string; job_name: string; job_type: string; status: string; duration_ms: number; output?: string; completed_at: number; next_run?: number; notifications?: { in_app?: boolean; system?: boolean; channel_ids?: string[] } } }
  | { type: "cron_job_message"; data: { job_id: string; agent_id: string; message: string } }
  // Channel events
  | { type: "channel_message_received"; data: { channel_type: string; channel_name: string; chat_id: string; sender_name?: string; message: string; timestamp: number } }
  | { type: "channel_connection_status"; data: { channel_type: string; channel_name: string; connected: boolean; error?: string } }
  | { type: "channel_created"; data: { channel: unknown } }
  | { type: "channel_updated"; data: { channel: unknown } }
  | { type: "channel_deleted"; data: { channel_id: string } }
  // Task queue events
  | { type: "queue_task_queued"; data: { task: QueueTaskSummary } }
  | { type: "queue_task_started"; data: { task: QueueTaskSummary } }
  | { type: "queue_task_progress"; data: { task_id: string; progress: unknown } }
  | { type: "queue_task_completed"; data: { task: QueueTaskSummary; duration?: number } }
  | { type: "queue_task_failed"; data: { task: QueueTaskSummary; error?: string; duration?: number } }
  | { type: "queue_task_cancelled"; data: { task: QueueTaskSummary } }
  | { type: "queue_status_changed"; data: QueueStatusData }
  | { type: "queue_restored"; data: { pending_count: number; running_recovered: number; running_failed?: number } }
  // GitHub auto-fix events
  | { type: "github_autofix_task_created"; data: { task_id: string; workspace_path: string; issue_numbers: number[] } }
  | { type: "github_autofix_task_status_changed"; data: { task_id: string; workspace_path: string; status: string; previous_status?: string } }
  | { type: "github_autofix_task_progress"; data: { task_id: string; workspace_path: string; message: string; percent?: number } }
  | { type: "github_autofix_task_log"; data: { task_id: string; workspace_path: string; level: "info" | "warn" | "error"; message: string } }
  | { type: "github_autofix_task_completed"; data: { task_id: string; workspace_path: string; pr_number?: number; error?: string } }
  | { type: "github_autofix_task_cancelled"; data: { task_id: string; workspace_path: string } }
  // Task state machine events
  | { type: "task_state_changed"; data: TaskStateChangedData }
  | { type: "task_recovered"; data: TaskRecoveredData }
  | { type: "task_event_applied"; data: TaskEventAppliedData }
  // Device mesh events
  | { type: "device_connected"; data: { device: Device } }
  | { type: "device_disconnected"; data: { device_id: string } }
  | { type: "device_updated"; data: { device: Device } }
  | { type: "mesh_peer_joined"; data: { gateway_id: string; name: string; address: string } }
  | { type: "mesh_peer_left"; data: { gateway_id: string } };

/**
 * Queue task summary for events
 * All fields use snake_case naming convention
 */
export interface QueueTaskSummary {
  id: string;
  status: string;
  agent_id: string;
  created_at: number;
  position?: number;
}

/**
 * Queue status data for events
 */
export interface QueueStatusData {
  pending_count: number;
  running_count: number;
  max_concurrency: number;
  tasks: QueueTaskSummary[];
}

/**
 * Cron job data for events
 * All fields use snake_case naming convention
 */
export interface CronJobData {
  id: string;
  name: string;
  enabled: boolean;
  job_type: "agent" | "script";
  message?: string;
  script?: string;
  cron?: string;
  every?: number;
  channel?: string;
  agent: string;
  last_run?: number;
  last_status?: string;
  next_run?: number;
}

/**
 * Task state changed event data (XState state machine)
 */
export interface TaskStateChangedData {
  task_id: string;
  workspace_path: string;
  old_state: string;
  new_state: string;
  event_type: string;
  event_id: string;
  sequence: number;
  timestamp: number;
}

/**
 * Task recovered event data (stuck detection)
 */
export interface TaskRecoveredData {
  task_id: string;
  workspace_path: string;
  reason: string;
  auto_recovery: boolean;
  new_status: string;
  timestamp: number;
}

/**
 * Task event applied data
 */
export interface TaskEventAppliedData {
  task_id: string;
  workspace_path: string;
  event_id: string;
  event_type: string;
  sequence: number;
  new_state: string;
  timestamp: number;
}

/**
 * Event listener type
 */
export type EventListener = (event: GatewayEvent) => void;

/**
 * Event service for broadcasting gateway events
 */
export class EventService {
  private emitter: EventEmitter;
  private patch_emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(1000);
    this.patch_emitter = new EventEmitter();
    this.patch_emitter.setMaxListeners(1000);
  }

  /**
   * Broadcast an event
   */
  broadcast(event: GatewayEvent): void {
    this.emitter.emit("event", event);
  }

  /**
   * Broadcast a JSON Patch
   */
  broadcastPatch(patch: unknown): void {
    this.patch_emitter.emit("patch", patch);
  }

  /**
   * Subscribe to events
   */
  subscribe(listener: EventListener): () => void {
    this.emitter.on("event", listener);
    return () => this.emitter.off("event", listener);
  }

  /**
   * Subscribe to patches
   */
  subscribePatch(listener: (patch: unknown) => void): () => void {
    this.patch_emitter.on("patch", listener);
    return () => this.patch_emitter.off("patch", listener);
  }

  // Convenience methods for common events

  /**
   * Broadcast agent spawned event
   */
  agentSpawned(agent_id: string, session_id: string): void {
    this.broadcast({
      type: "agent_spawned",
      data: { agent_id, session_id },
    });
  }

  /**
   * Broadcast agent completed event
   */
  agentCompleted(agent_id: string, session_id: string, success: boolean): void {
    this.broadcast({
      type: "agent_completed",
      data: { agent_id, session_id, success },
    });
  }

  /**
   * Broadcast task status changed event
   */
  taskStatusChanged(task_id: string, old_status: string, new_status: string): void {
    this.broadcast({
      type: "task_status_changed",
      data: { task_id, old_status, new_status },
    });
  }

  /**
   * Broadcast task created event and JSON patch
   */
  taskCreated(task: Task): void {
    this.broadcast({
      type: "task_created",
      data: { task_id: task.id },
    });
    this.broadcastPatch([
      {
        op: "add",
        path: `/tasks/${task.id}`,
        value: task,
      },
    ]);
  }

  /**
   * Broadcast task updated event and JSON patch
   */
  taskUpdated(task: Task): void {
    this.broadcast({
      type: "task_updated",
      data: { task_id: task.id },
    });
    this.broadcastPatch([
      {
        op: "replace",
        path: `/tasks/${task.id}`,
        value: task,
      },
    ]);
  }

  /**
   * Broadcast task deleted event and JSON patch
   */
  taskDeleted(task_id: string): void {
    this.broadcast({
      type: "task_deleted",
      data: { task_id },
    });
    this.broadcastPatch([
      {
        op: "remove",
        path: `/tasks/${task_id}`,
      },
    ]);
  }

  /**
   * Broadcast session created event and JSON patch
   */
  sessionCreated(session: Session): void {
    this.broadcast({
      type: "session_created",
      data: { session_id: session.id },
    });
    this.broadcastPatch([
      {
        op: "add",
        path: `/sessions/${session.id}`,
        value: session,
      },
    ]);
  }

  /**
   * Broadcast session updated event and JSON patch
   */
  sessionUpdated(session: Session): void {
    this.broadcast({
      type: "session_updated",
      data: { session_id: session.id },
    });
    this.broadcastPatch([
      {
        op: "replace",
        path: `/sessions/${session.id}`,
        value: session,
      },
    ]);
  }

  /**
   * Broadcast session deleted event and JSON patch
   */
  sessionDeleted(session_id: string): void {
    this.broadcast({
      type: "session_deleted",
      data: { session_id },
    });
    this.broadcastPatch([
      {
        op: "remove",
        path: `/sessions/${session_id}`,
      },
    ]);
  }

  /**
   * Broadcast session message event
   */
  sessionMessage(session_id: string, content: string, role: string): void {
    this.broadcast({
      type: "session_message",
      data: { session_id, content, role },
    });
  }

  /**
   * Broadcast execution log event
   */
  executionLog(session_id: string, log_type: string, content: string): void {
    this.broadcast({
      type: "execution_log",
      data: { session_id, log_type, content },
    });
  }

  /**
   * Broadcast error event
   */
  error(message: string, code?: string): void {
    this.broadcast({
      type: "error",
      data: { message, code },
    });
  }

  // GitHub Auto-Fix Events

  /**
   * Broadcast GitHub auto-fix task created event
   */
  githubAutofixTaskCreated(task_id: string, workspace_path: string, issue_numbers: number[]): void {
    this.broadcast({
      type: "github_autofix_task_created",
      data: { task_id, workspace_path, issue_numbers },
    });
  }

  /**
   * Broadcast GitHub auto-fix task status changed event
   */
  githubAutofixTaskStatusChanged(
    task_id: string,
    workspace_path: string,
    status: string,
    previous_status?: string
  ): void {
    this.broadcast({
      type: "github_autofix_task_status_changed",
      data: { task_id, workspace_path, status, previous_status },
    });
  }

  /**
   * Broadcast GitHub auto-fix task progress event
   */
  githubAutofixTaskProgress(
    task_id: string,
    workspace_path: string,
    message: string,
    percent?: number
  ): void {
    this.broadcast({
      type: "github_autofix_task_progress",
      data: { task_id, workspace_path, message, percent },
    });
  }

  /**
   * Broadcast GitHub auto-fix task log event
   */
  githubAutofixTaskLog(
    task_id: string,
    workspace_path: string,
    level: "info" | "warn" | "error",
    message: string
  ): void {
    this.broadcast({
      type: "github_autofix_task_log",
      data: { task_id, workspace_path, level, message },
    });
  }

  /**
   * Broadcast GitHub auto-fix task completed event
   */
  githubAutofixTaskCompleted(
    task_id: string,
    workspace_path: string,
    pr_number?: number,
    error?: string
  ): void {
    this.broadcast({
      type: "github_autofix_task_completed",
      data: { task_id, workspace_path, pr_number, error },
    });
  }

  /**
   * Broadcast GitHub auto-fix task cancelled event
   */
  githubAutofixTaskCancelled(task_id: string, workspace_path: string): void {
    this.broadcast({
      type: "github_autofix_task_cancelled",
      data: { task_id, workspace_path },
    });
  }

}

/**
 * Singleton event service instance
 */
export const eventService = new EventService();
