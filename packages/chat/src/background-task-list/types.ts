import type { AgentMessage } from "../types";

export type BackgroundTaskKind = "cron" | "agent" | "task" | "bash" | "other";
export type BackgroundTaskStatus = "running" | "queued" | "completed" | "failed" | "cancelled";

export interface BackgroundTaskUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  costUsd?: number;
}

export interface BackgroundTaskItem {
  id: string;
  kind: BackgroundTaskKind;
  description: string;
  status: BackgroundTaskStatus;
  startedAt?: number;
  endedAt?: number;
  elapsedMs?: number;
  now?: number;
  usage?: BackgroundTaskUsage;
  usageLabel?: string;
  details?: string;
  messages?: AgentMessage[];
  sourceMessage?: AgentMessage;
}

export interface BackgroundTaskListProps {
  /** Explicit tasks supplied by a host app. */
  tasks?: BackgroundTaskItem[];
  /** Optional messages used to derive unresolved Agent, Task, Cron, and Bash tools. */
  messages?: AgentMessage[];
  now?: number;
  className?: string;
  defaultExpanded?: boolean;
  onTaskClick?: (task: BackgroundTaskItem) => void;
}
