import { describe, it, expect, vi } from "vitest";
import { createConfigSection } from "../config.js";

function makeCore(opts: {
  workspace?: string
  legacySpeechProvider?: string | null
  speechService?: { isSTTAvailable(): boolean } | null
}) {
  return {
    configManager: {
      resolveWorkspace: vi.fn().mockReturnValue(opts.workspace ?? "/home/user/workspace"),
    },
    lifecycleManager: opts.speechService !== undefined
      ? { serviceRegistry: { get: vi.fn().mockReturnValue(opts.speechService) } }
      : undefined,
  } as any;
}

describe("createConfigSection", () => {
  it("shows STT not configured when no speech service and no legacy config", () => {
    const section = createConfigSection(makeCore({ speechService: null }));
    const ctx = section.buildContext!();
    expect(ctx).toContain("STT: Not configured");
  });

  it("shows STT configured when speech service isSTTAvailable returns true", () => {
    const section = createConfigSection(makeCore({
      speechService: { isSTTAvailable: () => true },
    }));
    const ctx = section.buildContext!();
    expect(ctx).toContain("configured ✅");
  });

  it("shows STT not configured when speech service exists but isSTTAvailable returns false", () => {
    const section = createConfigSection(makeCore({
      speechService: { isSTTAvailable: () => false },
    }));
    const ctx = section.buildContext!();
    expect(ctx).toContain("Not configured");
    expect(ctx).not.toContain("✅");
  });

  it("shows STT not configured when no lifecycleManager", () => {
    const section = createConfigSection(makeCore({
      speechService: undefined, // no lifecycleManager
    }));
    const ctx = section.buildContext!();
    expect(ctx).toContain("Not configured");
  });
});
