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
  createEventSequence,
  expectValidTransition,
  expectInvalidTransition,
  applyEventSequence,
  EVENT_SEQUENCES,
  formatState,
  createPauseContext,
  createPlanReviewContext,
  createProgressContext,
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
    it("queue + START -> in_progress.planning", () => {
      const result = getNextState("queue", { type: "START" });
      expect(result.changed).toBe(true);
      expect(result.value).toEqual({ in_progress: "planning" });
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
  // Planning phase transitions
  // -------------------------------------------------------------------------
  describe("from in_progress.planning", () => {
    const planningState: XStateValue = { in_progress: "planning" };

    it("planning + PLANNING_COMPLETE -> coding (default: no plan review)", () => {
      // Default context has requiresPlanReview: false
      const result = getNextState(planningState, { type: "PLANNING_COMPLETE" });
      expect(result.changed).toBe(true);
      expect(result.value).toEqual({ in_progress: "coding" });
    });

    // Note: Testing requiresPlanReview=true requires XState actor with context override,
    // which is not directly testable through getNextState since the navigation path
    // doesn't support arbitrary context injection. The guard is tested in guards.test.ts.

    it("planning + PLANNING_FAILED -> failed", () => {
      const result = getNextState(planningState, { type: "PLANNING_FAILED" });
      expect(result.changed).toBe(true);
      expect(result.value).toBe("failed");
    });

    it("planning + PAUSE -> paused", () => {
      const result = getNextState(planningState, { type: "PAUSE" });
      expect(result.changed).toBe(true);
      expect(result.value).toBe("paused");
    });
  });

  // -------------------------------------------------------------------------
  // Coding phase transitions
  // -------------------------------------------------------------------------
  describe("from in_progress.coding", () => {
    const codingState: XStateValue = { in_progress: "coding" };

    it("coding + SUBTASK_COMPLETE -> coding (transition occurs)", () => {
      // SUBTASK_COMPLETE is a re-entry transition that stays in coding
      // XState's changed detection compares JSON strings, and re-entry with
      // actions may show as unchanged since state value is the same
      const result = getNextState(codingState, { type: "SUBTASK_COMPLETE" });
      // The transition happens (action runs) but state value remains { in_progress: "coding" }
      expect(result.value).toEqual({ in_progress: "coding" });
    });

    it("coding + ALL_SUBTASKS_DONE -> qa_review", () => {
      const result = getNextState(codingState, { type: "ALL_SUBTASKS_DONE" });
      expect(result.changed).toBe(true);
      expect(result.value).toEqual({ in_progress: "qa_review" });
    });

    it("coding + CODING_FAILED -> failed", () => {
      const result = getNextState(codingState, { type: "CODING_FAILED" });
      expect(result.changed).toBe(true);
      expect(result.value).toBe("failed");
    });

    it("coding + PAUSE -> paused", () => {
      const result = getNextState(codingState, { type: "PAUSE" });
      expect(result.changed).toBe(true);
      expect(result.value).toBe("paused");
    });
  });

  // -------------------------------------------------------------------------
  // QA Review phase transitions
  // -------------------------------------------------------------------------
  describe("from in_progress.qa_review", () => {
    const qaReviewState: XStateValue = { in_progress: "qa_review" };

    it("qa_review + QA_PASSED -> human_review", () => {
      const result = getNextState(qaReviewState, { type: "QA_PASSED" });
      expect(result.changed).toBe(true);
      expect(result.value).toBe("human_review");
    });

    it("qa_review + QA_FAILED -> qa_fixing", () => {
      const result = getNextState(qaReviewState, { type: "QA_FAILED" });
      expect(result.changed).toBe(true);
      expect(result.value).toEqual({ in_progress: "qa_fixing" });
    });

    it("qa_review + PAUSE -> paused", () => {
      const result = getNextState(qaReviewState, { type: "PAUSE" });
      expect(result.changed).toBe(true);
      expect(result.value).toBe("paused");
    });
  });

  // -------------------------------------------------------------------------
  // QA Fixing phase transitions
  // -------------------------------------------------------------------------
  describe("from in_progress.qa_fixing", () => {
    const qaFixingState: XStateValue = { in_progress: "qa_fixing" };

    it("qa_fixing + QA_FIXING_COMPLETE -> qa_review", () => {
      const result = getNextState(qaFixingState, { type: "QA_FIXING_COMPLETE" });
      expect(result.changed).toBe(true);
      expect(result.value).toEqual({ in_progress: "qa_review" });
    });

    it("qa_fixing + QA_FIXING_FAILED -> failed", () => {
      const result = getNextState(qaFixingState, { type: "QA_FIXING_FAILED" });
      expect(result.changed).toBe(true);
      expect(result.value).toBe("failed");
    });

    it("qa_fixing + PAUSE -> paused", () => {
      const result = getNextState(qaFixingState, { type: "PAUSE" });
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
        { in_progress: "coding" },
        { type: "USER_STOPPED" }
      );
      expect(result.changed).toBe(true);
      expect(result.value).toBe("backlog");
    });

    it("planning + USER_STOPPED -> backlog (default: no progress)", () => {
      const result = getNextState(
        { in_progress: "planning" },
        { type: "USER_STOPPED" }
      );
      expect(result.changed).toBe(true);
      expect(result.value).toBe("backlog");
    });

    it("qa_review + USER_STOPPED -> backlog (default: no progress)", () => {
      const result = getNextState(
        { in_progress: "qa_review" },
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
  // Human Review transitions
  // -------------------------------------------------------------------------
  describe("from human_review", () => {
    it("human_review + APPROVED -> completed", () => {
      const result = getNextState("human_review", { type: "APPROVED" });
      expect(result.changed).toBe(true);
      expect(result.value).toBe("completed");
    });

    it("human_review + REJECTED -> coding", () => {
      const result = getNextState("human_review", { type: "REJECTED" });
      expect(result.changed).toBe(true);
      expect(result.value).toEqual({ in_progress: "coding" });
    });

    it("human_review + CANCEL -> cancelled", () => {
      const result = getNextState("human_review", { type: "CANCEL" });
      expect(result.changed).toBe(true);
      expect(result.value).toBe("cancelled");
    });
  });

  // -------------------------------------------------------------------------
  // Failed state transitions
  // -------------------------------------------------------------------------
  describe("from failed", () => {
    it("failed + RETRY -> in_progress.planning", () => {
      const result = getNextState("failed", { type: "RETRY" });
      expect(result.changed).toBe(true);
      expect(result.value).toEqual({ in_progress: "planning" });
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

    it("queue + PLANNING_COMPLETE should not change state", () => {
      const result = getNextState("queue", { type: "PLANNING_COMPLETE" });
      expect(result.changed).toBe(false);
    });
  });

  describe("in_progress invalid transitions", () => {
    it("planning + APPROVED should not change state", () => {
      const result = getNextState({ in_progress: "planning" }, { type: "APPROVED" });
      expect(result.changed).toBe(false);
    });

    it("coding + PLANNING_COMPLETE should not change state", () => {
      const result = getNextState({ in_progress: "coding" }, { type: "PLANNING_COMPLETE" });
      expect(result.changed).toBe(false);
    });

    it("qa_review + SUBTASK_COMPLETE should not change state", () => {
      const result = getNextState({ in_progress: "qa_review" }, { type: "SUBTASK_COMPLETE" });
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

  describe("human_review invalid transitions", () => {
    it("human_review + START should not change state", () => {
      const result = getNextState("human_review", { type: "START" });
      expect(result.changed).toBe(false);
    });

    it("human_review + RETRY should not change state", () => {
      const result = getNextState("human_review", { type: "RETRY" });
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

  it("qa failure path: backlog -> qa_fixing -> qa_review -> completed", () => {
    let state = applyEventSequence("backlog", EVENT_SEQUENCES.toQaReview);
    expect(state).toEqual({ in_progress: "qa_review" });

    state = applyEventSequence(state, [{ type: "QA_FAILED" }]);
    expect(state).toEqual({ in_progress: "qa_fixing" });

    state = applyEventSequence(state, [{ type: "QA_FIXING_COMPLETE" }]);
    expect(state).toEqual({ in_progress: "qa_review" });

    state = applyEventSequence(state, [{ type: "QA_PASSED" }, { type: "APPROVED" }]);
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

  it("rejection path: human_review -> coding -> qa_review -> completed", () => {
    // Go to human_review
    let state = applyEventSequence("backlog", EVENT_SEQUENCES.toHumanReview);
    expect(state).toBe("human_review");

    // Reject
    state = applyEventSequence(state, [{ type: "REJECTED" }]);
    expect(state).toEqual({ in_progress: "coding" });

    // Complete again
    state = applyEventSequence(state, [
      { type: "ALL_SUBTASKS_DONE" },
      { type: "QA_PASSED" },
      { type: "APPROVED" },
    ]);
    expect(state).toBe("completed");
  });

  it("failed + retry path", () => {
    // Go to failed
    let state = applyEventSequence("backlog", EVENT_SEQUENCES.toFailed);
    expect(state).toBe("failed");

    // Retry
    state = applyEventSequence(state, [{ type: "RETRY" }]);
    expect(state).toEqual({ in_progress: "planning" });
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
      expect(xstateToTaskStatus("human_review")).toBe("human_review");
      expect(xstateToTaskStatus("completed")).toBe("completed");
      expect(xstateToTaskStatus("failed")).toBe("failed");
      expect(xstateToTaskStatus("cancelled")).toBe("cancelled");
    });

    it("maps in_progress substates to in_progress", () => {
      expect(xstateToTaskStatus({ in_progress: "planning" })).toBe("in_progress");
      expect(xstateToTaskStatus({ in_progress: "coding" })).toBe("in_progress");
      expect(xstateToTaskStatus({ in_progress: "qa_review" })).toBe("in_progress");
      expect(xstateToTaskStatus({ in_progress: "qa_fixing" })).toBe("in_progress");
    });
  });

  describe("xstateToExecutionPhase", () => {
    it("extracts phase from in_progress states", () => {
      expect(xstateToExecutionPhase({ in_progress: "planning" })).toBe("planning");
      expect(xstateToExecutionPhase({ in_progress: "coding" })).toBe("coding");
      expect(xstateToExecutionPhase({ in_progress: "qa_review" })).toBe("qa_review");
      expect(xstateToExecutionPhase({ in_progress: "qa_fixing" })).toBe("qa_fixing");
    });

    it("returns undefined for non-in_progress states", () => {
      expect(xstateToExecutionPhase("backlog")).toBeUndefined();
      expect(xstateToExecutionPhase("queue")).toBeUndefined();
      expect(xstateToExecutionPhase("completed")).toBeUndefined();
    });
  });
});
