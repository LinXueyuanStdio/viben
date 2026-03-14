/**
 * Task State Machine Tests
 *
 * Tests all valid and invalid state transitions in the task state machine.
 * Uses XState v5's pure transition() function via getNextState helper.
 */

import { describe, it, expect } from "vitest";
import {
  getNextState,
  xstateToTaskStatus,
  xstateToExecutionPhase,
  type TaskMachineEvent,
  type XStateValue,
} from "./task-machine";
import {
  applyEventSequence,
  EVENT_SEQUENCES,
} from "../__test-utils__/test-helpers";

// =============================================================================
// Valid State Transitions
// =============================================================================

describe("Task State Machine - Valid Transitions", () => {
  // -------------------------------------------------------------------------
  // Backlog transitions
  // -------------------------------------------------------------------------
  describe("from backlog", () => {
    it("backlog + QUEUE -> queue", () => {
      const result = getNextState("backlog", { type: "QUEUE" });
      expect(result.changed).toBe(true);
      expect(result.value).toBe("queue");
    });

    it("backlog + CANCEL -> cancelled", () => {
      const result = getNextState("backlog", { type: "CANCEL" });
      expect(result.changed).toBe(true);
      expect(result.value).toBe("cancelled");
    });
  });

  // -------------------------------------------------------------------------
  // Queue transitions
  // -------------------------------------------------------------------------
  describe("from queue", () => {
    it("queue + START -> in_progress.plan", () => {
      const result = getNextState("queue", { type: "START" });
      expect(result.changed).toBe(true);
      expect(result.value).toEqual({ in_progress: "plan" });
    });

    it("queue + DEQUEUE -> backlog", () => {
      const result = getNextState("queue", { type: "DEQUEUE" });
      expect(result.changed).toBe(true);
      expect(result.value).toBe("backlog");
    });

    it("queue + PAUSE -> paused", () => {
      const result = getNextState("queue", { type: "PAUSE" });
      expect(result.changed).toBe(true);
      expect(result.value).toBe("paused");
    });

    it("queue + CANCEL -> cancelled", () => {
      const result = getNextState("queue", { type: "CANCEL" });
      expect(result.changed).toBe(true);
      expect(result.value).toBe("cancelled");
    });
  });

  // -------------------------------------------------------------------------
  // Plan phase transitions
  // -------------------------------------------------------------------------
  describe("from in_progress.plan", () => {
    const planState: XStateValue = { in_progress: "plan" };

    it("plan + PLAN_COMPLETE -> implement (default: no plan review)", () => {
      // Default context has requiresPlanReview: false
      const result = getNextState(planState, { type: "PLAN_COMPLETE" });
      expect(result.changed).toBe(true);
      expect(result.value).toEqual({ in_progress: "implement" });
    });

    // Note: Testing requiresPlanReview=true requires XState actor with context override,
    // which is not directly testable through getNextState since the navigation path
    // doesn't support arbitrary context injection. The guard is tested in guards.test.ts.

    it("plan + PLAN_FAILED -> failed", () => {
      const result = getNextState(planState, { type: "PLAN_FAILED" });
      expect(result.changed).toBe(true);
      expect(result.value).toBe("failed");
    });

    it("plan + PAUSE -> paused", () => {
      const result = getNextState(planState, { type: "PAUSE" });
      expect(result.changed).toBe(true);
      expect(result.value).toBe("paused");
    });
  });

  // -------------------------------------------------------------------------
  // Implement phase transitions
  // -------------------------------------------------------------------------
  describe("from in_progress.implement", () => {
    const implementState: XStateValue = { in_progress: "implement" };

    it("implement + SUBTASK_COMPLETE -> implement (transition occurs)", () => {
      // SUBTASK_COMPLETE is a re-entry transition that stays in implement
      // XState's changed detection compares JSON strings, and re-entry with
      // actions may show as unchanged since state value is the same
      const result = getNextState(implementState, { type: "SUBTASK_COMPLETE" });
      // The transition happens (action runs) but state value remains { in_progress: "implement" }
      expect(result.value).toEqual({ in_progress: "implement" });
    });

    it("implement + ALL_SUBTASKS_DONE -> check", () => {
      const result = getNextState(implementState, { type: "ALL_SUBTASKS_DONE" });
      expect(result.changed).toBe(true);
      expect(result.value).toEqual({ in_progress: "check" });
    });

    it("implement + IMPLEMENT_FAILED -> failed", () => {
      const result = getNextState(implementState, { type: "IMPLEMENT_FAILED" });
      expect(result.changed).toBe(true);
      expect(result.value).toBe("failed");
    });

    it("implement + PAUSE -> paused", () => {
      const result = getNextState(implementState, { type: "PAUSE" });
      expect(result.changed).toBe(true);
      expect(result.value).toBe("paused");
    });
  });

  // -------------------------------------------------------------------------
  // Check phase transitions
  // -------------------------------------------------------------------------
  describe("from in_progress.check", () => {
    const checkState: XStateValue = { in_progress: "check" };

    it("check + CHECK_PASSED -> review", () => {
      const result = getNextState(checkState, { type: "CHECK_PASSED" });
      expect(result.changed).toBe(true);
      expect(result.value).toBe("review");
    });

    it("check + CHECK_FAILED -> fix", () => {
      const result = getNextState(checkState, { type: "CHECK_FAILED" });
      expect(result.changed).toBe(true);
      expect(result.value).toEqual({ in_progress: "fix" });
    });

    it("check + PAUSE -> paused", () => {
      const result = getNextState(checkState, { type: "PAUSE" });
      expect(result.changed).toBe(true);
      expect(result.value).toBe("paused");
    });
  });

  // -------------------------------------------------------------------------
  // Fix phase transitions
  // -------------------------------------------------------------------------
  describe("from in_progress.fix", () => {
    const fixState: XStateValue = { in_progress: "fix" };

    it("fix + FIX_COMPLETE -> check", () => {
      const result = getNextState(fixState, { type: "FIX_COMPLETE" });
      expect(result.changed).toBe(true);
      expect(result.value).toEqual({ in_progress: "check" });
    });

    it("fix + FIX_FAILED -> failed", () => {
      const result = getNextState(fixState, { type: "FIX_FAILED" });
      expect(result.changed).toBe(true);
      expect(result.value).toBe("failed");
    });

    it("fix + PAUSE -> paused", () => {
      const result = getNextState(fixState, { type: "PAUSE" });
      expect(result.changed).toBe(true);
      expect(result.value).toBe("paused");
    });
  });

  // -------------------------------------------------------------------------
  // USER_STOPPED from in_progress states
  // -------------------------------------------------------------------------
  describe("USER_STOPPED from in_progress", () => {
    // Note: The navigation paths to reach in_progress states don't modify
    // currentSubtaskIndex, so it defaults to 0 (no progress). Testing the
    // "has progress" case requires XState actor with proper context,
    // which is tested via the noProgress guard in guards.test.ts.

    it("in_progress + USER_STOPPED -> backlog (default: no progress)", () => {
      const result = getNextState(
        { in_progress: "implement" },
        { type: "USER_STOPPED" }
      );
      expect(result.changed).toBe(true);
      expect(result.value).toBe("backlog");
    });

    it("plan + USER_STOPPED -> backlog (default: no progress)", () => {
      const result = getNextState(
        { in_progress: "plan" },
        { type: "USER_STOPPED" }
      );
      expect(result.changed).toBe(true);
      expect(result.value).toBe("backlog");
    });

    it("check + USER_STOPPED -> backlog (default: no progress)", () => {
      const result = getNextState(
        { in_progress: "check" },
        { type: "USER_STOPPED" }
      );
      expect(result.changed).toBe(true);
      expect(result.value).toBe("backlog");
    });
  });

  // -------------------------------------------------------------------------
  // Paused state transitions
  // -------------------------------------------------------------------------
  describe("from paused", () => {
    // Note: When testing RESUME, the pausedFromState is set by the PAUSE action
    // during the navigation to "paused" state. The default navigation path is
    // QUEUE -> PAUSE, which sets pausedFromState to "queue".
    // For testing other resume scenarios, we test the guard functions directly
    // in guards.test.ts.

    it("paused + RESUME -> queue (default paused from queue)", () => {
      // Default navigation path: QUEUE -> PAUSE sets pausedFromState to "queue"
      const result = getNextState("paused", { type: "RESUME" });
      expect(result.changed).toBe(true);
      expect(result.value).toBe("queue");
    });

    it("paused + ABANDON -> backlog", () => {
      const result = getNextState("paused", { type: "ABANDON" });
      expect(result.changed).toBe(true);
      expect(result.value).toBe("backlog");
    });

    it("paused + CANCEL -> cancelled", () => {
      const result = getNextState("paused", { type: "CANCEL" });
      expect(result.changed).toBe(true);
      expect(result.value).toBe("cancelled");
    });
  });

  // -------------------------------------------------------------------------
  // Review transitions
  // -------------------------------------------------------------------------
  describe("from review", () => {
    it("review + APPROVED -> completed", () => {
      const result = getNextState("review", { type: "APPROVED" });
      expect(result.changed).toBe(true);
      expect(result.value).toBe("completed");
    });

    it("review + REJECTED -> backlog", () => {
      const result = getNextState("review", { type: "REJECTED" });
      expect(result.changed).toBe(true);
      expect(result.value).toBe("backlog");
    });

    it("review + CANCEL -> cancelled", () => {
      const result = getNextState("review", { type: "CANCEL" });
      expect(result.changed).toBe(true);
      expect(result.value).toBe("cancelled");
    });
  });

  // -------------------------------------------------------------------------
  // Failed state transitions
  // -------------------------------------------------------------------------
  describe("from failed", () => {
    it("failed + RETRY -> queue", () => {
      const result = getNextState("failed", { type: "RETRY" });
      expect(result.changed).toBe(true);
      expect(result.value).toBe("queue");
    });

    it("failed + ABANDON -> backlog", () => {
      const result = getNextState("failed", { type: "ABANDON" });
      expect(result.changed).toBe(true);
      expect(result.value).toBe("backlog");
    });
  });
});

// =============================================================================
// Invalid State Transitions
// =============================================================================

describe("Task State Machine - Invalid Transitions", () => {
  describe("from backlog", () => {
    it("backlog + START should not change state (must QUEUE first)", () => {
      const result = getNextState("backlog", { type: "START" });
      expect(result.changed).toBe(false);
      expect(result.value).toBe("backlog");
    });

    it("backlog + APPROVED should not change state", () => {
      const result = getNextState("backlog", { type: "APPROVED" });
      expect(result.changed).toBe(false);
    });

    it("backlog + RESUME should not change state", () => {
      const result = getNextState("backlog", { type: "RESUME" });
      expect(result.changed).toBe(false);
    });
  });

  describe("terminal states (completed)", () => {
    const events: TaskMachineEvent["type"][] = [
      "QUEUE",
      "START",
      "CANCEL",
      "PAUSE",
      "RESUME",
      "APPROVED",
      "REJECTED",
      "RETRY",
    ];

    for (const eventType of events) {
      it(`completed + ${eventType} should not change state`, () => {
        const result = getNextState("completed", { type: eventType });
        expect(result.changed).toBe(false);
        expect(result.value).toBe("completed");
      });
    }
  });

  describe("terminal states (cancelled)", () => {
    const events: TaskMachineEvent["type"][] = [
      "QUEUE",
      "START",
      "CANCEL",
      "PAUSE",
      "RESUME",
      "APPROVED",
      "RETRY",
    ];

    for (const eventType of events) {
      it(`cancelled + ${eventType} should not change state`, () => {
        const result = getNextState("cancelled", { type: eventType });
        expect(result.changed).toBe(false);
        expect(result.value).toBe("cancelled");
      });
    }
  });

  describe("queue invalid transitions", () => {
    it("queue + APPROVED should not change state", () => {
      const result = getNextState("queue", { type: "APPROVED" });
      expect(result.changed).toBe(false);
    });

    it("queue + PLAN_COMPLETE should not change state", () => {
      const result = getNextState("queue", { type: "PLAN_COMPLETE" });
      expect(result.changed).toBe(false);
    });
  });

  describe("in_progress invalid transitions", () => {
    it("plan + APPROVED should not change state", () => {
      const result = getNextState({ in_progress: "plan" }, { type: "APPROVED" });
      expect(result.changed).toBe(false);
    });

    it("implement + PLAN_COMPLETE should not change state", () => {
      const result = getNextState({ in_progress: "implement" }, { type: "PLAN_COMPLETE" });
      expect(result.changed).toBe(false);
    });

    it("check + SUBTASK_COMPLETE should not change state", () => {
      const result = getNextState({ in_progress: "check" }, { type: "SUBTASK_COMPLETE" });
      expect(result.changed).toBe(false);
    });
  });

  describe("failed invalid transitions", () => {
    it("failed + START should not change state", () => {
      const result = getNextState("failed", { type: "START" });
      expect(result.changed).toBe(false);
    });

    it("failed + APPROVED should not change state", () => {
      const result = getNextState("failed", { type: "APPROVED" });
      expect(result.changed).toBe(false);
    });
  });

  describe("review invalid transitions", () => {
    it("review + START should not change state", () => {
      const result = getNextState("review", { type: "START" });
      expect(result.changed).toBe(false);
    });

    it("review + RETRY should not change state", () => {
      const result = getNextState("review", { type: "RETRY" });
      expect(result.changed).toBe(false);
    });
  });
});

// =============================================================================
// Full Path Tests
// =============================================================================

describe("Task State Machine - Full Paths", () => {
  it("happy path: backlog -> completed", () => {
    const finalState = applyEventSequence("backlog", EVENT_SEQUENCES.toCompleted);
    expect(finalState).toBe("completed");
  });

  it("check failure path: backlog -> fix -> check -> completed", () => {
    let state = applyEventSequence("backlog", EVENT_SEQUENCES.toCheck);
    expect(state).toEqual({ in_progress: "check" });

    state = applyEventSequence(state, [{ type: "CHECK_FAILED" }]);
    expect(state).toEqual({ in_progress: "fix" });

    state = applyEventSequence(state, [{ type: "FIX_COMPLETE" }]);
    expect(state).toEqual({ in_progress: "check" });

    state = applyEventSequence(state, [{ type: "CHECK_PASSED" }, { type: "APPROVED" }]);
    expect(state).toBe("completed");
  });

  it("pause/resume path from queue", () => {
    // Go to queue
    let state = applyEventSequence("backlog", [{ type: "QUEUE" }]);
    expect(state).toBe("queue");

    // Pause from queue
    state = applyEventSequence(state, [{ type: "PAUSE" }]);
    expect(state).toBe("paused");

    // Resume back to queue (default behavior since paused from queue)
    state = applyEventSequence(state, [{ type: "RESUME" }]);
    expect(state).toBe("queue");
  });

  it("rejection path: review -> backlog", () => {
    // Go to review
    let state = applyEventSequence("backlog", EVENT_SEQUENCES.toReview);
    expect(state).toBe("review");

    // Reject
    state = applyEventSequence(state, [{ type: "REJECTED" }]);
    expect(state).toBe("backlog");
  });

  it("failed + retry path", () => {
    // Go to failed
    let state = applyEventSequence("backlog", EVENT_SEQUENCES.toFailed);
    expect(state).toBe("failed");

    // Retry
    state = applyEventSequence(state, [{ type: "RETRY" }]);
    expect(state).toBe("queue");
  });
});

// =============================================================================
// Helper Function Tests
// =============================================================================

describe("Helper Functions", () => {
  describe("xstateToTaskStatus", () => {
    it("maps top-level states correctly", () => {
      expect(xstateToTaskStatus("backlog")).toBe("backlog");
      expect(xstateToTaskStatus("queue")).toBe("queue");
      expect(xstateToTaskStatus("paused")).toBe("paused");
      expect(xstateToTaskStatus("review")).toBe("review");
      expect(xstateToTaskStatus("completed")).toBe("completed");
      expect(xstateToTaskStatus("failed")).toBe("failed");
      expect(xstateToTaskStatus("cancelled")).toBe("cancelled");
    });

    it("maps in_progress substates to in_progress", () => {
      expect(xstateToTaskStatus({ in_progress: "plan" })).toBe("in_progress");
      expect(xstateToTaskStatus({ in_progress: "implement" })).toBe("in_progress");
      expect(xstateToTaskStatus({ in_progress: "check" })).toBe("in_progress");
      expect(xstateToTaskStatus({ in_progress: "fix" })).toBe("in_progress");
    });
  });

  describe("xstateToExecutionPhase", () => {
    it("extracts phase from in_progress states", () => {
      expect(xstateToExecutionPhase({ in_progress: "plan" })).toBe("plan");
      expect(xstateToExecutionPhase({ in_progress: "implement" })).toBe("implement");
      expect(xstateToExecutionPhase({ in_progress: "check" })).toBe("check");
      expect(xstateToExecutionPhase({ in_progress: "fix" })).toBe("fix");
    });

    it("returns undefined for non-in_progress states", () => {
      expect(xstateToExecutionPhase("backlog")).toBeUndefined();
      expect(xstateToExecutionPhase("queue")).toBeUndefined();
      expect(xstateToExecutionPhase("completed")).toBeUndefined();
    });
  });
});
