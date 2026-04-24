import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/plugin-os", () => ({
  type: vi.fn(() => "linux"),
}));

import { type as osType } from "@tauri-apps/plugin-os";
import { isMobile, isDesktop, getPlatformType, _resetForTesting } from "./platform";

describe("platform detection", () => {
  beforeEach(() => {
    _resetForTesting();
    vi.clearAllMocks();
  });

  it("detects desktop platforms", () => {
    vi.mocked(osType).mockReturnValue("linux");
    expect(isDesktop()).toBe(true);
    expect(isMobile()).toBe(false);
  });

  it("detects android as mobile", () => {
    vi.mocked(osType).mockReturnValue("android");
    expect(isMobile()).toBe(true);
    expect(isDesktop()).toBe(false);
  });

  it("detects ios as mobile", () => {
    _resetForTesting();
    vi.mocked(osType).mockReturnValue("ios");
    expect(isMobile()).toBe(true);
    expect(isDesktop()).toBe(false);
  });

  it("caches the result", () => {
    vi.mocked(osType).mockReturnValue("macos");
    getPlatformType();
    getPlatformType();
    expect(osType).toHaveBeenCalledTimes(1);
  });
});
