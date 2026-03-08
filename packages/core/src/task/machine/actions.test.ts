/**
 * Actions Tests
 *
 * Tests all action functions used in the task state machine.
 * Actions are side effects that update context during state transitions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  markSubtaskDone,
  setReviewReason_planReview,
  setReviewReason_stopped,
  setReviewReason_completed,
  setReviewReason_qaRejected,
  savePausedSnapshot_queue,
  savePausedSnapshot_planning,
  savePausedSnapshot_coding,
  savePausedSnapshot_qaReview,
  savePausedSnapshot_qaFixing,
  restoreFromSnapshot,
  clearPausedSnapshot,
  setQueuedAt,
} from "./actions";
import { createMockContext, createPausedContext } from "../__fixtures__/task-fixtures";

// =============================================================================
// markSubtaskDone Action
// =============================================================================

describe("markSubtaskDone", () => {
  it("increments currentSubtaskIndex from 0 to 1", () => {
    const context = createMockContext({ currentSubtaskIndex: 0 });
    const result = markSubtaskDone({ context });
    expect(result.currentSubtaskIndex).toBe(1);
  });

  it("increments currentSubtaskIndex from 5 to 6", () => {
    const context = createMockContext({ currentSubtaskIndex: 5 });
    const result = markSubtaskDone({ context });
    expect(result.currentSubtaskIndex).toBe(6);
  });

  it("only returns currentSubtaskIndex in partial context", () => {
    const context = createMockContext({ currentSubtaskIndex: 3 });
    const result = markSubtaskDone({ context });
    expect(Object.keys(result)).toEqual(["currentSubtaskIndex"]);
  });
});

// =============================================================================
// setReviewReason Actions
// =============================================================================

describe("setReviewReason actions", () => {
  describe("setReviewReason_planReview", () => {
    it("sets reviewReason to plan_review", () => {
      const result = setReviewReason_planReview();
      expect(result.reviewReason).toBe("plan_review");
    });
  });

  describe("setReviewReason_stopped", () => {
    it("sets reviewReason to stopped", () => {
      const result = setReviewReason_stopped();
      expect(result.reviewReason).toBe("stopped");
    });
  });

  describe("setReviewReason_completed", () => {
    it("sets reviewReason to completed", () => {
      const result = setReviewReason_completed();
      expect(result.reviewReason).toBe("completed");
    });
  });

  describe("setReviewReason_qaRejected", () => {
    it("sets reviewReason to qa_rejected", () => {
      const result = setReviewReason_qaRejected();
      expect(result.reviewReason).toBe("qa_rejected");
    });
  });
});

// =============================================================================
// savePausedSnapshot Actions
// =============================================================================

describe("savePausedSnapshot actions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T10:30:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("savePausedSnapshot_queue", () => {
    it("saves queue as from_state", () => {
      const context = createMockContext({ currentSubtaskIndex: 0 });
      const result = savePausedSnapshot_queue({ context });

      expect(result.pausedFromState).toBe("queue");
      expect(result.paused_snapshot).toBeDefined();
      expect(result.paused_snapshot?.from_state).toBe("queue");
      expect(result.paused_snapshot?.subtask_index).toBe(0);
      expect(result.paused_snapshot?.paused_at).toBe("2026-01-15T10:30:00.000Z");
    });

    it("preserves current subtask index", () => {
      const context = createMockContext({ currentSubtaskIndex: 3 });
      const result = savePausedSnapshot_queue({ context });

      expect(result.paused_snapshot?.subtask_index).toBe(3);
    });
  });

  describe("savePausedSnapshot_planning", () => {
    it("saves in_progress.planning as from_state", () => {
      const context = createMockContext({ currentSubtaskIndex: 0 });
      const result = savePausedSnapshot_planning({ context });

      expect(result.pausedFromState).toEqual({ in_progress: "planning" });
      expect(result.paused_snapshot?.from_state).toEqual({ in_progress: "planning" });
    });
  });

  describe("savePausedSnapshot_coding", () => {
    it("saves in_progress.coding as from_state", () => {
      const context = createMockContext({ currentSubtaskIndex: 2 });
      const result = savePausedSnapshot_coding({ context });

      expect(result.pausedFromState).toEqual({ in_progress: "coding" });
      expect(result.paused_snapshot?.from_state).toEqual({ in_progress: "coding" });
      expect(result.paused_snapshot?.subtask_index).toBe(2);
    });
  });

  describe("savePausedSnapshot_qaReview", () => {
    it("saves in_progress.qa_review as from_state", () => {
      const context = createMockContext({ currentSubtaskIndex: 5 });
      const result = savePausedSnapshot_qaReview({ context });

      expect(result.pausedFromState).toEqual({ in_progress: "qa_review" });
      expect(result.paused_snapshot?.from_state).toEqual({ in_progress: "qa_review" });
      expect(result.paused_snapshot?.subtask_index).toBe(5);
    });
  });

  describe("savePausedSnapshot_qaFixing", () => {
    it("saves in_progress.qa_fixing as from_state", () => {
      const context = createMockContext({ currentSubtaskIndex: 5 });
      const result = savePausedSnapshot_qaFixing({ context });

      expect(result.pausedFromState).toEqual({ in_progress: "qa_fixing" });
      expect(result.paused_snapshot?.from_state).toEqual({ in_progress: "qa_fixing" });
      expect(result.paused_snapshot?.subtask_index).toBe(5);
    });
  });
});

// =============================================================================
// restoreFromSnapshot Action
// =============================================================================

describe("restoreFromSnapshot", () => {
  it("clears pausedFromState", () => {
    const context = createPausedContext({ in_progress: "coding" }, 3);
    const result = restoreFromSnapshot({ context });

    expect(result.pausedFromState).toBeUndefined();
  });

  it("clears paused_snapshot", () => {
    const context = createPausedContext({ in_progress: "coding" }, 3);
    const result = restoreFromSnapshot({ context });

    expect(result.paused_snapshot).toBeUndefined();
  });

  it("restores subtask index from snapshot", () => {
    const context = createPausedContext({ in_progress: "coding" }, 3);
    const result = restoreFromSnapshot({ context });

    expect(result.currentSubtaskIndex).toBe(3);
  });

  it("does not restore subtask index when no snapshot", () => {
    const context = createMockContext({
      pausedFromState: "queue",
      paused_snapshot: undefined,
      currentSubtaskIndex: 5,
    });
    const result = restoreFromSnapshot({ context });

    // Should not include currentSubtaskIndex when no snapshot
    expect(result.currentSubtaskIndex).toBeUndefined();
  });
});

// =============================================================================
// clearPausedSnapshot Action
// =============================================================================

describe("clearPausedSnapshot", () => {
  it("clears pausedFromState", () => {
    const result = clearPausedSnapshot();
    expect(result.pausedFromState).toBeUndefined();
  });

  it("clears paused_snapshot", () => {
    const result = clearPausedSnapshot();
    expect(result.paused_snapshot).toBeUndefined();
  });

  it("does not include currentSubtaskIndex (unlike restoreFromSnapshot)", () => {
    const result = clearPausedSnapshot();
    expect("currentSubtaskIndex" in result).toBe(false);
  });
});

// =============================================================================
// setQueuedAt Action
// =============================================================================

describe("setQueuedAt", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T10:30:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sets queuedAt to current timestamp", () => {
    const result = setQueuedAt();
    expect(result.queuedAt).toBe("2026-01-15T10:30:00.000Z");
  });

  it("only returns queuedAt", () => {
    const result = setQueuedAt();
    expect(Object.keys(result)).toEqual(["queuedAt"]);
  });
});

// =============================================================================
// Action Integration Tests
// =============================================================================

describe("Action integration", () => {
  describe("pause and restore flow", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-15T10:30:00.000Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("correctly saves and restores coding state", () => {
      // Initial context with progress
      const initialContext = createMockContext({
        currentSubtaskIndex: 3,
        taskId: "task_123",
      });

      // Pause from coding
      const pauseResult = savePausedSnapshot_coding({ context: initialContext });

      // Create paused context
      const pausedContext = {
        ...initialContext,
        ...pauseResult,
      };

      // Verify snapshot was saved
      expect(pausedContext.paused_snapshot?.from_state).toEqual({ in_progress: "coding" });
      expect(pausedContext.paused_snapshot?.subtask_index).toBe(3);

      // Restore from snapshot
      const restoreResult = restoreFromSnapshot({ context: pausedContext });

      // Verify restoration
      expect(restoreResult.pausedFromState).toBeUndefined();
      expect(restoreResult.paused_snapshot).toBeUndefined();
      expect(restoreResult.currentSubtaskIndex).toBe(3);
    });

    it("correctly handles abandon (clear without restore)", () => {
      const initialContext = createMockContext({
        currentSubtaskIndex: 3,
      });

      // Pause from coding
      const pauseResult = savePausedSnapshot_coding({ context: initialContext });
      const pausedContext = {
        ...initialContext,
        ...pauseResult,
      };

      // Abandon (clear snapshot, don't restore)
      const clearResult = clearPausedSnapshot();

      // Apply clear result
      const clearedContext = {
        ...pausedContext,
        ...clearResult,
      };

      // Verify cleared (but subtaskIndex unchanged in clear)
      expect(clearedContext.pausedFromState).toBeUndefined();
      expect(clearedContext.paused_snapshot).toBeUndefined();
      // Note: clearPausedSnapshot doesn't modify currentSubtaskIndex
      expect(clearedContext.currentSubtaskIndex).toBe(3);
    });
  });
});
