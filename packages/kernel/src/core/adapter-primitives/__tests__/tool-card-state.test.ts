import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ToolCardState } from "../primitives/tool-card-state.js";
import type { ToolDisplaySpec } from "../display-spec-builder.js";

function makeSpec(overrides: Partial<ToolDisplaySpec> = {}): ToolDisplaySpec {
  return {
    id: "t1",
    kind: "read",
    icon: "📖",
    title: "Read foo.ts",
    description: null,
    command: null,
    outputSummary: null,
    outputContent: null,
    diffStats: null,
    status: "running",
    isNoise: false,
    isHidden: false,
    ...overrides,
  };
}

describe("ToolCardState (refactored)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("first updateFromSpec flushes immediately (no debounce)", () => {
    const onFlush = vi.fn();
    const state = new ToolCardState({ onFlush });
    state.updateFromSpec(makeSpec());
    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush.mock.calls[0][0].specs).toHaveLength(1);
  });

  it("second updateFromSpec (same id) debounces", () => {
    const onFlush = vi.fn();
    const state = new ToolCardState({ onFlush });
    state.updateFromSpec(makeSpec());
    onFlush.mockClear();
    state.updateFromSpec(makeSpec({ status: "completed" }));
    expect(onFlush).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush.mock.calls[0][0].specs[0].status).toBe("completed");
  });

  it("second updateFromSpec (new id) batches — debounce, not immediate", () => {
    const onFlush = vi.fn();
    const state = new ToolCardState({ onFlush });
    state.updateFromSpec(makeSpec({ id: "t1" }));
    onFlush.mockClear();
    state.updateFromSpec(makeSpec({ id: "t2" }));
    expect(onFlush).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush.mock.calls[0][0].specs).toHaveLength(2);
  });

  it("updateFromSpec after finalize is ignored", () => {
    const onFlush = vi.fn();
    const state = new ToolCardState({ onFlush });
    state.updateFromSpec(makeSpec({ id: "t1" }));
    state.finalize();
    onFlush.mockClear();
    state.updateFromSpec(makeSpec({ id: "t1", status: "completed" }));
    expect(onFlush).toHaveBeenCalledTimes(0);
  });

  it("hasContent returns true when specs present", () => {
    const state = new ToolCardState({ onFlush: vi.fn() });
    expect(state.hasContent()).toBe(false);
    state.updateFromSpec(makeSpec());
    expect(state.hasContent()).toBe(true);
  });

  // Additional flow tests:
  it("flow: finalize flushes pending debounce", () => {
    const onFlush = vi.fn();
    const state = new ToolCardState({ onFlush });
    state.updateFromSpec(makeSpec());
    onFlush.mockClear();
    state.updateFromSpec(makeSpec({ status: "completed" }));
    // don't advance timers — finalize should flush immediately
    state.finalize();
    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush.mock.calls[0][0].specs[0].status).toBe("completed");
  });

  it("flow: snapshot totalVisible excludes hidden specs", () => {
    const onFlush = vi.fn();
    const state = new ToolCardState({ onFlush });
    state.updateFromSpec(makeSpec({ id: "t1", isHidden: false }));
    state.updateFromSpec(makeSpec({ id: "t2", isHidden: true }));
    vi.advanceTimersByTime(500);
    const snap = onFlush.mock.calls[onFlush.mock.calls.length - 1][0];
    expect(snap.totalVisible).toBe(1);
  });

  it("flow: allComplete true when all visible specs are done", () => {
    const onFlush = vi.fn();
    const state = new ToolCardState({ onFlush });
    state.updateFromSpec(makeSpec({ id: "t1", status: "running" }));
    state.updateFromSpec(makeSpec({ id: "t1", status: "completed" }));
    vi.advanceTimersByTime(500);
    const snap = onFlush.mock.calls[onFlush.mock.calls.length - 1][0];
    expect(snap.allComplete).toBe(true);
  });

  it("destroy stops debounce without flushing", () => {
    const onFlush = vi.fn();
    const state = new ToolCardState({ onFlush });
    state.updateFromSpec(makeSpec());
    onFlush.mockClear();
    state.updateFromSpec(makeSpec({ status: "completed" })); // schedules debounce
    state.destroy();
    vi.advanceTimersByTime(500); // timer fired but should not call onFlush
    expect(onFlush).not.toHaveBeenCalled();
  });

  // --- Post-finalize guards ---

  it("updatePlan after finalize does not trigger flush", () => {
    const onFlush = vi.fn();
    const state = new ToolCardState({ onFlush });
    state.updateFromSpec(makeSpec());
    state.finalize();
    onFlush.mockClear();
    state.updatePlan([{ content: "Step 1", status: "in_progress", priority: "high" }]);
    vi.advanceTimersByTime(500);
    expect(onFlush).toHaveBeenCalledTimes(0);
    state.destroy();
  });

  it("appendUsage after finalize does not trigger flush", () => {
    const onFlush = vi.fn();
    const state = new ToolCardState({ onFlush });
    state.updateFromSpec(makeSpec());
    state.finalize();
    onFlush.mockClear();
    state.appendUsage({ tokensUsed: 1000, cost: 0.01 });
    vi.advanceTimersByTime(500);
    expect(onFlush).toHaveBeenCalledTimes(0);
    state.destroy();
  });

  // --- Debounce behavior ---

  it("multiple rapid updates within debounce window produce single debounced flush", () => {
    const onFlush = vi.fn();
    const state = new ToolCardState({ onFlush });
    state.updateFromSpec(makeSpec({ id: "t1" }));
    // First call is immediate flush (1 total)
    expect(onFlush).toHaveBeenCalledTimes(1);
    // 5 more rapid updates — all debounced
    state.updateFromSpec(makeSpec({ id: "t2" }));
    state.updateFromSpec(makeSpec({ id: "t3" }));
    state.updateFromSpec(makeSpec({ id: "t4" }));
    state.updateFromSpec(makeSpec({ id: "t5" }));
    state.updateFromSpec(makeSpec({ id: "t6" }));
    expect(onFlush).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(500);
    expect(onFlush).toHaveBeenCalledTimes(2);
    state.destroy();
  });

  it("finalize clears pending debounce so no extra flush fires", () => {
    const onFlush = vi.fn();
    const state = new ToolCardState({ onFlush });
    state.updateFromSpec(makeSpec({ id: "t1" })); // immediate flush
    state.updateFromSpec(makeSpec({ id: "t2" })); // schedules debounce
    // finalize should flush immediately and clear the pending debounce
    state.finalize();
    const countAfterFinalize = onFlush.mock.calls.length;
    vi.advanceTimersByTime(500);
    // No extra flush should have fired after finalize
    expect(onFlush).toHaveBeenCalledTimes(countAfterFinalize);
    state.destroy();
  });

  // --- updatePlan first-flush behavior ---

  it("updatePlan flushes immediately when no specs and isFirstFlush", () => {
    const onFlush = vi.fn();
    const state = new ToolCardState({ onFlush });
    state.updatePlan([{ content: "Step 1", status: "in_progress", priority: "high" }]);
    // Should flush immediately since no specs and isFirstFlush
    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush.mock.calls[0][0].planEntries).toHaveLength(1);
    state.destroy();
  });

  it("updatePlan debounces when specs already exist", () => {
    const onFlush = vi.fn();
    const state = new ToolCardState({ onFlush });
    state.updateFromSpec(makeSpec({ id: "t1" })); // immediate flush, isFirstFlush consumed
    onFlush.mockClear();
    state.updatePlan([{ content: "Step 1", status: "in_progress", priority: "high" }]);
    // Should not flush immediately — debounced
    expect(onFlush).toHaveBeenCalledTimes(0);
    vi.advanceTimersByTime(500);
    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush.mock.calls[0][0].planEntries).toHaveLength(1);
    state.destroy();
  });

  // --- Idempotency ---

  it("finalize is idempotent: double finalize does not double flush", () => {
    const onFlush = vi.fn();
    const state = new ToolCardState({ onFlush });
    state.updateFromSpec(makeSpec());
    onFlush.mockClear();
    state.finalize();
    expect(onFlush).toHaveBeenCalledTimes(1);
    state.finalize();
    expect(onFlush).toHaveBeenCalledTimes(1);
    state.destroy();
  });

  it("destroy after finalize is safe", () => {
    const onFlush = vi.fn();
    const state = new ToolCardState({ onFlush });
    state.updateFromSpec(makeSpec());
    state.finalize();
    // Should not throw
    expect(() => state.destroy()).not.toThrow();
  });

  it("finalize after destroy does not flush", () => {
    const onFlush = vi.fn();
    const state = new ToolCardState({ onFlush });
    state.updateFromSpec(makeSpec());
    onFlush.mockClear();
    state.destroy();
    state.finalize();
    vi.advanceTimersByTime(500);
    expect(onFlush).toHaveBeenCalledTimes(0);
  });
});
