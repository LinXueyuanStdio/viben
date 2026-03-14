/**
 * Task Lifecycle Operations Tests
 *
 * Tests for status transitions:
 * - enqueueTask: backlog -> queue
 * - dequeueTask: queue -> backlog
 * - pauseTask: in_progress/queue -> paused
 * - resumeTask: paused -> in_progress/queue (restore)
 * - approveTask: review -> completed
 * - rejectTask: review -> backlog
 * - retryTask: failed -> queue
 * - cancelTask: * -> cancelled
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
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

// Mock node:fs
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

// Mock viben-workspace functions
vi.mock("../../cli/lib/viben-workspace", () => ({
  resolveTaskDirectory: vi.fn(),
  updateTaskStatus: vi.fn(),
  appendTaskEvent: vi.fn(),
  validateStatusTransition: vi.fn(),
  getTodayDate: vi.fn(),
  FILE_TASK_JSON: "task.json",
}));

// Get mocked functions
import * as fs from "node:fs";
import * as vibenWorkspace from "../../cli/lib/viben-workspace";

describe("lifecycle operations", () => {
  const mockRepoRoot = "/mock/repo";
  const mockTaskDir = join(mockRepoRoot, ".viben/tasks/03-15-test-task");

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(vibenWorkspace.resolveTaskDirectory).mockReturnValue(mockTaskDir);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(vibenWorkspace.updateTaskStatus).mockReturnValue(true);
    vi.mocked(vibenWorkspace.getTodayDate).mockReturnValue("2024-03-15");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Helper to mock task.json content
  const mockTaskJson = (data: Record<string, unknown>) => {
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(data));
  };

  describe("enqueueTask", () => {
    it("should enqueue task from backlog to queue", () => {
      mockTaskJson({ status: "backlog", id: "test-task" });
      vi.mocked(vibenWorkspace.validateStatusTransition).mockReturnValue({
        valid: true,
      });

      const result = enqueueTask(mockRepoRoot, "test-task");

      expect(result.success).toBe(true);
      expect(result.status).toBe("queue");
      expect(result.fromStatus).toBe("backlog");
      expect(vi.mocked(vibenWorkspace.updateTaskStatus)).toHaveBeenCalledWith(
        mockTaskDir,
        "queue",
        expect.objectContaining({ queuedAt: expect.any(String) })
      );
      expect(vi.mocked(vibenWorkspace.appendTaskEvent)).toHaveBeenCalledWith(
        mockTaskDir,
        "QUEUE",
        expect.any(Object)
      );
    });

    it("should set additional fields when options provided", () => {
      mockTaskJson({ status: "backlog", id: "test-task" });
      vi.mocked(vibenWorkspace.validateStatusTransition).mockReturnValue({
        valid: true,
      });

      const result = enqueueTask(mockRepoRoot, "test-task", {
        agent: "claude-agent",
        executor: "CLAUDE_CODE",
        model: "claude-3-opus",
        priority: "P0",
      });

      expect(result.success).toBe(true);
      expect(vi.mocked(vibenWorkspace.updateTaskStatus)).toHaveBeenCalledWith(
        mockTaskDir,
        "queue",
        expect.objectContaining({
          agent: "claude-agent",
          executor: "CLAUDE_CODE",
          model: "claude-3-opus",
          priority: "P0",
        })
      );
    });

    it("should fail when task not found", () => {
      vi.mocked(vibenWorkspace.resolveTaskDirectory).mockReturnValue(null);

      const result = enqueueTask(mockRepoRoot, "nonexistent-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Task not found");
    });

    it("should fail when status transition is invalid", () => {
      mockTaskJson({ status: "in_progress", id: "test-task" });
      vi.mocked(vibenWorkspace.validateStatusTransition).mockReturnValue({
        valid: false,
        error: "Cannot queue task in 'in_progress' state",
      });

      const result = enqueueTask(mockRepoRoot, "test-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot queue task");
    });

    it("should fail when updateTaskStatus fails", () => {
      mockTaskJson({ status: "backlog", id: "test-task" });
      vi.mocked(vibenWorkspace.validateStatusTransition).mockReturnValue({
        valid: true,
      });
      vi.mocked(vibenWorkspace.updateTaskStatus).mockReturnValue(false);

      const result = enqueueTask(mockRepoRoot, "test-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to update task.json");
    });
  });

  describe("dequeueTask", () => {
    it("should dequeue task from queue to backlog", () => {
      mockTaskJson({ status: "queue", id: "test-task" });
      vi.mocked(vibenWorkspace.validateStatusTransition).mockReturnValue({
        valid: true,
      });

      const result = dequeueTask(mockRepoRoot, "test-task");

      expect(result.success).toBe(true);
      expect(result.status).toBe("backlog");
      expect(result.fromStatus).toBe("queue");
      expect(vi.mocked(vibenWorkspace.updateTaskStatus)).toHaveBeenCalledWith(
        mockTaskDir,
        "backlog",
        { queuedAt: null }
      );
      expect(vi.mocked(vibenWorkspace.appendTaskEvent)).toHaveBeenCalledWith(
        mockTaskDir,
        "DEQUEUE"
      );
    });

    it("should fail when task not found", () => {
      vi.mocked(vibenWorkspace.resolveTaskDirectory).mockReturnValue(null);

      const result = dequeueTask(mockRepoRoot, "nonexistent-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Task not found");
    });

    it("should fail when status transition is invalid", () => {
      mockTaskJson({ status: "backlog", id: "test-task" });
      vi.mocked(vibenWorkspace.validateStatusTransition).mockReturnValue({
        valid: false,
        error: "Cannot dequeue task in 'backlog' state",
      });

      const result = dequeueTask(mockRepoRoot, "test-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot dequeue task");
    });
  });

  describe("pauseTask", () => {
    it("should pause task from in_progress", () => {
      mockTaskJson({ status: "in_progress", id: "test-task", current_phase: 2 });
      vi.mocked(vibenWorkspace.validateStatusTransition).mockReturnValue({
        valid: true,
      });

      const result = pauseTask(mockRepoRoot, "test-task");

      expect(result.success).toBe(true);
      expect(result.status).toBe("paused");
      expect(result.fromStatus).toBe("in_progress");
      expect(vi.mocked(vibenWorkspace.updateTaskStatus)).toHaveBeenCalledWith(
        mockTaskDir,
        "paused",
        expect.objectContaining({
          pausedSnapshot: expect.objectContaining({
            fromState: "in_progress",
            subtaskIndex: 2,
            pausedAt: expect.any(String),
          }),
        })
      );
    });

    it("should pause task from queue", () => {
      mockTaskJson({ status: "queue", id: "test-task", current_phase: 0 });
      vi.mocked(vibenWorkspace.validateStatusTransition).mockReturnValue({
        valid: true,
      });

      const result = pauseTask(mockRepoRoot, "test-task");

      expect(result.success).toBe(true);
      expect(result.status).toBe("paused");
      expect(result.fromStatus).toBe("queue");
    });

    it("should fail when task not found", () => {
      vi.mocked(vibenWorkspace.resolveTaskDirectory).mockReturnValue(null);

      const result = pauseTask(mockRepoRoot, "nonexistent-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Task not found");
    });

    it("should fail when pausing from terminal state", () => {
      mockTaskJson({ status: "completed", id: "test-task" });
      vi.mocked(vibenWorkspace.validateStatusTransition).mockReturnValue({
        valid: false,
        error: "Cannot pause task in 'completed' state",
      });

      const result = pauseTask(mockRepoRoot, "test-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot pause task");
    });
  });

  describe("resumeTask", () => {
    it("should resume task and restore to previous state", () => {
      mockTaskJson({
        status: "paused",
        id: "test-task",
        pausedSnapshot: {
          fromState: "in_progress",
          subtaskIndex: 2,
          pausedAt: "2024-03-15T10:00:00Z",
        },
      });
      vi.mocked(vibenWorkspace.validateStatusTransition).mockReturnValue({
        valid: true,
      });

      const result = resumeTask(mockRepoRoot, "test-task");

      expect(result.success).toBe(true);
      expect(result.status).toBe("in_progress");
      expect(result.fromStatus).toBe("paused");
      expect(vi.mocked(vibenWorkspace.updateTaskStatus)).toHaveBeenCalledWith(
        mockTaskDir,
        "in_progress",
        { pausedSnapshot: null }
      );
    });

    it("should resume to queue when no pausedSnapshot", () => {
      mockTaskJson({ status: "paused", id: "test-task" });
      vi.mocked(vibenWorkspace.validateStatusTransition).mockReturnValue({
        valid: true,
      });

      const result = resumeTask(mockRepoRoot, "test-task");

      expect(result.success).toBe(true);
      expect(result.status).toBe("queue");
    });

    it("should fail when task not found", () => {
      vi.mocked(vibenWorkspace.resolveTaskDirectory).mockReturnValue(null);

      const result = resumeTask(mockRepoRoot, "nonexistent-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Task not found");
    });

    it("should fail when task is not paused", () => {
      mockTaskJson({ status: "queue", id: "test-task" });
      vi.mocked(vibenWorkspace.validateStatusTransition).mockReturnValue({
        valid: false,
        error: "Cannot resume task in 'queue' state",
      });

      const result = resumeTask(mockRepoRoot, "test-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot resume task");
    });
  });

  describe("approveTask", () => {
    it("should approve task from review to completed", () => {
      mockTaskJson({ status: "review", id: "test-task" });
      vi.mocked(vibenWorkspace.validateStatusTransition).mockReturnValue({
        valid: true,
      });

      const result = approveTask(mockRepoRoot, "test-task");

      expect(result.success).toBe(true);
      expect(result.status).toBe("completed");
      expect(result.fromStatus).toBe("review");
      expect(vi.mocked(vibenWorkspace.updateTaskStatus)).toHaveBeenCalledWith(
        mockTaskDir,
        "completed",
        expect.objectContaining({
          completedAt: "2024-03-15",
          reviewReason: "approved",
        })
      );
      expect(vi.mocked(vibenWorkspace.appendTaskEvent)).toHaveBeenCalledWith(
        mockTaskDir,
        "APPROVED"
      );
    });

    it("should fail when task not found", () => {
      vi.mocked(vibenWorkspace.resolveTaskDirectory).mockReturnValue(null);

      const result = approveTask(mockRepoRoot, "nonexistent-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Task not found");
    });

    it("should fail when task is not in review", () => {
      mockTaskJson({ status: "in_progress", id: "test-task" });
      vi.mocked(vibenWorkspace.validateStatusTransition).mockReturnValue({
        valid: false,
        error: "Cannot approved task in 'in_progress' state",
      });

      const result = approveTask(mockRepoRoot, "test-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot approved task");
    });
  });

  describe("rejectTask", () => {
    it("should reject task from review to backlog", () => {
      mockTaskJson({ status: "review", id: "test-task" });
      vi.mocked(vibenWorkspace.validateStatusTransition).mockReturnValue({
        valid: true,
      });

      const result = rejectTask(mockRepoRoot, "test-task");

      expect(result.success).toBe(true);
      expect(result.status).toBe("backlog");
      expect(result.fromStatus).toBe("review");
      expect(vi.mocked(vibenWorkspace.updateTaskStatus)).toHaveBeenCalledWith(
        mockTaskDir,
        "backlog",
        expect.objectContaining({
          pr_url: null,
          reviewReason: "rejected",
        })
      );
    });

    it("should record rejection reason when provided", () => {
      mockTaskJson({ status: "review", id: "test-task" });
      vi.mocked(vibenWorkspace.validateStatusTransition).mockReturnValue({
        valid: true,
      });

      const result = rejectTask(mockRepoRoot, "test-task", "Code quality issues");

      expect(result.success).toBe(true);
      expect(vi.mocked(vibenWorkspace.updateTaskStatus)).toHaveBeenCalledWith(
        mockTaskDir,
        "backlog",
        expect.objectContaining({
          rejectReason: "Code quality issues",
        })
      );
      expect(vi.mocked(vibenWorkspace.appendTaskEvent)).toHaveBeenCalledWith(
        mockTaskDir,
        "REJECTED",
        { reason: "Code quality issues" }
      );
    });

    it("should fail when task not found", () => {
      vi.mocked(vibenWorkspace.resolveTaskDirectory).mockReturnValue(null);

      const result = rejectTask(mockRepoRoot, "nonexistent-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Task not found");
    });

    it("should fail when task is not in review", () => {
      mockTaskJson({ status: "queue", id: "test-task" });
      vi.mocked(vibenWorkspace.validateStatusTransition).mockReturnValue({
        valid: false,
        error: "Cannot rejected task in 'queue' state",
      });

      const result = rejectTask(mockRepoRoot, "test-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot rejected task");
    });
  });

  describe("retryTask", () => {
    it("should retry task from failed to queue", () => {
      mockTaskJson({
        status: "failed",
        id: "test-task",
        error: "Build failed",
        errorMessage: "npm install failed",
        failedAt: "2024-03-14T10:00:00Z",
      });
      vi.mocked(vibenWorkspace.validateStatusTransition).mockReturnValue({
        valid: true,
      });

      const result = retryTask(mockRepoRoot, "test-task");

      expect(result.success).toBe(true);
      expect(result.status).toBe("queue");
      expect(result.fromStatus).toBe("failed");
      expect(vi.mocked(vibenWorkspace.updateTaskStatus)).toHaveBeenCalledWith(
        mockTaskDir,
        "queue",
        expect.objectContaining({
          queuedAt: expect.any(String),
          error: null,
          errorMessage: null,
          failedAt: null,
        })
      );
      expect(vi.mocked(vibenWorkspace.appendTaskEvent)).toHaveBeenCalledWith(
        mockTaskDir,
        "RETRY"
      );
    });

    it("should fail when task not found", () => {
      vi.mocked(vibenWorkspace.resolveTaskDirectory).mockReturnValue(null);

      const result = retryTask(mockRepoRoot, "nonexistent-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Task not found");
    });

    it("should fail when task is not in failed state", () => {
      mockTaskJson({ status: "queue", id: "test-task" });
      vi.mocked(vibenWorkspace.validateStatusTransition).mockReturnValue({
        valid: false,
        error: "Cannot retry task in 'queue' state",
      });

      const result = retryTask(mockRepoRoot, "test-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot retry task");
    });
  });

  describe("cancelTask", () => {
    it("should cancel task from backlog", () => {
      mockTaskJson({ status: "backlog", id: "test-task" });
      vi.mocked(vibenWorkspace.validateStatusTransition).mockReturnValue({
        valid: true,
      });

      const result = cancelTask(mockRepoRoot, "test-task");

      expect(result.success).toBe(true);
      expect(result.status).toBe("cancelled");
      expect(result.fromStatus).toBe("backlog");
      expect(vi.mocked(vibenWorkspace.updateTaskStatus)).toHaveBeenCalledWith(
        mockTaskDir,
        "cancelled",
        expect.objectContaining({
          cancelledAt: expect.any(String),
        })
      );
    });

    it("should cancel task from queue", () => {
      mockTaskJson({ status: "queue", id: "test-task" });
      vi.mocked(vibenWorkspace.validateStatusTransition).mockReturnValue({
        valid: true,
      });

      const result = cancelTask(mockRepoRoot, "test-task");

      expect(result.success).toBe(true);
      expect(result.status).toBe("cancelled");
    });

    it("should cancel task from paused", () => {
      mockTaskJson({ status: "paused", id: "test-task" });
      vi.mocked(vibenWorkspace.validateStatusTransition).mockReturnValue({
        valid: true,
      });

      const result = cancelTask(mockRepoRoot, "test-task");

      expect(result.success).toBe(true);
      expect(result.status).toBe("cancelled");
    });

    it("should require force option to cancel in_progress task", () => {
      mockTaskJson({ status: "in_progress", id: "test-task" });
      vi.mocked(vibenWorkspace.validateStatusTransition).mockReturnValue({
        valid: true,
      });

      const result = cancelTask(mockRepoRoot, "test-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Use force option to cancel a running task");
    });

    it("should cancel in_progress task with force option", () => {
      mockTaskJson({ status: "in_progress", id: "test-task" });
      vi.mocked(vibenWorkspace.validateStatusTransition).mockReturnValue({
        valid: true,
      });

      const result = cancelTask(mockRepoRoot, "test-task", { force: true });

      expect(result.success).toBe(true);
      expect(result.status).toBe("cancelled");
    });

    it("should record cancellation reason when provided", () => {
      mockTaskJson({ status: "backlog", id: "test-task" });
      vi.mocked(vibenWorkspace.validateStatusTransition).mockReturnValue({
        valid: true,
      });

      const result = cancelTask(mockRepoRoot, "test-task", {
        reason: "No longer needed",
      });

      expect(result.success).toBe(true);
      expect(vi.mocked(vibenWorkspace.updateTaskStatus)).toHaveBeenCalledWith(
        mockTaskDir,
        "cancelled",
        expect.objectContaining({
          cancelReason: "No longer needed",
        })
      );
      expect(vi.mocked(vibenWorkspace.appendTaskEvent)).toHaveBeenCalledWith(
        mockTaskDir,
        "CANCEL",
        { reason: "No longer needed" }
      );
    });

    it("should fail when task not found", () => {
      vi.mocked(vibenWorkspace.resolveTaskDirectory).mockReturnValue(null);

      const result = cancelTask(mockRepoRoot, "nonexistent-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Task not found");
    });

    it("should fail when cancelling from terminal state", () => {
      mockTaskJson({ status: "completed", id: "test-task" });
      vi.mocked(vibenWorkspace.validateStatusTransition).mockReturnValue({
        valid: false,
        error: "Cannot cancel task in 'completed' state",
      });

      const result = cancelTask(mockRepoRoot, "test-task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot cancel task");
    });
  });
});
