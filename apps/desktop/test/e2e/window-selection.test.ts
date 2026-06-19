import { describe, expect, it } from "vitest";
import { isMainDesktopWindowUrl } from "./window-selection";

describe("isMainDesktopWindowUrl", () => {
  it("only accepts the desktop main window URL", () => {
    expect(isMainDesktopWindowUrl("tauri://localhost/index.html")).toBe(true);
    expect(isMainDesktopWindowUrl("https://tauri.localhost/index.html")).toBe(true);

    expect(isMainDesktopWindowUrl("tauri://localhost/chat-window.html")).toBe(false);
    expect(isMainDesktopWindowUrl("tauri://localhost/pet-window.html")).toBe(false);
    expect(isMainDesktopWindowUrl("tauri://localhost/tray-popup.html")).toBe(false);
  });
});
