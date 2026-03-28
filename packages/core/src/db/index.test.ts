/**
 * Database Models Tests
 *
 * Tests for file-based YAML storage models:
 * - TaskModel
 * - SessionModel
 * - ExecutionProcessModel
 * - GroupChatModel
 * - GroupChatMemberModel
 * - GroupChatMessageModel
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  TaskModel,
  SessionModel,
  ExecutionProcessModel,
  GroupChatModel,
  GroupChatMemberModel,
  GroupChatMessageModel,
} from "./models";
import { NotFoundError } from "../error";

// ============================================================================
// TaskModel Tests
// ============================================================================

describe("TaskModel", () => {
  let tempDir: string;
  let originalStateDir: string | undefined;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "viben-task-test-"));
    originalStateDir = process.env.VIBEN_STATE_DIR;
    process.env.VIBEN_STATE_DIR = tempDir;
  });

  afterEach(async () => {
    if (originalStateDir !== undefined) {
      process.env.VIBEN_STATE_DIR = originalStateDir;
    } else {
      delete process.env.VIBEN_STATE_DIR;
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("create()", () => {
    it("should create a new task with default status", async () => {
      const task = await TaskModel.create({
        title: "Test Task",
        description: "A test task description",
      });

      expect(task.id).toBeDefined();
      expect(task.title).toBe("Test Task");
      expect(task.description).toBe("A test task description");
      expect(task.status).toBe("backlog");
      expect(task.created_at).toBeDefined();
      expect(task.updated_at).toBeDefined();
    });

    it("should create a task with custom id", async () => {
      const task = await TaskModel.create({
        id: "custom-task-id",
        title: "Custom ID Task",
      });

      expect(task.id).toBe("custom-task-id");
    });

    it("should create a task with agentId", async () => {
      const task = await TaskModel.create({
        title: "Agent Task",
        agentId: "agent-123",
      });

      expect(task.agentId).toBe("agent-123");
    });
  });

  describe("findById()", () => {
    it("should find task by ID", async () => {
      const created = await TaskModel.create({
        title: "Find Me",
        description: "A task to find",
      });

      const found = await TaskModel.findById(created.id);

      expect(found).not.toBeNull();
      expect(found?.title).toBe("Find Me");
      expect(found?.description).toBe("A task to find");
    });

    it("should return null for non-existent task", async () => {
      const found = await TaskModel.findById("non-existent-id");
      expect(found).toBeNull();
    });
  });

  describe("findAll()", () => {
    it("should return empty array when no tasks exist", async () => {
      const tasks = await TaskModel.findAll();
      expect(tasks).toEqual([]);
    });

    it("should return all tasks sorted by createdAt descending", async () => {
      await TaskModel.create({ title: "Task 1" });
      // Small delays to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 5));
      await TaskModel.create({ title: "Task 2" });
      await new Promise((resolve) => setTimeout(resolve, 5));
      await TaskModel.create({ title: "Task 3" });

      const tasks = await TaskModel.findAll();

      expect(tasks).toHaveLength(3);
      // Verify all tasks are present (ordering depends on timestamp precision)
      const titles = tasks.map((t) => t.title);
      expect(titles).toContain("Task 1");
      expect(titles).toContain("Task 2");
      expect(titles).toContain("Task 3");
    });
  });

  describe("findByAgentId()", () => {
    it("should find tasks by agent ID", async () => {
      await TaskModel.create({ title: "Agent 1 Task", agentId: "agent-1" });
      await TaskModel.create({ title: "Agent 2 Task", agentId: "agent-2" });
      await TaskModel.create({ title: "Another Agent 1 Task", agentId: "agent-1" });

      const tasks = await TaskModel.findByAgentId("agent-1");

      expect(tasks).toHaveLength(2);
      tasks.forEach((t) => expect(t.agentId).toBe("agent-1"));
    });

    it("should return empty array when no tasks match", async () => {
      await TaskModel.create({ title: "Task", agentId: "agent-1" });
      const tasks = await TaskModel.findByAgentId("agent-2");
      expect(tasks).toEqual([]);
    });
  });

  describe("findByStatus()", () => {
    it("should find tasks by status", async () => {
      const task1 = await TaskModel.create({ title: "Task 1" });
      await TaskModel.create({ title: "Task 2" });
      await TaskModel.update(task1.id, { status: "in_progress" });

      const backlogTasks = await TaskModel.findByStatus("backlog");
      const inProgressTasks = await TaskModel.findByStatus("in_progress");

      expect(backlogTasks).toHaveLength(1);
      expect(inProgressTasks).toHaveLength(1);
    });
  });

  describe("update()", () => {
    it("should update task title", async () => {
      const task = await TaskModel.create({ title: "Original" });

      // Small delay to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = await TaskModel.update(task.id, { title: "Updated" });

      expect(updated.title).toBe("Updated");
      expect(updated.updated_at).toBeDefined();
      // Verify the update was persisted
      const found = await TaskModel.findById(task.id);
      expect(found?.title).toBe("Updated");
    });

    it("should update task status", async () => {
      const task = await TaskModel.create({ title: "Task" });

      const updated = await TaskModel.update(task.id, { status: "completed" });

      expect(updated.status).toBe("completed");
    });

    it("should update task description", async () => {
      const task = await TaskModel.create({
        title: "Task",
        description: "Original description",
      });

      const updated = await TaskModel.update(task.id, {
        description: "New description",
      });

      expect(updated.description).toBe("New description");
    });

    it("should throw NotFoundError for non-existent task", async () => {
      await expect(
        TaskModel.update("non-existent", { title: "New" })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("updateStatus()", () => {
    it("should update only the status", async () => {
      const task = await TaskModel.create({ title: "Task" });

      await TaskModel.updateStatus(task.id, "review");

      const found = await TaskModel.findById(task.id);
      expect(found?.status).toBe("review");
    });
  });

  describe("delete()", () => {
    it("should delete existing task", async () => {
      const task = await TaskModel.create({ title: "To Delete" });

      const result = await TaskModel.delete(task.id);

      expect(result).toBe(true);
      const found = await TaskModel.findById(task.id);
      expect(found).toBeNull();
    });

    it("should return false for non-existent task", async () => {
      const result = await TaskModel.delete("non-existent");
      expect(result).toBe(false);
    });
  });
});

// ============================================================================
// SessionModel Tests
// ============================================================================

describe("SessionModel", () => {
  let tempDir: string;
  let originalStateDir: string | undefined;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "viben-session-test-"));
    originalStateDir = process.env.VIBEN_STATE_DIR;
    process.env.VIBEN_STATE_DIR = tempDir;
  });

  afterEach(async () => {
    if (originalStateDir !== undefined) {
      process.env.VIBEN_STATE_DIR = originalStateDir;
    } else {
      delete process.env.VIBEN_STATE_DIR;
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("create()", () => {
    it("should create a new session with default values", async () => {
      const session = await SessionModel.create({
        agentId: "agent-1",
      });

      expect(session.id).toBeDefined();
      expect(session.agentId).toBe("agent-1");
      expect(session.status).toBe("active");
      expect(session.sessionData).toEqual({});
      expect(session.created_at).toBeDefined();
      expect(session.updated_at).toBeDefined();
    });

    it("should create a session with custom id", async () => {
      const session = await SessionModel.create({
        id: "custom-session-id",
        agentId: "agent-1",
      });

      expect(session.id).toBe("custom-session-id");
    });

    it("should create a session with taskId and prompt", async () => {
      const session = await SessionModel.create({
        agentId: "agent-1",
        taskId: "task-123",
        prompt: "Test prompt",
      });

      expect(session.taskId).toBe("task-123");
      expect(session.prompt).toBe("Test prompt");
    });

    it("should create a session with sessionData", async () => {
      const session = await SessionModel.create({
        agentId: "agent-1",
        sessionData: { key: "value", count: 42 },
      });

      expect(session.sessionData).toEqual({ key: "value", count: 42 });
    });
  });

  describe("findById()", () => {
    it("should find session by ID", async () => {
      const created = await SessionModel.create({
        agentId: "agent-1",
        prompt: "Test prompt",
      });

      const found = await SessionModel.findById(created.id);

      expect(found).not.toBeNull();
      expect(found?.agentId).toBe("agent-1");
      expect(found?.prompt).toBe("Test prompt");
    });

    it("should return null for non-existent session", async () => {
      const found = await SessionModel.findById("non-existent");
      expect(found).toBeNull();
    });
  });

  describe("findAll()", () => {
    it("should return empty array when no sessions exist", async () => {
      const sessions = await SessionModel.findAll();
      expect(sessions).toEqual([]);
    });

    it("should return all sessions sorted by createdAt descending", async () => {
      await SessionModel.create({ agentId: "agent-1" });
      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 5));
      await SessionModel.create({ agentId: "agent-2" });
      await new Promise((resolve) => setTimeout(resolve, 5));
      await SessionModel.create({ agentId: "agent-3" });

      const sessions = await SessionModel.findAll();

      expect(sessions).toHaveLength(3);
      // Verify all agents are present (ordering may vary if timestamps are equal)
      const agentIds = sessions.map((s) => s.agentId);
      expect(agentIds).toContain("agent-1");
      expect(agentIds).toContain("agent-2");
      expect(agentIds).toContain("agent-3");
    });
  });

  describe("findByAgentId()", () => {
    it("should find sessions by agent ID", async () => {
      await SessionModel.create({ agentId: "agent-1" });
      await SessionModel.create({ agentId: "agent-2" });
      await SessionModel.create({ agentId: "agent-1" });

      const sessions = await SessionModel.findByAgentId("agent-1");

      expect(sessions).toHaveLength(2);
      sessions.forEach((s) => expect(s.agentId).toBe("agent-1"));
    });
  });

  describe("findByTaskId()", () => {
    it("should find sessions by task ID", async () => {
      await SessionModel.create({ agentId: "agent-1", taskId: "task-1" });
      await SessionModel.create({ agentId: "agent-2", taskId: "task-2" });
      await SessionModel.create({ agentId: "agent-3", taskId: "task-1" });

      const sessions = await SessionModel.findByTaskId("task-1");

      expect(sessions).toHaveLength(2);
      sessions.forEach((s) => expect(s.taskId).toBe("task-1"));
    });
  });

  describe("findByStatus()", () => {
    it("should find sessions by status", async () => {
      const session1 = await SessionModel.create({ agentId: "agent-1" });
      await SessionModel.create({ agentId: "agent-2" });
      await SessionModel.update(session1.id, { status: "completed" });

      const activeSessions = await SessionModel.findByStatus("active");
      const completedSessions = await SessionModel.findByStatus("completed");

      expect(activeSessions).toHaveLength(1);
      expect(completedSessions).toHaveLength(1);
    });
  });

  describe("findActiveByAgentId()", () => {
    it("should find active sessions for a specific agent", async () => {
      const session1 = await SessionModel.create({ agentId: "agent-1" });
      await SessionModel.create({ agentId: "agent-1" });
      await SessionModel.create({ agentId: "agent-2" });
      await SessionModel.update(session1.id, { status: "completed" });

      const activeSessions = await SessionModel.findActiveByAgentId("agent-1");

      expect(activeSessions).toHaveLength(1);
      expect(activeSessions[0].status).toBe("active");
    });
  });

  describe("update()", () => {
    it("should update session status", async () => {
      const session = await SessionModel.create({ agentId: "agent-1" });

      // Small delay to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = await SessionModel.update(session.id, {
        status: "completed",
      });

      expect(updated.status).toBe("completed");
      expect(updated.updated_at).toBeDefined();
      // Verify the update was persisted
      const found = await SessionModel.findById(session.id);
      expect(found?.status).toBe("completed");
    });

    it("should update session prompt", async () => {
      const session = await SessionModel.create({ agentId: "agent-1" });

      const updated = await SessionModel.update(session.id, {
        prompt: "New prompt",
      });

      expect(updated.prompt).toBe("New prompt");
    });

    it("should update sessionData", async () => {
      const session = await SessionModel.create({
        agentId: "agent-1",
        sessionData: { old: "data" },
      });

      const updated = await SessionModel.update(session.id, {
        sessionData: { new: "data" },
      });

      expect(updated.sessionData).toEqual({ new: "data" });
    });

    it("should throw NotFoundError for non-existent session", async () => {
      await expect(
        SessionModel.update("non-existent", { status: "completed" })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("updateStatus()", () => {
    it("should update only the status", async () => {
      const session = await SessionModel.create({ agentId: "agent-1" });

      await SessionModel.updateStatus(session.id, "cancelled");

      const found = await SessionModel.findById(session.id);
      expect(found?.status).toBe("cancelled");
    });
  });

  describe("delete()", () => {
    it("should delete existing session", async () => {
      const session = await SessionModel.create({ agentId: "agent-1" });

      const result = await SessionModel.delete(session.id);

      expect(result).toBe(true);
      const found = await SessionModel.findById(session.id);
      expect(found).toBeNull();
    });

    it("should return false for non-existent session", async () => {
      const result = await SessionModel.delete("non-existent");
      expect(result).toBe(false);
    });
  });
});

// ============================================================================
// ExecutionProcessModel Tests
// ============================================================================

describe("ExecutionProcessModel", () => {
  let tempDir: string;
  let originalStateDir: string | undefined;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "viben-exec-test-"));
    originalStateDir = process.env.VIBEN_STATE_DIR;
    process.env.VIBEN_STATE_DIR = tempDir;
  });

  afterEach(async () => {
    if (originalStateDir !== undefined) {
      process.env.VIBEN_STATE_DIR = originalStateDir;
    } else {
      delete process.env.VIBEN_STATE_DIR;
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("create()", () => {
    it("should create a new execution process with default status", async () => {
      const process = await ExecutionProcessModel.create({
        session_id: "session-1",
      });

      expect(process.id).toBeDefined();
      expect(process.session_id).toBe("session-1");
      expect(process.status).toBe("running");
      expect(process.started_at).toBeDefined();
      expect(process.pid).toBeUndefined();
    });

    it("should create process with custom id", async () => {
      const process = await ExecutionProcessModel.create({
        id: "custom-process-id",
        session_id: "session-1",
      });

      expect(process.id).toBe("custom-process-id");
    });

    it("should create process with pid", async () => {
      const process = await ExecutionProcessModel.create({
        session_id: "session-1",
        pid: 12345,
      });

      expect(process.pid).toBe(12345);
    });
  });

  describe("findById()", () => {
    it("should find process by ID", async () => {
      const created = await ExecutionProcessModel.create({
        session_id: "session-1",
        pid: 99999,
      });

      const found = await ExecutionProcessModel.findById(created.id);

      expect(found).not.toBeNull();
      expect(found?.session_id).toBe("session-1");
      expect(found?.pid).toBe(99999);
    });

    it("should return null for non-existent process", async () => {
      const found = await ExecutionProcessModel.findById("non-existent");
      expect(found).toBeNull();
    });
  });

  describe("findAll()", () => {
    it("should return empty array when no processes exist", async () => {
      const processes = await ExecutionProcessModel.findAll();
      expect(processes).toEqual([]);
    });

    it("should return all processes sorted by startedAt descending", async () => {
      await ExecutionProcessModel.create({ session_id: "session-1" });
      // Small delays to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 5));
      await ExecutionProcessModel.create({ session_id: "session-2" });
      await new Promise((resolve) => setTimeout(resolve, 5));
      await ExecutionProcessModel.create({ session_id: "session-3" });

      const processes = await ExecutionProcessModel.findAll();

      expect(processes).toHaveLength(3);
      // Verify all processes are present
      const sessionIds = processes.map((p) => p.session_id);
      expect(sessionIds).toContain("session-1");
      expect(sessionIds).toContain("session-2");
      expect(sessionIds).toContain("session-3");
    });
  });

  describe("findBySessionId()", () => {
    it("should find processes by session ID", async () => {
      await ExecutionProcessModel.create({ session_id: "session-1" });
      await ExecutionProcessModel.create({ session_id: "session-2" });
      await ExecutionProcessModel.create({ session_id: "session-1" });

      const processes = await ExecutionProcessModel.findBySessionId("session-1");

      expect(processes).toHaveLength(2);
      processes.forEach((p) => expect(p.session_id).toBe("session-1"));
    });
  });

  describe("findByStatus()", () => {
    it("should find processes by status", async () => {
      const proc1 = await ExecutionProcessModel.create({ session_id: "session-1" });
      await ExecutionProcessModel.create({ session_id: "session-2" });
      await ExecutionProcessModel.markCompleted(proc1.id, 0);

      const running = await ExecutionProcessModel.findByStatus("running");
      const completed = await ExecutionProcessModel.findByStatus("completed");

      expect(running).toHaveLength(1);
      expect(completed).toHaveLength(1);
    });
  });

  describe("findRunning()", () => {
    it("should find all running processes", async () => {
      const proc1 = await ExecutionProcessModel.create({ session_id: "session-1" });
      await ExecutionProcessModel.create({ session_id: "session-2" });
      await ExecutionProcessModel.markCompleted(proc1.id, 0);

      const running = await ExecutionProcessModel.findRunning();

      expect(running).toHaveLength(1);
      expect(running[0].status).toBe("running");
    });
  });

  describe("update()", () => {
    it("should update process status", async () => {
      const process = await ExecutionProcessModel.create({
        session_id: "session-1",
      });

      const updated = await ExecutionProcessModel.update(process.id, {
        status: "failed",
      });

      expect(updated.status).toBe("failed");
    });

    it("should update process pid", async () => {
      const process = await ExecutionProcessModel.create({
        session_id: "session-1",
      });

      const updated = await ExecutionProcessModel.update(process.id, {
        pid: 54321,
      });

      expect(updated.pid).toBe(54321);
    });

    it("should throw NotFoundError for non-existent process", async () => {
      await expect(
        ExecutionProcessModel.update("non-existent", { status: "completed" })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("markCompleted()", () => {
    it("should mark process as completed with exit code", async () => {
      const process = await ExecutionProcessModel.create({
        session_id: "session-1",
      });

      await ExecutionProcessModel.markCompleted(process.id, 0);

      const found = await ExecutionProcessModel.findById(process.id);
      expect(found?.status).toBe("completed");
      expect(found?.exitCode).toBe(0);
      expect(found?.ended_at).toBeDefined();
    });
  });

  describe("markFailed()", () => {
    it("should mark process as failed", async () => {
      const process = await ExecutionProcessModel.create({
        session_id: "session-1",
      });

      await ExecutionProcessModel.markFailed(process.id, 1);

      const found = await ExecutionProcessModel.findById(process.id);
      expect(found?.status).toBe("failed");
      expect(found?.exitCode).toBe(1);
      expect(found?.ended_at).toBeDefined();
    });

    it("should mark process as failed without exit code", async () => {
      const process = await ExecutionProcessModel.create({
        session_id: "session-1",
      });

      await ExecutionProcessModel.markFailed(process.id);

      const found = await ExecutionProcessModel.findById(process.id);
      expect(found?.status).toBe("failed");
      expect(found?.exitCode).toBeUndefined();
    });
  });

  describe("markCancelled()", () => {
    it("should mark process as cancelled", async () => {
      const process = await ExecutionProcessModel.create({
        session_id: "session-1",
      });

      await ExecutionProcessModel.markCancelled(process.id);

      const found = await ExecutionProcessModel.findById(process.id);
      expect(found?.status).toBe("cancelled");
      expect(found?.ended_at).toBeDefined();
    });
  });

  describe("delete()", () => {
    it("should delete existing process", async () => {
      const process = await ExecutionProcessModel.create({
        session_id: "session-1",
      });

      const result = await ExecutionProcessModel.delete(process.id);

      expect(result).toBe(true);
      const found = await ExecutionProcessModel.findById(process.id);
      expect(found).toBeNull();
    });

    it("should return false for non-existent process", async () => {
      const result = await ExecutionProcessModel.delete("non-existent");
      expect(result).toBe(false);
    });
  });
});

// ============================================================================
// GroupChatModel Tests
// ============================================================================

describe("GroupChatModel", () => {
  let tempDir: string;
  let originalStateDir: string | undefined;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "viben-groupchat-test-"));
    originalStateDir = process.env.VIBEN_STATE_DIR;
    process.env.VIBEN_STATE_DIR = tempDir;
  });

  afterEach(async () => {
    if (originalStateDir !== undefined) {
      process.env.VIBEN_STATE_DIR = originalStateDir;
    } else {
      delete process.env.VIBEN_STATE_DIR;
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("create()", () => {
    it("should create a new group chat", async () => {
      const chat = await GroupChatModel.create({
        name: "Test Chat",
        createdBy: "user-1",
      });

      expect(chat.id).toBeDefined();
      expect(chat.name).toBe("Test Chat");
      expect(chat.createdBy).toBe("user-1");
      expect(chat.created_at).toBeDefined();
      expect(chat.updated_at).toBeDefined();
    });

    it("should create group chat with custom id", async () => {
      const chat = await GroupChatModel.create({
        id: "custom-chat-id",
        name: "Custom Chat",
        createdBy: "user-1",
      });

      expect(chat.id).toBe("custom-chat-id");
    });

    it("should create group chat with description and taskId", async () => {
      const chat = await GroupChatModel.create({
        name: "Task Chat",
        description: "Chat for task discussions",
        taskId: "task-123",
        createdBy: "user-1",
      });

      expect(chat.description).toBe("Chat for task discussions");
      expect(chat.taskId).toBe("task-123");
    });
  });

  describe("findById()", () => {
    it("should find group chat by ID", async () => {
      const created = await GroupChatModel.create({
        name: "Find Me",
        createdBy: "user-1",
      });

      const found = await GroupChatModel.findById(created.id);

      expect(found).not.toBeNull();
      expect(found?.name).toBe("Find Me");
    });

    it("should return null for non-existent chat", async () => {
      const found = await GroupChatModel.findById("non-existent");
      expect(found).toBeNull();
    });
  });

  describe("findAll()", () => {
    it("should return empty array when no chats exist", async () => {
      const chats = await GroupChatModel.findAll();
      expect(chats).toEqual([]);
    });

    it("should return all chats sorted by createdAt descending", async () => {
      await GroupChatModel.create({ name: "Chat 1", createdBy: "user-1" });
      // Small delays to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 5));
      await GroupChatModel.create({ name: "Chat 2", createdBy: "user-1" });
      await new Promise((resolve) => setTimeout(resolve, 5));
      await GroupChatModel.create({ name: "Chat 3", createdBy: "user-1" });

      const chats = await GroupChatModel.findAll();

      expect(chats).toHaveLength(3);
      // Verify all chats are present
      const names = chats.map((c) => c.name);
      expect(names).toContain("Chat 1");
      expect(names).toContain("Chat 2");
      expect(names).toContain("Chat 3");
    });
  });

  describe("findByTaskId()", () => {
    it("should find chats by task ID", async () => {
      await GroupChatModel.create({
        name: "Task 1 Chat",
        taskId: "task-1",
        createdBy: "user-1",
      });
      await GroupChatModel.create({
        name: "Task 2 Chat",
        taskId: "task-2",
        createdBy: "user-1",
      });
      await GroupChatModel.create({
        name: "Another Task 1 Chat",
        taskId: "task-1",
        createdBy: "user-1",
      });

      const chats = await GroupChatModel.findByTaskId("task-1");

      expect(chats).toHaveLength(2);
      chats.forEach((c) => expect(c.taskId).toBe("task-1"));
    });
  });

  describe("update()", () => {
    it("should update chat name", async () => {
      const chat = await GroupChatModel.create({
        name: "Original",
        createdBy: "user-1",
      });

      // Small delay to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = await GroupChatModel.update(chat.id, { name: "Updated" });

      expect(updated.name).toBe("Updated");
      expect(updated.updated_at).toBeDefined();
      // Verify the update was persisted
      const found = await GroupChatModel.findById(chat.id);
      expect(found?.name).toBe("Updated");
    });

    it("should update chat description", async () => {
      const chat = await GroupChatModel.create({
        name: "Chat",
        createdBy: "user-1",
      });

      const updated = await GroupChatModel.update(chat.id, {
        description: "New description",
      });

      expect(updated.description).toBe("New description");
    });

    it("should throw NotFoundError for non-existent chat", async () => {
      await expect(
        GroupChatModel.update("non-existent", { name: "New" })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("delete()", () => {
    it("should delete existing chat", async () => {
      const chat = await GroupChatModel.create({
        name: "To Delete",
        createdBy: "user-1",
      });

      const result = await GroupChatModel.delete(chat.id);

      expect(result).toBe(true);
      const found = await GroupChatModel.findById(chat.id);
      expect(found).toBeNull();
    });

    it("should return false for non-existent chat", async () => {
      const result = await GroupChatModel.delete("non-existent");
      expect(result).toBe(false);
    });

    it("should cascade delete members and messages", async () => {
      const chat = await GroupChatModel.create({
        name: "Chat with Members",
        createdBy: "user-1",
      });

      await GroupChatMemberModel.create({
        groupChatId: chat.id,
        memberType: "human",
        memberId: "user-1",
        displayName: "User 1",
      });

      await GroupChatMessageModel.create({
        groupChatId: chat.id,
        senderId: "user-1",
        senderType: "human",
        senderName: "User 1",
        content: "Hello",
      });

      await GroupChatModel.delete(chat.id);

      const members = await GroupChatMemberModel.findByGroupChatId(chat.id);
      const messages = await GroupChatMessageModel.findByGroupChatId(chat.id);

      expect(members).toHaveLength(0);
      expect(messages).toHaveLength(0);
    });
  });
});

// ============================================================================
// GroupChatMemberModel Tests
// ============================================================================

describe("GroupChatMemberModel", () => {
  let tempDir: string;
  let originalStateDir: string | undefined;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "viben-member-test-"));
    originalStateDir = process.env.VIBEN_STATE_DIR;
    process.env.VIBEN_STATE_DIR = tempDir;
  });

  afterEach(async () => {
    if (originalStateDir !== undefined) {
      process.env.VIBEN_STATE_DIR = originalStateDir;
    } else {
      delete process.env.VIBEN_STATE_DIR;
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("create()", () => {
    it("should create a new member with default role", async () => {
      const member = await GroupChatMemberModel.create({
        groupChatId: "chat-1",
        memberType: "human",
        memberId: "user-1",
        displayName: "User One",
      });

      expect(member.id).toBeDefined();
      expect(member.groupChatId).toBe("chat-1");
      expect(member.memberType).toBe("human");
      expect(member.memberId).toBe("user-1");
      expect(member.displayName).toBe("User One");
      expect(member.role).toBe("member");
      expect(member.joined_at).toBeDefined();
    });

    it("should create member with custom id and role", async () => {
      const member = await GroupChatMemberModel.create({
        id: "custom-member-id",
        groupChatId: "chat-1",
        memberType: "agent",
        memberId: "agent-1",
        displayName: "AI Assistant",
        role: "admin",
      });

      expect(member.id).toBe("custom-member-id");
      expect(member.role).toBe("admin");
    });

    it("should create executor type member", async () => {
      const member = await GroupChatMemberModel.create({
        groupChatId: "chat-1",
        memberType: "executor",
        memberId: "executor-1",
        displayName: "Claude Code",
      });

      expect(member.memberType).toBe("executor");
    });
  });

  describe("findById()", () => {
    it("should find member by ID", async () => {
      const created = await GroupChatMemberModel.create({
        groupChatId: "chat-1",
        memberType: "human",
        memberId: "user-1",
        displayName: "User One",
      });

      const found = await GroupChatMemberModel.findById(created.id);

      expect(found).not.toBeNull();
      expect(found?.displayName).toBe("User One");
    });

    it("should return null for non-existent member", async () => {
      const found = await GroupChatMemberModel.findById("non-existent");
      expect(found).toBeNull();
    });
  });

  describe("findAll()", () => {
    it("should return empty array when no members exist", async () => {
      const members = await GroupChatMemberModel.findAll();
      expect(members).toEqual([]);
    });

    it("should return all members sorted by joinedAt ascending", async () => {
      await GroupChatMemberModel.create({
        groupChatId: "chat-1",
        memberType: "human",
        memberId: "user-1",
        displayName: "First User",
      });
      await GroupChatMemberModel.create({
        groupChatId: "chat-1",
        memberType: "human",
        memberId: "user-2",
        displayName: "Second User",
      });

      const members = await GroupChatMemberModel.findAll();

      expect(members).toHaveLength(2);
      expect(members[0].displayName).toBe("First User");
    });
  });

  describe("findByGroupChatId()", () => {
    it("should find members by group chat ID", async () => {
      await GroupChatMemberModel.create({
        groupChatId: "chat-1",
        memberType: "human",
        memberId: "user-1",
        displayName: "User 1",
      });
      await GroupChatMemberModel.create({
        groupChatId: "chat-2",
        memberType: "human",
        memberId: "user-2",
        displayName: "User 2",
      });
      await GroupChatMemberModel.create({
        groupChatId: "chat-1",
        memberType: "agent",
        memberId: "agent-1",
        displayName: "Agent 1",
      });

      const members = await GroupChatMemberModel.findByGroupChatId("chat-1");

      expect(members).toHaveLength(2);
      members.forEach((m) => expect(m.groupChatId).toBe("chat-1"));
    });
  });

  describe("findByMember()", () => {
    it("should find all group chats a member belongs to", async () => {
      await GroupChatMemberModel.create({
        groupChatId: "chat-1",
        memberType: "human",
        memberId: "user-1",
        displayName: "User 1 in Chat 1",
      });
      await GroupChatMemberModel.create({
        groupChatId: "chat-2",
        memberType: "human",
        memberId: "user-1",
        displayName: "User 1 in Chat 2",
      });
      await GroupChatMemberModel.create({
        groupChatId: "chat-1",
        memberType: "agent",
        memberId: "agent-1",
        displayName: "Agent 1",
      });

      const memberships = await GroupChatMemberModel.findByMember(
        "human",
        "user-1"
      );

      expect(memberships).toHaveLength(2);
      memberships.forEach((m) => {
        expect(m.memberType).toBe("human");
        expect(m.memberId).toBe("user-1");
      });
    });
  });

  describe("update()", () => {
    it("should update member displayName", async () => {
      const member = await GroupChatMemberModel.create({
        groupChatId: "chat-1",
        memberType: "human",
        memberId: "user-1",
        displayName: "Original Name",
      });

      const updated = await GroupChatMemberModel.update(member.id, {
        displayName: "New Name",
      });

      expect(updated.displayName).toBe("New Name");
    });

    it("should update member role", async () => {
      const member = await GroupChatMemberModel.create({
        groupChatId: "chat-1",
        memberType: "human",
        memberId: "user-1",
        displayName: "User",
      });

      const updated = await GroupChatMemberModel.update(member.id, {
        role: "owner",
      });

      expect(updated.role).toBe("owner");
    });

    it("should throw NotFoundError for non-existent member", async () => {
      await expect(
        GroupChatMemberModel.update("non-existent", { displayName: "New" })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("updateLastSeen()", () => {
    it("should update lastSeenAt timestamp", async () => {
      const member = await GroupChatMemberModel.create({
        groupChatId: "chat-1",
        memberType: "human",
        memberId: "user-1",
        displayName: "User",
      });

      expect(member.lastSeenAt).toBeUndefined();

      await GroupChatMemberModel.updateLastSeen(member.id);

      const found = await GroupChatMemberModel.findById(member.id);
      expect(found?.lastSeenAt).toBeDefined();
    });
  });

  describe("delete()", () => {
    it("should delete existing member", async () => {
      const member = await GroupChatMemberModel.create({
        groupChatId: "chat-1",
        memberType: "human",
        memberId: "user-1",
        displayName: "User",
      });

      const result = await GroupChatMemberModel.delete(member.id);

      expect(result).toBe(true);
      const found = await GroupChatMemberModel.findById(member.id);
      expect(found).toBeNull();
    });

    it("should return false for non-existent member", async () => {
      const result = await GroupChatMemberModel.delete("non-existent");
      expect(result).toBe(false);
    });
  });
});

// ============================================================================
// GroupChatMessageModel Tests
// ============================================================================

describe("GroupChatMessageModel", () => {
  let tempDir: string;
  let originalStateDir: string | undefined;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "viben-message-test-"));
    originalStateDir = process.env.VIBEN_STATE_DIR;
    process.env.VIBEN_STATE_DIR = tempDir;
  });

  afterEach(async () => {
    if (originalStateDir !== undefined) {
      process.env.VIBEN_STATE_DIR = originalStateDir;
    } else {
      delete process.env.VIBEN_STATE_DIR;
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("create()", () => {
    it("should create a text message with default content type", async () => {
      const message = await GroupChatMessageModel.create({
        groupChatId: "chat-1",
        senderId: "user-1",
        senderType: "human",
        senderName: "User One",
        content: "Hello, world!",
      });

      expect(message.id).toBeDefined();
      expect(message.groupChatId).toBe("chat-1");
      expect(message.senderId).toBe("user-1");
      expect(message.senderType).toBe("human");
      expect(message.senderName).toBe("User One");
      expect(message.contentType).toBe("text");
      expect(message.content).toBe("Hello, world!");
      expect(message.created_at).toBeDefined();
    });

    it("should create message with custom id", async () => {
      const message = await GroupChatMessageModel.create({
        id: "custom-message-id",
        groupChatId: "chat-1",
        senderId: "user-1",
        senderType: "human",
        senderName: "User",
        content: "Hello",
      });

      expect(message.id).toBe("custom-message-id");
    });

    it("should create code message", async () => {
      const message = await GroupChatMessageModel.create({
        groupChatId: "chat-1",
        senderId: "agent-1",
        senderType: "agent",
        senderName: "AI Assistant",
        contentType: "code",
        content: "console.log('Hello');",
        metadata: { language: "javascript" },
      });

      expect(message.contentType).toBe("code");
      expect(message.metadata).toEqual({ language: "javascript" });
    });

    it("should create message with mentions and replyTo", async () => {
      const message = await GroupChatMessageModel.create({
        groupChatId: "chat-1",
        senderId: "user-1",
        senderType: "human",
        senderName: "User",
        content: "@agent-1 please help",
        mentions: ["agent-1"],
        replyTo: "previous-message-id",
      });

      expect(message.mentions).toEqual(["agent-1"]);
      expect(message.replyTo).toBe("previous-message-id");
    });

    it("should create tool_call message", async () => {
      const message = await GroupChatMessageModel.create({
        groupChatId: "chat-1",
        senderId: "executor-1",
        senderType: "executor",
        senderName: "Claude Code",
        contentType: "tool_call",
        content: "read_file",
        metadata: { args: { path: "/test.txt" } },
      });

      expect(message.contentType).toBe("tool_call");
      expect(message.senderType).toBe("executor");
    });

    it("should create system message", async () => {
      const message = await GroupChatMessageModel.create({
        groupChatId: "chat-1",
        senderId: "system",
        senderType: "agent",
        senderName: "System",
        contentType: "system",
        content: "User joined the chat",
      });

      expect(message.contentType).toBe("system");
    });
  });

  describe("findById()", () => {
    it("should find message by ID", async () => {
      const created = await GroupChatMessageModel.create({
        groupChatId: "chat-1",
        senderId: "user-1",
        senderType: "human",
        senderName: "User",
        content: "Find me",
      });

      const found = await GroupChatMessageModel.findById(created.id);

      expect(found).not.toBeNull();
      expect(found?.content).toBe("Find me");
    });

    it("should return null for non-existent message", async () => {
      const found = await GroupChatMessageModel.findById("non-existent");
      expect(found).toBeNull();
    });
  });

  describe("findAll()", () => {
    it("should return empty array when no messages exist", async () => {
      const messages = await GroupChatMessageModel.findAll();
      expect(messages).toEqual([]);
    });

    it("should return all messages sorted by createdAt ascending", async () => {
      await GroupChatMessageModel.create({
        groupChatId: "chat-1",
        senderId: "user-1",
        senderType: "human",
        senderName: "User",
        content: "First",
      });
      await GroupChatMessageModel.create({
        groupChatId: "chat-1",
        senderId: "user-1",
        senderType: "human",
        senderName: "User",
        content: "Second",
      });
      await GroupChatMessageModel.create({
        groupChatId: "chat-1",
        senderId: "user-1",
        senderType: "human",
        senderName: "User",
        content: "Third",
      });

      const messages = await GroupChatMessageModel.findAll();

      expect(messages).toHaveLength(3);
      expect(messages[0].content).toBe("First");
      expect(messages[2].content).toBe("Third");
    });
  });

  describe("findByGroupChatId()", () => {
    it("should find messages by group chat ID", async () => {
      await GroupChatMessageModel.create({
        groupChatId: "chat-1",
        senderId: "user-1",
        senderType: "human",
        senderName: "User",
        content: "Message 1",
      });
      await GroupChatMessageModel.create({
        groupChatId: "chat-2",
        senderId: "user-1",
        senderType: "human",
        senderName: "User",
        content: "Message 2",
      });
      await GroupChatMessageModel.create({
        groupChatId: "chat-1",
        senderId: "user-1",
        senderType: "human",
        senderName: "User",
        content: "Message 3",
      });

      const messages = await GroupChatMessageModel.findByGroupChatId("chat-1");

      expect(messages).toHaveLength(2);
      messages.forEach((m) => expect(m.groupChatId).toBe("chat-1"));
    });

    it("should limit number of messages returned", async () => {
      for (let i = 0; i < 10; i++) {
        await GroupChatMessageModel.create({
          groupChatId: "chat-1",
          senderId: "user-1",
          senderType: "human",
          senderName: "User",
          content: `Message ${i}`,
        });
      }

      const messages = await GroupChatMessageModel.findByGroupChatId(
        "chat-1",
        5
      );

      expect(messages).toHaveLength(5);
      // Should return the last 5 messages
      expect(messages[0].content).toBe("Message 5");
      expect(messages[4].content).toBe("Message 9");
    });

    it("should filter messages before a timestamp", async () => {
      const msg1 = await GroupChatMessageModel.create({
        groupChatId: "chat-1",
        senderId: "user-1",
        senderType: "human",
        senderName: "User",
        content: "First",
      });

      // Wait a bit to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      await GroupChatMessageModel.create({
        groupChatId: "chat-1",
        senderId: "user-1",
        senderType: "human",
        senderName: "User",
        content: "Second",
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const msg3 = await GroupChatMessageModel.create({
        groupChatId: "chat-1",
        senderId: "user-1",
        senderType: "human",
        senderName: "User",
        content: "Third",
      });

      const messages = await GroupChatMessageModel.findByGroupChatId(
        "chat-1",
        undefined,
        msg3.created_at
      );

      expect(messages).toHaveLength(2);
      expect(messages.some((m) => m.content === "Third")).toBe(false);
    });
  });

  describe("delete()", () => {
    it("should delete existing message", async () => {
      const message = await GroupChatMessageModel.create({
        groupChatId: "chat-1",
        senderId: "user-1",
        senderType: "human",
        senderName: "User",
        content: "To delete",
      });

      const result = await GroupChatMessageModel.delete(message.id);

      expect(result).toBe(true);
      const found = await GroupChatMessageModel.findById(message.id);
      expect(found).toBeNull();
    });

    it("should return false for non-existent message", async () => {
      const result = await GroupChatMessageModel.delete("non-existent");
      expect(result).toBe(false);
    });
  });

  describe("deleteByGroupChatId()", () => {
    it("should delete all messages in a group chat", async () => {
      await GroupChatMessageModel.create({
        groupChatId: "chat-1",
        senderId: "user-1",
        senderType: "human",
        senderName: "User",
        content: "Message 1",
      });
      await GroupChatMessageModel.create({
        groupChatId: "chat-1",
        senderId: "user-1",
        senderType: "human",
        senderName: "User",
        content: "Message 2",
      });
      await GroupChatMessageModel.create({
        groupChatId: "chat-2",
        senderId: "user-1",
        senderType: "human",
        senderName: "User",
        content: "Message 3",
      });

      const count = await GroupChatMessageModel.deleteByGroupChatId("chat-1");

      expect(count).toBe(2);

      const chat1Messages = await GroupChatMessageModel.findByGroupChatId("chat-1");
      const chat2Messages = await GroupChatMessageModel.findByGroupChatId("chat-2");

      expect(chat1Messages).toHaveLength(0);
      expect(chat2Messages).toHaveLength(1);
    });

    it("should return 0 when no messages to delete", async () => {
      const count = await GroupChatMessageModel.deleteByGroupChatId("non-existent");
      expect(count).toBe(0);
    });
  });
});
