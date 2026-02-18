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
  | { type: "cron_job_completed"; data: { job_id: string; job_name: string; job_type: string; status: string; duration_ms: number; output?: string; completed_at: number } }
  | { type: "cron_job_message"; data: { job_id: string; agent_id: string; message: string } }
  // Channel events
  | { type: "channel_message_received"; data: { channel_type: string; channel_name: string; chat_id: string; sender_name?: string; message: string; timestamp: number } }
  | { type: "channel_connection_status"; data: { channel_type: string; channel_name: string; connected: boolean; error?: string } }
  | { type: "channel_created"; data: { channel: unknown } }
  | { type: "channel_updated"; data: { channel: unknown } }
  | { type: "channel_deleted"; data: { channel_id: string } };

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
}

/**
 * Singleton event service instance
 */
export const eventService = new EventService();
