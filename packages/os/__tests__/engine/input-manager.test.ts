import { describe, it, expect, vi, beforeEach } from "vitest";
import { InputManager } from "../../src/engine/input-manager";

describe("InputManager", () => {
  let canvas: HTMLCanvasElement;
  let textarea: HTMLTextAreaElement;
  let inputManager: InputManager;

  beforeEach(() => {
    canvas = document.createElement("canvas");
    canvas.tabIndex = 0;
    textarea = document.createElement("textarea");
    document.body.appendChild(canvas);
    document.body.appendChild(textarea);
    inputManager = new InputManager(canvas, textarea);
  });

  it("focuses textarea when activated", () => {
    const focusSpy = vi.spyOn(textarea, "focus");
    inputManager.activate();
    expect(focusSpy).toHaveBeenCalled();
  });

  it("deactivates and clears textarea", () => {
    inputManager.activate();
    textarea.value = "hello";
    inputManager.deactivate();
    expect(textarea.value).toBe("");
  });

  it("calls text handler on input event", () => {
    const handler = vi.fn();
    inputManager.onTextInput(handler);
    inputManager.activate();
    textarea.value = "a";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    expect(handler).toHaveBeenCalledWith("a");
  });

  it("calls keyboard handler on keydown", () => {
    const handler = vi.fn();
    inputManager.onKeyDown(handler);
    canvas.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("tracks IME composition state", () => {
    const handler = vi.fn();
    inputManager.onIMEComposition(handler);
    inputManager.activate();
    textarea.dispatchEvent(new CompositionEvent("compositionstart"));
    expect(handler).toHaveBeenCalledWith({ isComposing: true, compositionText: "" });
    textarea.dispatchEvent(new CompositionEvent("compositionend", { data: "你好" }));
    expect(handler).toHaveBeenCalledWith({ isComposing: false, compositionText: "你好" });
  });
});
