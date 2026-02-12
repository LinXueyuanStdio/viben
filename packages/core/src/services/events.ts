/**
 * Event service for SSE streaming
 *
 * Provides event broadcasting and streaming for the gateway, including:
 * - Gateway events (agent spawned, completed, etc.)
 * - JSON Patch streams for task/session updates
 */
import { EventEmitter } from "node:events";
import type { Task, Session } from "../db/types";

/**
 * Gateway event types
 */
export type GatewayEvent =
  | { type: "agent_spawned"; data: { agentId: string; sessionId: string } }
  | { type: "agent_completed"; data: { agentId: string; sessionId: string; success: boolean } }
  | { type: "task_status_changed"; data: { taskId: string; oldStatus: string; newStatus: string } }
  | { type: "task_created"; data: { taskId: string } }
  | { type: "task_updated"; data: { taskId: string } }
  | { type: "task_deleted"; data: { taskId: string } }
  | { type: "session_created"; data: { sessionId: string } }
  | { type: "session_updated"; data: { sessionId: string } }
  | { type: "session_deleted"; data: { sessionId: string } }
  | { type: "session_message"; data: { sessionId: string; content: string; role: string } }
  | { type: "execution_log"; data: { sessionId: string; logType: string; content: string } }
  | { type: "json_patch"; data: { patch: unknown } }
  | { type: "error"; data: { message: string; code?: string } }
  // Group chat events
  | { type: "group_chat_created"; data: { groupChatId: string } }
  | { type: "group_chat_updated"; data: { groupChatId: string } }
  | { type: "group_chat_deleted"; data: { groupChatId: string } }
  | { type: "group_chat_member_joined"; data: { groupChatId: string; memberId: string } }
  | { type: "group_chat_member_left"; data: { groupChatId: string; memberId: string } }
  | { type: "group_chat_message"; data: { groupChatId: string; messageId: string } }
  | { type: "group_chat_agent_thinking"; data: { groupChatId: string; sessionId: string; agentId: string; agentName: string } }
  | { type: "group_chat_agent_progress"; data: { groupChatId: string; sessionId: string; agentId: string; delta: string } }
  | { type: "group_chat_agent_response"; data: { groupChatId: string; sessionId: string; agentId: string; agentName: string; content: string; duration?: number } }
  | { type: "group_chat_agent_error"; data: { groupChatId: string; sessionId: string; agentId: string; agentName: string; error: string } }
  | { type: "group_chat_error"; data: { groupChatId: string; sessionId: string; error: string } }
  | { type: "group_chat_round_complete"; data: { groupChatId: string; sessionId: string; successCount: number; errorCount: number; duration: number } }
  // Cron job events
  | { type: "cron_job_created"; data: { job: CronJobData } }
  | { type: "cron_job_updated"; data: { job: CronJobData } }
  | { type: "cron_job_deleted"; data: { jobId: string } }
  | { type: "cron_job_triggered"; data: { jobId: string; triggeredAt: number } }
  | { type: "cron_job_completed"; data: { jobId: string; jobName: string; jobType: string; status: string; durationMs: number; output?: string; completedAt: number } }
  | { type: "cron_job_message"; data: { jobId: string; agentId: string; message: string } }
  // Channel events
  | { type: "channel_message_received"; data: { channelType: string; channelName: string; chatId: string; senderName?: string; message: string; timestamp: number } }
  | { type: "channel_connection_status"; data: { channelType: string; channelName: string; connected: boolean; error?: string } }
  | { type: "channel_created"; data: { channel: unknown } }
  | { type: "channel_updated"; data: { channel: unknown } }
  | { type: "channel_deleted"; data: { channelId: string } };

/**
 * Cron job data for events
 */
export interface CronJobData {
  id: string;
  name: string;
  enabled: boolean;
  jobType: "agent" | "script";
  message?: string;
  script?: string;
  cron?: string;
  every?: number;
  channel?: string;
  agent: string;
  lastRun?: number;
  lastStatus?: string;
  nextRun?: number;
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
  private patchEmitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(1000);
    this.patchEmitter = new EventEmitter();
    this.patchEmitter.setMaxListeners(1000);
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
    this.patchEmitter.emit("patch", patch);
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
    this.patchEmitter.on("patch", listener);
    return () => this.patchEmitter.off("patch", listener);
  }

  // Convenience methods for common events

  /**
   * Broadcast agent spawned event
   */
  agentSpawned(agentId: string, sessionId: string): void {
    this.broadcast({
      type: "agent_spawned",
      data: { agentId, sessionId },
    });
  }

  /**
   * Broadcast agent completed event
   */
  agentCompleted(agentId: string, sessionId: string, success: boolean): void {
    this.broadcast({
      type: "agent_completed",
      data: { agentId, sessionId, success },
    });
  }

  /**
   * Broadcast task status changed event
   */
  taskStatusChanged(taskId: string, oldStatus: string, newStatus: string): void {
    this.broadcast({
      type: "task_status_changed",
      data: { taskId, oldStatus, newStatus },
    });
  }

  /**
   * Broadcast task created event and JSON patch
   */
  taskCreated(task: Task): void {
    this.broadcast({
      type: "task_created",
      data: { taskId: task.id },
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
      data: { taskId: task.id },
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
  taskDeleted(taskId: string): void {
    this.broadcast({
      type: "task_deleted",
      data: { taskId },
    });
    this.broadcastPatch([
      {
        op: "remove",
        path: `/tasks/${taskId}`,
      },
    ]);
  }

  /**
   * Broadcast session created event and JSON patch
   */
  sessionCreated(session: Session): void {
    this.broadcast({
      type: "session_created",
      data: { sessionId: session.id },
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
      data: { sessionId: session.id },
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
  sessionDeleted(sessionId: string): void {
    this.broadcast({
      type: "session_deleted",
      data: { sessionId },
    });
    this.broadcastPatch([
      {
        op: "remove",
        path: `/sessions/${sessionId}`,
      },
    ]);
  }

  /**
   * Broadcast session message event
   */
  sessionMessage(sessionId: string, content: string, role: string): void {
    this.broadcast({
      type: "session_message",
      data: { sessionId, content, role },
    });
  }

  /**
   * Broadcast execution log event
   */
  executionLog(sessionId: string, logType: string, content: string): void {
    this.broadcast({
      type: "execution_log",
      data: { sessionId, logType, content },
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
