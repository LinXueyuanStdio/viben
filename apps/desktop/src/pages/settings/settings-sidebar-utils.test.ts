import { describe, expect, it } from "vitest";
import type { TabNavigationState } from "@/stores/tab-store";
import {
  findPreviousNonSettingsHistoryIndex,
  getSettingsSectionFromPathname,
  isSettingsPathname,
  isSettingsUrl,
} from "./settings-sidebar-utils";

function state(url: string): TabNavigationState {
  return {
    url,
    breadcrumbStack: [],
  };
}

describe("settings sidebar utils", () => {
  it("detects settings routes only", () => {
    expect(isSettingsPathname("/settings")).toBe(true);
    expect(isSettingsPathname("/settings/general")).toBe(true);
    expect(isSettingsPathname("/settings/gateway")).toBe(true);
    expect(isSettingsPathname("/workspace/global/chat")).toBe(false);
    expect(isSettingsPathname("/settings-panel")).toBe(false);
  });

  it("extracts settings section from pathname with general fallback", () => {
    expect(getSettingsSectionFromPathname("/settings")).toBe("general");
    expect(getSettingsSectionFromPathname("/settings/general")).toBe("general");
    expect(getSettingsSectionFromPathname("/settings/gateway")).toBe("gateway");
    expect(getSettingsSectionFromPathname("/settings/terminalFonts")).toBe("terminalFonts");
    expect(getSettingsSectionFromPathname("/workspace/global/chat")).toBe("general");
  });

  it("detects settings urls after stripping query and hash", () => {
    expect(isSettingsUrl("/settings?x=1")).toBe(true);
    expect(isSettingsUrl("/settings/general#tab")).toBe(true);
    expect(isSettingsUrl("/settings-panel?x=1")).toBe(false);
  });

  it("finds nearest non-settings history entry before current index", () => {
    const history = [
      state("/workspace/global/chat"),
      state("/settings/general"),
      state("/settings/gateway"),
      state("/settings/model"),
    ];

    expect(findPreviousNonSettingsHistoryIndex(history, 3)).toBe(0);
  });

  it("returns null when no previous non-settings entry exists", () => {
    const history = [
      state("/settings/general"),
      state("/settings/gateway"),
    ];

    expect(findPreviousNonSettingsHistoryIndex(history, 1)).toBeNull();
  });

  it("ignores forward history entries after current index", () => {
    const history = [
      state("/workspace/global/chat"),
      state("/settings/general"),
      state("/documents"),
    ];

    expect(findPreviousNonSettingsHistoryIndex(history, 1)).toBe(0);
  });
});
