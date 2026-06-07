import type { AgentMessage } from "../types";

export type TodoListItemStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "cancelled";

export interface TodoListItem {
  id: string;
  content: string;
  status: TodoListItemStatus;
  createdAt?: number;
  updatedAt?: number;
  toolUseId?: string;
  raw?: Record<string, unknown>;
}

export interface TodoListPanelProps {
  /** Tool messages containing TaskCreate, TaskUpdate, TodoList, or TodoWrite calls. */
  messages?: AgentMessage[];
  /** Precomputed todo items. When provided, these are rendered directly. */
  items?: TodoListItem[];
  className?: string;
  compact?: boolean;
  defaultExpanded?: boolean;
}
