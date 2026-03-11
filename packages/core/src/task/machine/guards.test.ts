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
  pausedFromPlan,
  pausedFromImplement,
  pausedFromCheck,
  pausedFromFix,
} from "./guards";
import { createMockContext, createPausedContext } from "../__fixtures__/task-fixtures";
import type { XStateValue } from "./task-machine";

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

  it("returns false when paused from plan", () => {
    const context = createPausedContext({ in_progress: "plan" });
    expect(pausedFromQueue({ context })).toBe(false);
  });

  it("returns false when no paused state", () => {
    const context = createMockContext();
    expect(pausedFromQueue({ context })).toBe(false);
  });
});

// =============================================================================
// pausedFromPlan Guard
// =============================================================================

describe("pausedFromPlan", () => {
  it("returns true when paused from plan (using paused_snapshot)", () => {
    const context = createPausedContext({ in_progress: "plan" });
    expect(pausedFromPlan({ context })).toBe(true);
  });

  it("returns true when paused from plan (using legacy pausedFromState)", () => {
    const context = createMockContext({
      pausedFromState: { in_progress: "plan" },
    });
    expect(pausedFromPlan({ context })).toBe(true);
  });

  it("returns false when paused from queue", () => {
    const context = createPausedContext("queue");
    expect(pausedFromPlan({ context })).toBe(false);
  });

  it("returns false when paused from implement", () => {
    const context = createPausedContext({ in_progress: "implement" });
    expect(pausedFromPlan({ context })).toBe(false);
  });

  it("returns false when no paused state", () => {
    const context = createMockContext();
    expect(pausedFromPlan({ context })).toBe(false);
  });
});

// =============================================================================
// pausedFromImplement Guard
// =============================================================================

describe("pausedFromImplement", () => {
  it("returns true when paused from implement (using paused_snapshot)", () => {
    const context = createPausedContext({ in_progress: "implement" });
    expect(pausedFromImplement({ context })).toBe(true);
  });

  it("returns true when paused from implement (using legacy pausedFromState)", () => {
    const context = createMockContext({
      pausedFromState: { in_progress: "implement" },
    });
    expect(pausedFromImplement({ context })).toBe(true);
  });

  it("returns false when paused from queue", () => {
    const context = createPausedContext("queue");
    expect(pausedFromImplement({ context })).toBe(false);
  });

  it("returns false when paused from plan", () => {
    const context = createPausedContext({ in_progress: "plan" });
    expect(pausedFromImplement({ context })).toBe(false);
  });

  it("returns false when no paused state", () => {
    const context = createMockContext();
    expect(pausedFromImplement({ context })).toBe(false);
  });
});

// =============================================================================
// pausedFromCheck Guard
// =============================================================================

describe("pausedFromCheck", () => {
  it("returns true when paused from check (using paused_snapshot)", () => {
    const context = createPausedContext({ in_progress: "check" });
    expect(pausedFromCheck({ context })).toBe(true);
  });

  it("returns true when paused from check (using legacy pausedFromState)", () => {
    const context = createMockContext({
      pausedFromState: { in_progress: "check" },
    });
    expect(pausedFromCheck({ context })).toBe(true);
  });

  it("returns false when paused from implement", () => {
    const context = createPausedContext({ in_progress: "implement" });
    expect(pausedFromCheck({ context })).toBe(false);
  });

  it("returns false when paused from fix", () => {
    const context = createPausedContext({ in_progress: "fix" });
    expect(pausedFromCheck({ context })).toBe(false);
  });

  it("returns false when no paused state", () => {
    const context = createMockContext();
    expect(pausedFromCheck({ context })).toBe(false);
  });
});

// =============================================================================
// pausedFromFix Guard
// =============================================================================

describe("pausedFromFix", () => {
  it("returns true when paused from fix (using paused_snapshot)", () => {
    const context = createPausedContext({ in_progress: "fix" });
    expect(pausedFromFix({ context })).toBe(true);
  });

  it("returns true when paused from fix (using legacy pausedFromState)", () => {
    const context = createMockContext({
      pausedFromState: { in_progress: "fix" },
    });
    expect(pausedFromFix({ context })).toBe(true);
  });

  it("returns false when paused from check", () => {
    const context = createPausedContext({ in_progress: "check" });
    expect(pausedFromFix({ context })).toBe(false);
  });

  it("returns false when paused from implement", () => {
    const context = createPausedContext({ in_progress: "implement" });
    expect(pausedFromFix({ context })).toBe(false);
  });

  it("returns false when no paused state", () => {
    const context = createMockContext();
    expect(pausedFromFix({ context })).toBe(false);
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
          from_state: { in_progress: "implement" },
          subtask_index: 0,
          paused_at: new Date().toISOString(),
        },
      });

      // Should use paused_snapshot (implement), not pausedFromState (queue)
      expect(pausedFromQueue({ context })).toBe(false);
      expect(pausedFromImplement({ context })).toBe(true);
    });
  });

  describe("falls back to pausedFromState when paused_snapshot is absent", () => {
    it("uses pausedFromState when paused_snapshot is undefined", () => {
      const context = createMockContext({
        pausedFromState: { in_progress: "plan" },
        paused_snapshot: undefined,
      });

      expect(pausedFromPlan({ context })).toBe(true);
      expect(pausedFromImplement({ context })).toBe(false);
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
      // Note: null is not a valid type for requiresPlanReview but testing runtime behavior
      const context = createMockContext({ requiresPlanReview: null as unknown as boolean });
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
      expect(pausedFromPlan({ context })).toBe(false);
      expect(pausedFromImplement({ context })).toBe(false);
      expect(pausedFromCheck({ context })).toBe(false);
      expect(pausedFromFix({ context })).toBe(false);
    });

    it("returns false for mismatched state type (string vs object)", () => {
      // pausedFromState is a string, but checking for object
      const context = createMockContext({
        pausedFromState: "queue",
      });

      expect(pausedFromPlan({ context })).toBe(false);
      expect(pausedFromImplement({ context })).toBe(false);
    });

    it("returns false for mismatched state type (object vs string)", () => {
      // pausedFromState is an object, but checking for string
      const context = createMockContext({
        pausedFromState: { in_progress: "implement" },
      });

      expect(pausedFromQueue({ context })).toBe(false);
    });
  });

  describe("paused_snapshot with null from_state", () => {
    it("handles null from_state gracefully", () => {
      const context = createMockContext({
        paused_snapshot: {
          // Note: null is not a valid type for from_state but testing runtime behavior
          from_state: null as unknown as XStateValue,
          subtask_index: 0,
          paused_at: new Date().toISOString(),
        },
      });

      expect(pausedFromQueue({ context })).toBe(false);
      expect(pausedFromImplement({ context })).toBe(false);
    });
  });
});
