/**
 * Kanban Types
 * 看板类型定义
 */

// ============================================================================
// Comment Types
// ============================================================================

/** Comment author information */
export interface CommentAuthor {
  id: string;
  name: string;
  avatar?: string;
}

/** Comment reaction user */
export interface CommentReactionUser {
  id: string;
  name: string;
}

/** Comment reaction */
export interface CommentReaction {
  emoji: string;
  users: CommentReactionUser[];
  count: number;
}

/** Kanban comment */
export interface KanbanComment {
  id: string;
  task_id: string;
  content: string;
  author: CommentAuthor;
  createdAt: string;
  updatedAt?: string;
  reactions: CommentReaction[];
}

// ============================================================================
// Activity Types
// ============================================================================

/** Activity actor information */
export interface ActivityActor {
  id: string;
  name: string;
  avatar?: string;
}

/** Activity type */
export type ActivityType =
  | "created"
  | "status_changed"
  | "priority_changed"
  | "assignee_changed"
  | "title_changed"
  | "description_changed"
  | "tag_added"
  | "tag_removed"
  | "due_date_changed"
  | "comment_added";

/** Activity data */
export interface ActivityData {
  oldValue?: string;
  newValue?: string;
  [key: string]: unknown;
}

/** Kanban activity event */
export interface KanbanActivity {
  id: string;
  task_id: string;
  type: ActivityType;
  actor: ActivityActor;
  timestamp: string;
  data: ActivityData;
}
