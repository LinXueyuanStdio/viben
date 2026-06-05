import { describe, it, expect, vi } from "vitest";
import { Session } from "../core/sessions/session.js";
import { formatSummary } from "../plugins/telegram/formatting.js";

// --- Session.promptCount ---

describe("Session.promptCount", () => {
  it("starts at 0", () => {
    const session = new Session({
      channelId: "telegram",
      agentName: "claude",
      agentInstance: {
        prompt: vi.fn(async () => {}),
        on: vi.fn(),
        off: vi.fn(),
        onSessionUpdate: null,
        onPermissionRequest: null,
        sessionId: "a1",
        connect: vi.fn(async () => {}),
        disconnect: vi.fn(),
      } as any,
    });
    expect(session.promptCount).toBe(0);
  });
});

// --- formatSummary ---

describe("formatSummary", () => {
  it("formats with session name", () => {
    const result = formatSummary("Fixed auth bug.", "Fix login");
    expect(result).toContain("Summary — Fix login");
    expect(result).toContain("Fixed auth bug.");
  });

  it("formats without session name", () => {
    const result = formatSummary("Fixed auth bug.");
    expect(result).toContain("Session Summary");
  });
});
