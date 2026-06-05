import { describe, it, expect, vi, afterEach } from "vitest";
import { ActivityTracker, type ActivityCallbacks } from "../primitives/activity-tracker.js";

function mockCallbacks(): ActivityCallbacks {
  return {
    sendThinkingIndicator: vi.fn().mockResolvedValue(undefined),
    updateThinkingIndicator: vi.fn().mockResolvedValue(undefined),
    removeThinkingIndicator: vi.fn().mockResolvedValue(undefined),
  };
}

describe("ActivityTracker", () => {
  let tracker: ActivityTracker;

  afterEach(() => {
    tracker?.destroy();
  });

  it("calls removeThinkingIndicator when maxThinkingDuration is exceeded", async () => {
    tracker = new ActivityTracker({
      thinkingRefreshInterval: 50,
      maxThinkingDuration: 100,
    });

    const callbacks = mockCallbacks();
    tracker.onThinkingStart("sess-1", callbacks);

    await new Promise((r) => setTimeout(r, 200));

    expect(callbacks.removeThinkingIndicator).toHaveBeenCalled();
  });
});
