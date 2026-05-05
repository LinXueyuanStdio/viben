import type {
  Assignee,
  IssuePriority,
  Subtask,
  Tag,
  TaskRelationship,
} from "@viben/kanban";
import type { TaskLog } from "../task-tabs";
import type {
  ExecutionPhase,
  ReviewReason,
  TaskEvent,
  XStateValue,
} from "@/lib/kanban/types";

export interface TaskForPanel {
  id: string;
  name?: string;
  title: string;
  description?: string | null;
  status: string;
  priority?: IssuePriority;
  tags?: Tag[];
  tagIds?: string[];
  assigneeId?: string;
  assignee?: Assignee;
  dueDate?: string;
  created_at: string;
  updated_at: string;
  session_id?: string | null;
  agent_id?: string | null;
  model?: string | null;
  executor?: string;
  subtasks?: Subtask[];
  relationships?: TaskRelationship[];
  specsPath?: string;
  prdContent?: string | null;
  logs?: TaskLog | null;
  xstateState?: XStateValue;
  lastEvent?: TaskEvent;
  eventHistory?: TaskEvent[];
  reviewReason?: ReviewReason;
  executionPhase?: ExecutionPhase;
  isStuck?: boolean;
  stuckDuration?: number;
  branch?: string;
  base_branch?: string;
  pr_url?: string;
  worktree_path?: string | null;
  workspace_path?: string | null;
  creator?: string;
  current_phase?: number;
  next_action?: Array<{ phase: number; action: string; startTime?: string; endTime?: string }>;
  notes?: string;
}

export interface AvailableTask {
  id: string;
  title: string;
}

export interface AvailableAgent {
  id: string;
  name: string;
  description?: string;
  agent_dir?: string;
  config_path?: string;
}

export interface TaskDetailPanelProps {
  task: TaskForPanel | null;
  onClose: () => void;
  onUpdate?: (updates: Record<string, unknown>) => void;
  onStartTask?: (taskId: string) => void;
  availableTags?: Tag[];
  availableUsers?: Assignee[];
  availableTasks?: AvailableTask[];
  availableAgents?: AvailableAgent[];
  onNavigateToTask?: (taskId: string) => void;
  currentUserId?: string;
  currentUserName?: string;
  workspacePath?: string;
  autoStartOnOpen?: boolean;
  onAutoStartConsumed?: () => void;
}
