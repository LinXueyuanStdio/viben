/**
 * Task Lifecycle Operations Tests
 *
 * Tests for status transitions using REAL file system operations:
 * - enqueueTask: backlog -> queue
 * - dequeueTask: queue -> backlog
 * - pauseTask: in_progress/queue -> paused
 * - resumeTask: paused -> in_progress/queue (restore)
 * - approveTask: review -> completed
 * - rejectTask: review -> backlog
 * - retryTask: failed -> queue
 * - cancelTask: * -> cancelled
 *
 * Only external commands (gh, git) are mocked. File operations are real.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  enqueueTask,
  dequeueTask,
  pauseTask,
  resumeTask,
  approveTask,
  rejectTask,
  retryTask,
  cancelTask,
} from "./lifecycle";
import {
  createWorkspaceTempDir,
  createTaskDir,
  type TempDirContext,
} from "../../test/helpers/temp-dir";

// Mock child_process.execSync for gh pr commands
vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

// Mock queue enqueue to avoid writing to global queue directory
vi.mock("../../queue/ops/enqueue", () => ({
  enqueue: vi.fn().mockReturnValue({ success: true, id: "q_mock123", position: 1 }),
}));

import { execSync } from "node:child_process";
import { enqueue as queueEnqueue } from "../../queue/ops/enqueue";

describe("lifecycle operations", () => {
  let tempDir: TempDirContext & { vibenDir: string; tasksDir: string };

  beforeEach(async () => {
    tempDir = await createWorkspaceTempDir();
    vi.clearAllMocks();
    // Reset queue mock to default success
    vi.mocked(queueEnqueue).mockReturnValue({ success: true, id: "q_mock123", position: 1 });
  });

  afterEach(async () => {
    await tempDir.cleanup();
  });

  describe("enqueueTask", () => {
    it("should change status from backlog to queue", async () => {
      await createTaskDir(tempDir, "test-task", { status: "backlog" });

      const result = enqueueTask(tempDir.root, "test-task", { skipQueue: true });

      expect(result.success).toBe(true);
      expect(result.status).toBe("queue");
      expect(result.fromStatus).toBe("backlog");

      // Verify actual file was updated
      const taskJson = await tempDir.readJson<{ status: string; queuedAt?: string }>(
        ".viben/tasks/test-task/task.json"
      );
      expect(taskJson.status).toBe("queue");
      expect(taskJson.queuedAt).toBeDefined();
    });

    it("should append QUEUE event to events.jsonl", async () => {
      await createTaskDir(tempDir, "test-task", { status: "backlog" });

      enqueueTask(tempDir.root, "test-task", { skipQueue: true });

      // Verify event was logged
      const eventsContent = await tempDir.readFile(".viben/tasks/test-task/events.jsonl");
      const events = eventsContent
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));

      const queueEvent = events.find((e) => e.type === "QUEUE");
      expect(queueEvent).toBeDefined();
      expect(queueEvent.eventId).toBeDefined();
      expect(queueEvent.timestamp).toBeDefined();
    });

    it("should submit command to queue system when skipQueue is false", async () => {
      await createTaskDir(tempDir, "test-task", { status: "backlog" });

      const result = enqueueTask(tempDir.root, "test-task");

      expect(result.success).toBe(true);
      expect(vi.mocked(queueEnqueue)).toHaveBeenCalledWith(
        expect.objectContaining({
          command: expect.stringContaining("viben task start"),
          cwd: tempDir.root,
        })
      );
    });

    it("should fail when queue submission fails", async () => {
      await createTaskDir(tempDir, "test-task", { status: "backlog" });
      vi.mocked(queueEnqueue).mockReturnValue({ success: false, error: "Queue full" });

      const result = enqueueTask(tempDir.root, "test-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to submit to queue");
    });

    it("should set additional fields when options provided", async () => {
      await createTaskDir(tempDir, "test-task", { status: "backlog" });

      const result = enqueueTask(tempDir.root, "test-task", {
        agent: "claude-agent",
        executor: "CLAUDE_CODE",
        model: "claude-3-opus",
        priority: "urgent",
        skipQueue: true,
      });

      expect(result.success).toBe(true);

      const taskJson = await tempDir.readJson<Record<string, unknown>>(
        ".viben/tasks/test-task/task.json"
      );
      expect(taskJson.agent).toBe("claude-agent");
      expect(taskJson.executor).toBe("CLAUDE_CODE");
      expect(taskJson.model).toBe("claude-3-opus");
      expect(taskJson.priority).toBe("urgent");
    });

    it("should reject invalid status transition from in_progress", async () => {
      await createTaskDir(tempDir, "test-task", { status: "in_progress" });

      const result = enqueueTask(tempDir.root, "test-task", { skipQueue: true });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot queue task");
      expect(result.error).toContain("in_progress");
    });

    it("should reject invalid status transition from completed", async () => {
      await createTaskDir(tempDir, "test-task", { status: "completed" });

      const result = enqueueTask(tempDir.root, "test-task", { skipQueue: true });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot queue task");
    });

    it("should fail when task not found", () => {
      const result = enqueueTask(tempDir.root, "nonexistent-task", { skipQueue: true });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Task not found");
    });
  });

  describe("dequeueTask", () => {
    it("should change status from queue to backlog", async () => {
      await createTaskDir(tempDir, "test-task", {
        status: "queue",
        queuedAt: new Date().toISOString(),
      });

      const result = dequeueTask(tempDir.root, "test-task");

      expect(result.success).toBe(true);
      expect(result.status).toBe("backlog");
      expect(result.fromStatus).toBe("queue");

      // Verify actual file was updated
      const taskJson = await tempDir.readJson<{ status: string; queuedAt?: string }>(
        ".viben/tasks/test-task/task.json"
      );
      expect(taskJson.status).toBe("backlog");
      expect(taskJson.queuedAt).toBeUndefined(); // Should be cleared
    });

    it("should append DEQUEUE event to events.jsonl", async () => {
      await createTaskDir(tempDir, "test-task", { status: "queue" });

      dequeueTask(tempDir.root, "test-task");

      const eventsContent = await tempDir.readFile(".viben/tasks/test-task/events.jsonl");
      const events = eventsContent
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));

      const dequeueEvent = events.find((e) => e.type === "DEQUEUE");
      expect(dequeueEvent).toBeDefined();
    });

    it("should reject invalid status transition from backlog", async () => {
      await createTaskDir(tempDir, "test-task", { status: "backlog" });

      const result = dequeueTask(tempDir.root, "test-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot dequeue task");
      expect(result.error).toContain("backlog");
    });

    it("should fail when task not found", () => {
      const result = dequeueTask(tempDir.root, "nonexistent-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Task not found");
    });
  });

  describe("pauseTask", () => {
    it("should change status from in_progress to paused", async () => {
      await createTaskDir(tempDir, "test-task", {
        status: "in_progress",
        current_phase: 2,
      });

      const result = pauseTask(tempDir.root, "test-task");

      expect(result.success).toBe(true);
      expect(result.status).toBe("paused");
      expect(result.fromStatus).toBe("in_progress");

      const taskJson = await tempDir.readJson<{
        status: string;
        pausedSnapshot?: { fromState: string; subtaskIndex: number; pausedAt: string };
      }>(".viben/tasks/test-task/task.json");
      expect(taskJson.status).toBe("paused");
      expect(taskJson.pausedSnapshot).toBeDefined();
      expect(taskJson.pausedSnapshot?.fromState).toBe("in_progress");
      expect(taskJson.pausedSnapshot?.subtaskIndex).toBe(2);
    });

    it("should change status from queue to paused", async () => {
      await createTaskDir(tempDir, "test-task", { status: "queue" });

      const result = pauseTask(tempDir.root, "test-task");

      expect(result.success).toBe(true);
      expect(result.status).toBe("paused");
      expect(result.fromStatus).toBe("queue");
    });

    it("should append PAUSE event to events.jsonl", async () => {
      await createTaskDir(tempDir, "test-task", { status: "in_progress" });

      pauseTask(tempDir.root, "test-task");

      const eventsContent = await tempDir.readFile(".viben/tasks/test-task/events.jsonl");
      const events = eventsContent
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));

      const pauseEvent = events.find((e) => e.type === "PAUSE");
      expect(pauseEvent).toBeDefined();
      expect(pauseEvent.payload?.fromState).toBe("in_progress");
    });

    it("should reject pausing from terminal state (completed)", async () => {
      await createTaskDir(tempDir, "test-task", { status: "completed" });

      const result = pauseTask(tempDir.root, "test-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot pause task");
    });

    it("should fail when task not found", () => {
      const result = pauseTask(tempDir.root, "nonexistent-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Task not found");
    });
  });

  describe("resumeTask", () => {
    it("should restore previous state from pausedSnapshot", async () => {
      await createTaskDir(tempDir, "test-task", {
        status: "paused",
        pausedSnapshot: {
          fromState: "in_progress",
          subtaskIndex: 2,
          pausedAt: "2024-03-15T10:00:00Z",
        },
      });

      const result = resumeTask(tempDir.root, "test-task");

      expect(result.success).toBe(true);
      expect(result.status).toBe("in_progress");
      expect(result.fromStatus).toBe("paused");

      const taskJson = await tempDir.readJson<{
        status: string;
        pausedSnapshot?: unknown;
      }>(".viben/tasks/test-task/task.json");
      expect(taskJson.status).toBe("in_progress");
      expect(taskJson.pausedSnapshot).toBeUndefined(); // Should be cleared
    });

    it("should resume to queue when no pausedSnapshot (default)", async () => {
      await createTaskDir(tempDir, "test-task", { status: "paused" });

      const result = resumeTask(tempDir.root, "test-task");

      expect(result.success).toBe(true);
      expect(result.status).toBe("queue");
    });

    it("should append RESUME event to events.jsonl", async () => {
      await createTaskDir(tempDir, "test-task", {
        status: "paused",
        pausedSnapshot: { fromState: "in_progress", subtaskIndex: 1, pausedAt: "2024-03-15T10:00:00Z" },
      });

      resumeTask(tempDir.root, "test-task");

      const eventsContent = await tempDir.readFile(".viben/tasks/test-task/events.jsonl");
      const events = eventsContent
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));

      const resumeEvent = events.find((e) => e.type === "RESUME");
      expect(resumeEvent).toBeDefined();
      expect(resumeEvent.payload?.toState).toBe("in_progress");
    });

    it("should reject resuming non-paused task", async () => {
      await createTaskDir(tempDir, "test-task", { status: "queue" });

      const result = resumeTask(tempDir.root, "test-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot resume task");
    });

    it("should fail when task not found", () => {
      const result = resumeTask(tempDir.root, "nonexistent-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Task not found");
    });
  });

  describe("approveTask", () => {
    it("should change status from review to completed", async () => {
      await createTaskDir(tempDir, "test-task", { status: "review" });

      const result = approveTask(tempDir.root, "test-task", { skipMerge: true });

      expect(result.success).toBe(true);
      expect(result.status).toBe("completed");
      expect(result.fromStatus).toBe("review");

      const taskJson = await tempDir.readJson<{
        status: string;
        completedAt?: string;
        reviewReason?: string;
      }>(".viben/tasks/test-task/task.json");
      expect(taskJson.status).toBe("completed");
      expect(taskJson.completedAt).toBeDefined();
      expect(taskJson.reviewReason).toBe("approved");
    });

    it("should append APPROVED event to events.jsonl", async () => {
      await createTaskDir(tempDir, "test-task", { status: "review" });

      approveTask(tempDir.root, "test-task", { skipMerge: true });

      const eventsContent = await tempDir.readFile(".viben/tasks/test-task/events.jsonl");
      const events = eventsContent
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));

      const approvedEvent = events.find((e) => e.type === "APPROVED");
      expect(approvedEvent).toBeDefined();
    });

    it("should merge PR when pr_url exists and skipMerge is false", async () => {
      await createTaskDir(tempDir, "test-task", {
        status: "review",
        pr_url: "https://github.com/org/repo/pull/123",
      });

      // Mock gh pr view - first call checks status
      vi.mocked(execSync).mockImplementation((cmd: string) => {
        if (cmd.includes("gh pr view") && cmd.includes("state,mergeable")) {
          return JSON.stringify({ state: "OPEN", mergeable: "MERGEABLE" });
        }
        if (cmd.includes("gh pr merge")) {
          return "Merged";
        }
        if (cmd.includes("gh pr view") && cmd.includes("mergeCommit")) {
          return JSON.stringify({ mergeCommit: { oid: "abc123" } });
        }
        return "";
      });

      const result = approveTask(tempDir.root, "test-task");

      expect(result.success).toBe(true);
      expect(vi.mocked(execSync)).toHaveBeenCalledWith(
        expect.stringContaining("gh pr merge"),
        expect.any(Object)
      );

      const taskJson = await tempDir.readJson<{
        status: string;
        merge_commit?: string;
        merged_at?: string;
      }>(".viben/tasks/test-task/task.json");
      expect(taskJson.status).toBe("completed");
      expect(taskJson.merge_commit).toBe("abc123");
      expect(taskJson.merged_at).toBeDefined();
    });

    it("should fail when PR merge fails", async () => {
      await createTaskDir(tempDir, "test-task", {
        status: "review",
        pr_url: "https://github.com/org/repo/pull/123",
      });

      vi.mocked(execSync).mockImplementation((cmd: string) => {
        if (cmd.includes("gh pr view") && cmd.includes("state,mergeable")) {
          return JSON.stringify({ state: "OPEN", mergeable: "CONFLICTING" });
        }
        return "";
      });

      const result = approveTask(tempDir.root, "test-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("merge conflicts");
    });

    it("should reject approval from in_progress even when pr_url exists", async () => {
      await createTaskDir(tempDir, "test-task", {
        status: "in_progress",
        pr_url: "https://github.com/org/repo/pull/123",
      });

      const result = approveTask(tempDir.root, "test-task", { skipMerge: true });

      // in_progress -> completed is NOT allowed, even with pr_url
      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot approved task");
    });

    it("should fail when task not found", () => {
      const result = approveTask(tempDir.root, "nonexistent-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Task not found");
    });
  });

  describe("rejectTask", () => {
    it("should change status from review to backlog", async () => {
      await createTaskDir(tempDir, "test-task", {
        status: "review",
        pr_url: "https://github.com/org/repo/pull/123",
      });

      const result = rejectTask(tempDir.root, "test-task");

      expect(result.success).toBe(true);
      expect(result.status).toBe("backlog");
      expect(result.fromStatus).toBe("review");

      const taskJson = await tempDir.readJson<{
        status: string;
        pr_url?: string;
        reviewReason?: string;
      }>(".viben/tasks/test-task/task.json");
      expect(taskJson.status).toBe("backlog");
      expect(taskJson.pr_url).toBeUndefined(); // Should be cleared
      expect(taskJson.reviewReason).toBe("rejected");
    });

    it("should record rejection reason when provided", async () => {
      await createTaskDir(tempDir, "test-task", { status: "review" });

      const result = rejectTask(tempDir.root, "test-task", "Code quality issues");

      expect(result.success).toBe(true);

      const taskJson = await tempDir.readJson<{
        rejectReason?: string;
      }>(".viben/tasks/test-task/task.json");
      expect(taskJson.rejectReason).toBe("Code quality issues");
    });

    it("should append REJECTED event with reason", async () => {
      await createTaskDir(tempDir, "test-task", { status: "review" });

      rejectTask(tempDir.root, "test-task", "Code quality issues");

      const eventsContent = await tempDir.readFile(".viben/tasks/test-task/events.jsonl");
      const events = eventsContent
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));

      const rejectedEvent = events.find((e) => e.type === "REJECTED");
      expect(rejectedEvent).toBeDefined();
      expect(rejectedEvent.payload?.reason).toBe("Code quality issues");
    });

    it("should allow reject from in_progress when pr_url exists", async () => {
      await createTaskDir(tempDir, "test-task", {
        status: "in_progress",
        pr_url: "https://github.com/org/repo/pull/123",
      });

      const result = rejectTask(tempDir.root, "test-task");

      // This is a special case - allowed for recovery from inconsistent state
      expect(result.success).toBe(true);
      expect(result.status).toBe("backlog");
      expect(result.fromStatus).toBe("in_progress");
    });

    it("should reject from queue state without pr_url", async () => {
      await createTaskDir(tempDir, "test-task", { status: "queue" });

      const result = rejectTask(tempDir.root, "test-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot rejected task");
    });

    it("should fail when task not found", () => {
      const result = rejectTask(tempDir.root, "nonexistent-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Task not found");
    });
  });

  describe("retryTask", () => {
    it("should change status from failed to queue", async () => {
      await createTaskDir(tempDir, "test-task", {
        status: "failed",
        error: "Build failed",
        errorMessage: "npm install failed",
        failedAt: "2024-03-14T10:00:00Z",
      });

      const result = retryTask(tempDir.root, "test-task");

      expect(result.success).toBe(true);
      expect(result.status).toBe("queue");
      expect(result.fromStatus).toBe("failed");

      const taskJson = await tempDir.readJson<{
        status: string;
        queuedAt?: string;
        error?: string;
        errorMessage?: string;
        failedAt?: string;
      }>(".viben/tasks/test-task/task.json");
      expect(taskJson.status).toBe("queue");
      expect(taskJson.queuedAt).toBeDefined();
      expect(taskJson.error).toBeUndefined(); // Should be cleared
      expect(taskJson.errorMessage).toBeUndefined(); // Should be cleared
      expect(taskJson.failedAt).toBeUndefined(); // Should be cleared
    });

    it("should append RETRY event to events.jsonl", async () => {
      await createTaskDir(tempDir, "test-task", { status: "failed" });

      retryTask(tempDir.root, "test-task");

      const eventsContent = await tempDir.readFile(".viben/tasks/test-task/events.jsonl");
      const events = eventsContent
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));

      const retryEvent = events.find((e) => e.type === "RETRY");
      expect(retryEvent).toBeDefined();
    });

    it("should reject retry from non-failed state", async () => {
      await createTaskDir(tempDir, "test-task", { status: "queue" });

      const result = retryTask(tempDir.root, "test-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot retry task");
    });

    it("should fail when task not found", () => {
      const result = retryTask(tempDir.root, "nonexistent-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Task not found");
    });
  });

  describe("cancelTask", () => {
    it("should cancel task from backlog", async () => {
      await createTaskDir(tempDir, "test-task", { status: "backlog" });

      const result = cancelTask(tempDir.root, "test-task");

      expect(result.success).toBe(true);
      expect(result.status).toBe("cancelled");
      expect(result.fromStatus).toBe("backlog");

      const taskJson = await tempDir.readJson<{
        status: string;
        cancelledAt?: string;
      }>(".viben/tasks/test-task/task.json");
      expect(taskJson.status).toBe("cancelled");
      expect(taskJson.cancelledAt).toBeDefined();
    });

    it("should cancel task from queue", async () => {
      await createTaskDir(tempDir, "test-task", { status: "queue" });

      const result = cancelTask(tempDir.root, "test-task");

      expect(result.success).toBe(true);
      expect(result.status).toBe("cancelled");
    });

    it("should cancel task from paused", async () => {
      await createTaskDir(tempDir, "test-task", { status: "paused" });

      const result = cancelTask(tempDir.root, "test-task");

      expect(result.success).toBe(true);
      expect(result.status).toBe("cancelled");
    });

    it("should require force option to cancel in_progress task", async () => {
      await createTaskDir(tempDir, "test-task", { status: "in_progress" });

      const result = cancelTask(tempDir.root, "test-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Use force option to cancel a running task");
    });

    it("should cancel in_progress task with force option", async () => {
      await createTaskDir(tempDir, "test-task", { status: "in_progress" });

      const result = cancelTask(tempDir.root, "test-task", { force: true });

      expect(result.success).toBe(true);
      expect(result.status).toBe("cancelled");
    });

    it("should record cancellation reason when provided", async () => {
      await createTaskDir(tempDir, "test-task", { status: "backlog" });

      const result = cancelTask(tempDir.root, "test-task", {
        reason: "No longer needed",
      });

      expect(result.success).toBe(true);

      const taskJson = await tempDir.readJson<{
        cancelReason?: string;
      }>(".viben/tasks/test-task/task.json");
      expect(taskJson.cancelReason).toBe("No longer needed");
    });

    it("should append CANCEL event with reason", async () => {
      await createTaskDir(tempDir, "test-task", { status: "backlog" });

      cancelTask(tempDir.root, "test-task", { reason: "No longer needed" });

      const eventsContent = await tempDir.readFile(".viben/tasks/test-task/events.jsonl");
      const events = eventsContent
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));

      const cancelEvent = events.find((e) => e.type === "CANCEL");
      expect(cancelEvent).toBeDefined();
      expect(cancelEvent.payload?.reason).toBe("No longer needed");
    });

    it("should reject cancelling from terminal state (completed)", async () => {
      await createTaskDir(tempDir, "test-task", { status: "completed" });

      const result = cancelTask(tempDir.root, "test-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot cancel task");
    });

    it("should fail when task not found", () => {
      const result = cancelTask(tempDir.root, "nonexistent-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Task not found");
    });
  });
});
