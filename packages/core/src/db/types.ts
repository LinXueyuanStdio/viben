/**
 * Database types for Viben
 */

/**
 * Task status - unified status system
 * State flow: backlog → queue → in_progress → ai_review → human_review → done/pr_created
 */
export type TaskStatus =
  | "backlog"       // 待办 - Tasks waiting to be started
  | "queue"         // 排队 - Tasks waiting for available capacity
  | "in_progress"   // 执行中 - Currently running (planning/coding)
  | "ai_review"     // AI审查 - AI automatic review
  | "human_review"  // 人工审查 - Needs human review
  | "done"          // 完成 - Completed
  | "pr_created"    // PR已创建 - PR has been created
  | "error";        // 错误 - Error state

/**
 * Task entity
 */
export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  agentId?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create task request
 */
export interface CreateTask {
  id?: string;
  title: string;
  description?: string;
  agentId?: string;
}

/**
 * Update task request
 */
export interface UpdateTask {
  title?: string;
  description?: string;
  status?: TaskStatus;
  agentId?: string;
}

/**
 * Session status
 */
export type SessionStatus = "active" | "completed" | "cancelled";

/**
 * Session entity
 */
export interface Session {
  id: string;
  agentId: string;
  taskId?: string;
  status: SessionStatus;
  prompt?: string;
  sessionData: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create session request
 */
export interface CreateSession {
  id?: string;
  agentId: string;
  taskId?: string;
  prompt?: string;
  sessionData?: Record<string, unknown>;
}

/**
 * Update session request
 */
export interface UpdateSession {
  status?: SessionStatus;
  taskId?: string;
  prompt?: string;
  sessionData?: Record<string, unknown>;
}

/**
 * Execution process status
 */
export type ExecutionProcessStatus = "running" | "completed" | "failed" | "cancelled";

/**
 * Execution process entity
 */
export interface ExecutionProcess {
  id: string;
  sessionId: string;
  pid?: number;
  status: ExecutionProcessStatus;
  exitCode?: number;
  startedAt: string;
  endedAt?: string;
}

/**
 * Create execution process request
 */
export interface CreateExecutionProcess {
  id?: string;
  sessionId: string;
  pid?: number;
}

/**
 * Update execution process request
 */
export interface UpdateExecutionProcess {
  status?: ExecutionProcessStatus;
  pid?: number;
  exitCode?: number;
  endedAt?: string;
}

/**
 * Group chat member type
 */
export type MemberType = "human" | "agent" | "executor";

/**
 * Group chat member role
 */
export type MemberRole = "owner" | "admin" | "member";

/**
 * Group chat entity
 */
export interface GroupChat {
  id: string;
  name: string;
  description?: string;
  taskId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Group chat member entity
 */
export interface GroupChatMember {
  id: string;
  groupChatId: string;
  memberType: MemberType;
  memberId: string;
  displayName: string;
  role: MemberRole;
  joinedAt: string;
  lastSeenAt?: string;
}

/**
 * Group chat message content type
 */
export type MessageContentType = "text" | "code" | "file" | "system" | "tool_call";

/**
 * Group chat message entity
 */
export interface GroupChatMessage {
  id: string;
  groupChatId: string;
  senderId: string;
  senderType: MemberType;
  senderName: string;
  contentType: MessageContentType;
  content: string;
  mentions?: string[];
  replyTo?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
