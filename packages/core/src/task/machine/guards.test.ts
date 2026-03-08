/**
 * Guards Tests
 *
 * Tests all guard functions used in the task state machine.
 * Guards determine which transition to take when multiple are possible.
 */

import { describe, it, expect } from "vitest";
import {
  noPlanReviewRequired,
  noProgress,
  pausedFromQueue,
  pausedFromPlanning,
  pausedFromCoding,
  pausedFromQaReview,
  pausedFromQaFixing,
} from "./guards";
import { createMockContext, createPausedContext } from "../__fixtures__/task-fixtures";

// =============================================================================
// noPlanReviewRequired Guard
// =============================================================================

describe("noPlanReviewRequired", () => {
  it("returns true when requiresPlanReview is false", () => {
    const context = createMockContext({ requiresPlanReview: false });
    expect(noPlanReviewRequired({ context })).toBe(true);
  });

  it("returns false when requiresPlanReview is true", () => {
    const context = createMockContext({ requiresPlanReview: true });
    expect(noPlanReviewRequired({ context })).toBe(false);
  });

  it("returns true when requiresPlanReview is undefined (defaults to false)", () => {
    const context = createMockContext();
    expect(noPlanReviewRequired({ context })).toBe(true);
  });
});

// =============================================================================
// noProgress Guard
// =============================================================================

describe("noProgress", () => {
  it("returns true when currentSubtaskIndex is 0", () => {
    const context = createMockContext({ currentSubtaskIndex: 0 });
    expect(noProgress({ context })).toBe(true);
  });

  it("returns false when currentSubtaskIndex is 1", () => {
    const context = createMockContext({ currentSubtaskIndex: 1 });
    expect(noProgress({ context })).toBe(false);
  });

  it("returns false when currentSubtaskIndex is greater than 1", () => {
    const context = createMockContext({ currentSubtaskIndex: 5 });
    expect(noProgress({ context })).toBe(false);
  });
});

// =============================================================================
// pausedFromQueue Guard
// =============================================================================

describe("pausedFromQueue", () => {
  it("returns true when paused from queue (using paused_snapshot)", () => {
    const context = createPausedContext("queue");
    expect(pausedFromQueue({ context })).toBe(true);
  });

  it("returns true when paused from queue (using legacy pausedFromState)", () => {
    const context = createMockContext({ pausedFromState: "queue" });
    expect(pausedFromQueue({ context })).toBe(true);
  });

  it("returns false when paused from planning", () => {
    const context = createPausedContext({ in_progress: "planning" });
    expect(pausedFromQueue({ context })).toBe(false);
  });

  it("returns false when no paused state", () => {
    const context = createMockContext();
    expect(pausedFromQueue({ context })).toBe(false);
  });
});

// =============================================================================
// pausedFromPlanning Guard
// =============================================================================

describe("pausedFromPlanning", () => {
  it("returns true when paused from planning (using paused_snapshot)", () => {
    const context = createPausedContext({ in_progress: "planning" });
    expect(pausedFromPlanning({ context })).toBe(true);
  });

  it("returns true when paused from planning (using legacy pausedFromState)", () => {
    const context = createMockContext({
      pausedFromState: { in_progress: "planning" },
    });
    expect(pausedFromPlanning({ context })).toBe(true);
  });

  it("returns false when paused from queue", () => {
    const context = createPausedContext("queue");
    expect(pausedFromPlanning({ context })).toBe(false);
  });

  it("returns false when paused from coding", () => {
    const context = createPausedContext({ in_progress: "coding" });
    expect(pausedFromPlanning({ context })).toBe(false);
  });

  it("returns false when no paused state", () => {
    const context = createMockContext();
    expect(pausedFromPlanning({ context })).toBe(false);
  });
});

// =============================================================================
// pausedFromCoding Guard
// =============================================================================

describe("pausedFromCoding", () => {
  it("returns true when paused from coding (using paused_snapshot)", () => {
    const context = createPausedContext({ in_progress: "coding" });
    expect(pausedFromCoding({ context })).toBe(true);
  });

  it("returns true when paused from coding (using legacy pausedFromState)", () => {
    const context = createMockContext({
      pausedFromState: { in_progress: "coding" },
    });
    expect(pausedFromCoding({ context })).toBe(true);
  });

  it("returns false when paused from queue", () => {
    const context = createPausedContext("queue");
    expect(pausedFromCoding({ context })).toBe(false);
  });

  it("returns false when paused from planning", () => {
    const context = createPausedContext({ in_progress: "planning" });
    expect(pausedFromCoding({ context })).toBe(false);
  });

  it("returns false when no paused state", () => {
    const context = createMockContext();
    expect(pausedFromCoding({ context })).toBe(false);
  });
});

// =============================================================================
// pausedFromQaReview Guard
// =============================================================================

describe("pausedFromQaReview", () => {
  it("returns true when paused from qa_review (using paused_snapshot)", () => {
    const context = createPausedContext({ in_progress: "qa_review" });
    expect(pausedFromQaReview({ context })).toBe(true);
  });

  it("returns true when paused from qa_review (using legacy pausedFromState)", () => {
    const context = createMockContext({
      pausedFromState: { in_progress: "qa_review" },
    });
    expect(pausedFromQaReview({ context })).toBe(true);
  });

  it("returns false when paused from coding", () => {
    const context = createPausedContext({ in_progress: "coding" });
    expect(pausedFromQaReview({ context })).toBe(false);
  });

  it("returns false when paused from qa_fixing", () => {
    const context = createPausedContext({ in_progress: "qa_fixing" });
    expect(pausedFromQaReview({ context })).toBe(false);
  });

  it("returns false when no paused state", () => {
    const context = createMockContext();
    expect(pausedFromQaReview({ context })).toBe(false);
  });
});

// =============================================================================
// pausedFromQaFixing Guard
// =============================================================================

describe("pausedFromQaFixing", () => {
  it("returns true when paused from qa_fixing (using paused_snapshot)", () => {
    const context = createPausedContext({ in_progress: "qa_fixing" });
    expect(pausedFromQaFixing({ context })).toBe(true);
  });

  it("returns true when paused from qa_fixing (using legacy pausedFromState)", () => {
    const context = createMockContext({
      pausedFromState: { in_progress: "qa_fixing" },
    });
    expect(pausedFromQaFixing({ context })).toBe(true);
  });

  it("returns false when paused from qa_review", () => {
    const context = createPausedContext({ in_progress: "qa_review" });
    expect(pausedFromQaFixing({ context })).toBe(false);
  });

  it("returns false when paused from coding", () => {
    const context = createPausedContext({ in_progress: "coding" });
    expect(pausedFromQaFixing({ context })).toBe(false);
  });

  it("returns false when no paused state", () => {
    const context = createMockContext();
    expect(pausedFromQaFixing({ context })).toBe(false);
  });
});

// =============================================================================
// Backward Compatibility Tests
// =============================================================================

describe("Guard backward compatibility", () => {
  describe("prefers paused_snapshot over pausedFromState", () => {
    it("uses paused_snapshot.from_state when both are present", () => {
      const context = createMockContext({
        pausedFromState: "queue",
        paused_snapshot: {
          from_state: { in_progress: "coding" },
          subtask_index: 0,
          paused_at: new Date().toISOString(),
        },
      });

      // Should use paused_snapshot (coding), not pausedFromState (queue)
      expect(pausedFromQueue({ context })).toBe(false);
      expect(pausedFromCoding({ context })).toBe(true);
    });
  });

  describe("falls back to pausedFromState when paused_snapshot is absent", () => {
    it("uses pausedFromState when paused_snapshot is undefined", () => {
      const context = createMockContext({
        pausedFromState: { in_progress: "planning" },
        paused_snapshot: undefined,
      });

      expect(pausedFromPlanning({ context })).toBe(true);
      expect(pausedFromCoding({ context })).toBe(false);
    });
  });
});

// =============================================================================
// Edge Cases and Boundary Conditions
// =============================================================================

describe("Guard edge cases", () => {
  describe("noProgress boundary conditions", () => {
    it("returns false for currentSubtaskIndex = -1 (invalid but handled)", () => {
      // TypeScript allows any number, so test defensive behavior
      const context = createMockContext({ currentSubtaskIndex: -1 });
      expect(noProgress({ context })).toBe(false);
    });

    it("returns false for very large currentSubtaskIndex", () => {
      const context = createMockContext({ currentSubtaskIndex: 999999 });
      expect(noProgress({ context })).toBe(false);
    });
  });

  describe("noPlanReviewRequired edge cases", () => {
    it("returns true for undefined requiresPlanReview (falsy)", () => {
      const context = createMockContext({ requiresPlanReview: undefined });
      expect(noPlanReviewRequired({ context })).toBe(true);
    });

    it("handles null requiresPlanReview as falsy", () => {
      // @ts-expect-error - testing runtime behavior with invalid value
      const context = createMockContext({ requiresPlanReview: null });
      expect(noPlanReviewRequired({ context })).toBe(true);
    });
  });

  describe("pausedFrom* with empty context", () => {
    it("returns false when both pausedFromState and paused_snapshot are undefined", () => {
      const context = createMockContext({
        pausedFromState: undefined,
        paused_snapshot: undefined,
      });

      expect(pausedFromQueue({ context })).toBe(false);
      expect(pausedFromPlanning({ context })).toBe(false);
      expect(pausedFromCoding({ context })).toBe(false);
      expect(pausedFromQaReview({ context })).toBe(false);
      expect(pausedFromQaFixing({ context })).toBe(false);
    });

    it("returns false for mismatched state type (string vs object)", () => {
      // pausedFromState is a string, but checking for object
      const context = createMockContext({
        pausedFromState: "queue",
      });

      expect(pausedFromPlanning({ context })).toBe(false);
      expect(pausedFromCoding({ context })).toBe(false);
    });

    it("returns false for mismatched state type (object vs string)", () => {
      // pausedFromState is an object, but checking for string
      const context = createMockContext({
        pausedFromState: { in_progress: "coding" },
      });

      expect(pausedFromQueue({ context })).toBe(false);
    });
  });

  describe("paused_snapshot with null from_state", () => {
    it("handles null from_state gracefully", () => {
      const context = createMockContext({
        paused_snapshot: {
          // @ts-expect-error - testing runtime behavior with invalid value
          from_state: null,
          subtask_index: 0,
          paused_at: new Date().toISOString(),
        },
      });

      expect(pausedFromQueue({ context })).toBe(false);
      expect(pausedFromCoding({ context })).toBe(false);
    });
  });
});
