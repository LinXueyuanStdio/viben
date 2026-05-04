import { describe, expect, it } from "vitest";
import {
  getTabSwitchIndexFromShortcut,
  isEditableShortcutTarget,
  isShortcutPressed,
  matchesShortcut,
  parseShortcut,
} from "./use-global-shortcuts";

describe("use-global-shortcuts helpers", () => {
  it("parses a Cmd-based shortcut", () => {
    expect(parseShortcut("Shift+Cmd+J")).toEqual({
      ctrl: false,
      meta: true,
      shift: true,
      alt: false,
      key: "j",
    });
  });

  it("matches configurable shortcuts across ctrl/cmd", () => {
    expect(
      matchesShortcut(
        {
          key: "j",
          ctrlKey: true,
          metaKey: false,
          shiftKey: true,
          altKey: false,
        },
        "Shift+Cmd+J"
      )
    ).toBe(true);
  });

  it("detects reopen closed tab shortcut", () => {
    expect(
      isShortcutPressed(
        {
          key: "t",
          ctrlKey: false,
          metaKey: true,
          shiftKey: true,
          altKey: false,
        },
        "Cmd+Shift+T"
      )
    ).toBe(true);

    expect(
      isShortcutPressed(
        {
          key: "t",
          ctrlKey: false,
          metaKey: true,
          shiftKey: true,
          altKey: false,
        },
        "Cmd+Shift+T"
      )
    ).toBe(true);

    expect(
      isShortcutPressed(
        {
          key: "t",
          ctrlKey: true,
          metaKey: false,
          shiftKey: true,
          altKey: false,
        },
        "Cmd+Shift+T"
      )
    ).toBe(true);
  });

  it("does not match reopen shortcut without shift", () => {
    expect(
      isShortcutPressed(
        {
          key: "t",
          ctrlKey: true,
          metaKey: false,
          shiftKey: false,
          altKey: false,
        },
        "Cmd+Shift+T"
      )
    ).toBe(false);
  });

  it("detects configurable new tab and close tab shortcuts", () => {
    expect(
      isShortcutPressed(
        {
          key: "t",
          ctrlKey: true,
          metaKey: false,
          shiftKey: false,
          altKey: false,
        },
        "Cmd+T"
      )
    ).toBe(true);

    expect(
      isShortcutPressed(
        {
          key: "w",
          ctrlKey: false,
          metaKey: true,
          shiftKey: false,
          altKey: false,
        },
        "Cmd+W"
      )
    ).toBe(true);
  });

  it("maps ctrl/cmd+1..9 to tab switch indexes", () => {
    expect(
      getTabSwitchIndexFromShortcut({
        key: "1",
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        altKey: false,
      })
    ).toBe(0);

    expect(
      getTabSwitchIndexFromShortcut({
        key: "9",
        ctrlKey: false,
        metaKey: true,
        shiftKey: false,
        altKey: false,
      })
    ).toBe(8);

    expect(
      getTabSwitchIndexFromShortcut({
        key: "2",
        ctrlKey: true,
        metaKey: false,
        shiftKey: true,
        altKey: false,
      })
    ).toBeNull();
  });

  it("treats text inputs and contenteditable as editable shortcut targets", () => {
    expect(isEditableShortcutTarget({ tagName: "INPUT" })).toBe(true);

    expect(isEditableShortcutTarget({ isContentEditable: true })).toBe(true);

    expect(
      isEditableShortcutTarget({
        tagName: "DIV",
        closest: () => null,
        getAttribute: () => null,
      })
    ).toBe(false);
  });
});
