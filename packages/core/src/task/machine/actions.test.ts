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
  savePausedSnapshot_plan,
  savePausedSnapshot_implement,
  savePausedSnapshot_check,
  savePausedSnapshot_fix,
  restoreFromSnapshot,
  clearPausedSnapshot,
  setQueuedAt,
  // Legacy deprecated functions
  savePausedState_queue,
  savePausedState_plan,
  savePausedState_implement,
  savePausedState_check,
  savePausedState_fix,
  clearPausedState,
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
      expect(result.review_reason).toBe("plan_review");
    });
  });

  describe("setReviewReason_stopped", () => {
    it("sets reviewReason to stopped", () => {
      const result = setReviewReason_stopped();
      expect(result.review_reason).toBe("stopped");
    });
  });

  describe("setReviewReason_completed", () => {
    it("sets reviewReason to completed", () => {
      const result = setReviewReason_completed();
      expect(result.review_reason).toBe("completed");
    });
  });

  describe("setReviewReason_qaRejected", () => {
    it("sets reviewReason to qa_rejected", () => {
      const result = setReviewReason_qaRejected();
      expect(result.review_reason).toBe("qa_rejected");
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

  describe("savePausedSnapshot_plan", () => {
    it("saves in_progress.plan as from_state", () => {
      const context = createMockContext({ currentSubtaskIndex: 0 });
      const result = savePausedSnapshot_plan({ context });

      expect(result.pausedFromState).toEqual({ in_progress: "plan" });
      expect(result.paused_snapshot?.from_state).toEqual({ in_progress: "plan" });
    });
  });

  describe("savePausedSnapshot_implement", () => {
    it("saves in_progress.implement as from_state", () => {
      const context = createMockContext({ currentSubtaskIndex: 2 });
      const result = savePausedSnapshot_implement({ context });

      expect(result.pausedFromState).toEqual({ in_progress: "implement" });
      expect(result.paused_snapshot?.from_state).toEqual({ in_progress: "implement" });
      expect(result.paused_snapshot?.subtask_index).toBe(2);
    });
  });

  describe("savePausedSnapshot_check", () => {
    it("saves in_progress.check as from_state", () => {
      const context = createMockContext({ currentSubtaskIndex: 5 });
      const result = savePausedSnapshot_check({ context });

      expect(result.pausedFromState).toEqual({ in_progress: "check" });
      expect(result.paused_snapshot?.from_state).toEqual({ in_progress: "check" });
      expect(result.paused_snapshot?.subtask_index).toBe(5);
    });
  });

  describe("savePausedSnapshot_fix", () => {
    it("saves in_progress.fix as from_state", () => {
      const context = createMockContext({ currentSubtaskIndex: 5 });
      const result = savePausedSnapshot_fix({ context });

      expect(result.pausedFromState).toEqual({ in_progress: "fix" });
      expect(result.paused_snapshot?.from_state).toEqual({ in_progress: "fix" });
      expect(result.paused_snapshot?.subtask_index).toBe(5);
    });
  });
});

// =============================================================================
// restoreFromSnapshot Action
// =============================================================================

describe("restoreFromSnapshot", () => {
  it("clears pausedFromState", () => {
    const context = createPausedContext({ in_progress: "implement" }, 3);
    const result = restoreFromSnapshot({ context });

    expect(result.pausedFromState).toBeUndefined();
  });

  it("clears paused_snapshot", () => {
    const context = createPausedContext({ in_progress: "implement" }, 3);
    const result = restoreFromSnapshot({ context });

    expect(result.paused_snapshot).toBeUndefined();
  });

  it("restores subtask index from snapshot", () => {
    const context = createPausedContext({ in_progress: "implement" }, 3);
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
    expect(result.queued_at).toBe("2026-01-15T10:30:00.000Z");
  });

  it("only returns queuedAt", () => {
    const result = setQueuedAt();
    expect(Object.keys(result)).toEqual(["queuedAt"]);
  });
});

// =============================================================================
// Legacy Deprecated Actions Tests
// =============================================================================

describe("Legacy deprecated actions", () => {
  describe("savePausedState_queue", () => {
    it("sets pausedFromState to queue", () => {
      const result = savePausedState_queue();
      expect(result.pausedFromState).toBe("queue");
    });

    it("only sets pausedFromState (no snapshot)", () => {
      const result = savePausedState_queue();
      expect(Object.keys(result)).toEqual(["pausedFromState"]);
    });
  });

  describe("savePausedState_plan", () => {
    it("sets pausedFromState to in_progress.plan", () => {
      const result = savePausedState_plan();
      expect(result.pausedFromState).toEqual({ in_progress: "plan" });
    });
  });

  describe("savePausedState_implement", () => {
    it("sets pausedFromState to in_progress.implement", () => {
      const result = savePausedState_implement();
      expect(result.pausedFromState).toEqual({ in_progress: "implement" });
    });
  });

  describe("savePausedState_check", () => {
    it("sets pausedFromState to in_progress.check", () => {
      const result = savePausedState_check();
      expect(result.pausedFromState).toEqual({ in_progress: "check" });
    });
  });

  describe("savePausedState_fix", () => {
    it("sets pausedFromState to in_progress.fix", () => {
      const result = savePausedState_fix();
      expect(result.pausedFromState).toEqual({ in_progress: "fix" });
    });
  });

  describe("clearPausedState", () => {
    it("clears pausedFromState to undefined", () => {
      const result = clearPausedState();
      expect(result.pausedFromState).toBeUndefined();
    });

    it("only sets pausedFromState (no snapshot)", () => {
      const result = clearPausedState();
      expect(Object.keys(result)).toEqual(["pausedFromState"]);
    });
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

    it("correctly saves and restores queue state", () => {
      const initialContext = createMockContext({
        currentSubtaskIndex: 0,
        taskId: "task_queue",
      });

      // Pause from queue
      const pauseResult = savePausedSnapshot_queue({ context: initialContext });
      const pausedContext = { ...initialContext, ...pauseResult };

      // Verify snapshot was saved
      expect(pausedContext.paused_snapshot?.from_state).toBe("queue");
      expect(pausedContext.paused_snapshot?.subtask_index).toBe(0);

      // Restore from snapshot
      const restoreResult = restoreFromSnapshot({ context: pausedContext });
      expect(restoreResult.pausedFromState).toBeUndefined();
      expect(restoreResult.paused_snapshot).toBeUndefined();
      expect(restoreResult.currentSubtaskIndex).toBe(0);
    });

    it("correctly saves and restores plan state", () => {
      const initialContext = createMockContext({
        currentSubtaskIndex: 0,
        taskId: "task_plan",
      });

      // Pause from plan
      const pauseResult = savePausedSnapshot_plan({ context: initialContext });
      const pausedContext = { ...initialContext, ...pauseResult };

      // Verify snapshot was saved
      expect(pausedContext.paused_snapshot?.from_state).toEqual({ in_progress: "plan" });
      expect(pausedContext.paused_snapshot?.subtask_index).toBe(0);

      // Restore from snapshot
      const restoreResult = restoreFromSnapshot({ context: pausedContext });
      expect(restoreResult.pausedFromState).toBeUndefined();
      expect(restoreResult.paused_snapshot).toBeUndefined();
      expect(restoreResult.currentSubtaskIndex).toBe(0);
    });

    it("correctly saves and restores implement state", () => {
      // Initial context with progress
      const initialContext = createMockContext({
        currentSubtaskIndex: 3,
        taskId: "task_123",
      });

      // Pause from implement
      const pauseResult = savePausedSnapshot_implement({ context: initialContext });

      // Create paused context
      const pausedContext = {
        ...initialContext,
        ...pauseResult,
      };

      // Verify snapshot was saved
      expect(pausedContext.paused_snapshot?.from_state).toEqual({ in_progress: "implement" });
      expect(pausedContext.paused_snapshot?.subtask_index).toBe(3);

      // Restore from snapshot
      const restoreResult = restoreFromSnapshot({ context: pausedContext });

      // Verify restoration
      expect(restoreResult.pausedFromState).toBeUndefined();
      expect(restoreResult.paused_snapshot).toBeUndefined();
      expect(restoreResult.currentSubtaskIndex).toBe(3);
    });

    it("correctly saves and restores check state", () => {
      const initialContext = createMockContext({
        currentSubtaskIndex: 5,
        taskId: "task_check",
      });

      // Pause from check
      const pauseResult = savePausedSnapshot_check({ context: initialContext });
      const pausedContext = { ...initialContext, ...pauseResult };

      // Verify snapshot was saved
      expect(pausedContext.paused_snapshot?.from_state).toEqual({ in_progress: "check" });
      expect(pausedContext.paused_snapshot?.subtask_index).toBe(5);

      // Restore from snapshot
      const restoreResult = restoreFromSnapshot({ context: pausedContext });
      expect(restoreResult.pausedFromState).toBeUndefined();
      expect(restoreResult.paused_snapshot).toBeUndefined();
      expect(restoreResult.currentSubtaskIndex).toBe(5);
    });

    it("correctly saves and restores fix state", () => {
      const initialContext = createMockContext({
        currentSubtaskIndex: 5,
        taskId: "task_fix",
      });

      // Pause from fix
      const pauseResult = savePausedSnapshot_fix({ context: initialContext });
      const pausedContext = { ...initialContext, ...pauseResult };

      // Verify snapshot was saved
      expect(pausedContext.paused_snapshot?.from_state).toEqual({ in_progress: "fix" });
      expect(pausedContext.paused_snapshot?.subtask_index).toBe(5);

      // Restore from snapshot
      const restoreResult = restoreFromSnapshot({ context: pausedContext });
      expect(restoreResult.pausedFromState).toBeUndefined();
      expect(restoreResult.paused_snapshot).toBeUndefined();
      expect(restoreResult.currentSubtaskIndex).toBe(5);
    });

    it("correctly handles abandon (clear without restore)", () => {
      const initialContext = createMockContext({
        currentSubtaskIndex: 3,
      });

      // Pause from implement
      const pauseResult = savePausedSnapshot_implement({ context: initialContext });
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

  describe("legacy vs new action comparison", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-15T10:30:00.000Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("legacy and new actions set same pausedFromState for queue", () => {
      const context = createMockContext({ currentSubtaskIndex: 0 });
      const legacy = savePausedState_queue();
      const newAction = savePausedSnapshot_queue({ context });

      expect(legacy.pausedFromState).toBe("queue");
      expect(newAction.pausedFromState).toBe("queue");
    });

    it("legacy and new actions set same pausedFromState for implement", () => {
      const context = createMockContext({ currentSubtaskIndex: 2 });
      const legacy = savePausedState_implement();
      const newAction = savePausedSnapshot_implement({ context });

      expect(legacy.pausedFromState).toEqual({ in_progress: "implement" });
      expect(newAction.pausedFromState).toEqual({ in_progress: "implement" });
    });

    it("new action includes snapshot, legacy does not", () => {
      const context = createMockContext({ currentSubtaskIndex: 2 });
      const legacy = savePausedState_implement();
      const newAction = savePausedSnapshot_implement({ context });

      expect("paused_snapshot" in legacy).toBe(false);
      expect(newAction.paused_snapshot).toBeDefined();
      expect(newAction.paused_snapshot?.subtask_index).toBe(2);
    });
  });
});
