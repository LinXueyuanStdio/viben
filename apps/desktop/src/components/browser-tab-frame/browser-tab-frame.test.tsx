/**
 * @vitest-environment jsdom
 */

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BrowserTabFrame,
  BrowserTabFrameIconButton,
  BrowserTabFrameTab,
} from "./browser-tab-frame";
import type { Root } from "react-dom/client";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function render(element: React.ReactElement) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(element);
  });

  return container;
}

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
  }
  container?.remove();
  root = null;
  container = null;
});

describe("BrowserTabFrame", () => {
  it("renders titlebar slots in browser order", () => {
    const element = render(
      <BrowserTabFrame
        isMacOS
        reserveMacOSControlsSpace
        leadingControls={<button>back</button>}
        tabsLeading={<div>fixed separator</div>}
        tabs={<div>tab one</div>}
        spacerMenu={<div data-tauri-drag-region>spacer menu</div>}
        rightControls={<button>open browser</button>}
        windowControls={<div>window controls</div>}
      />
    );

    expect(element.textContent).toBe(
      "backfixed separatortab onespacer menuopen browserwindow controls"
    );
    expect(
      element.querySelector("[data-browser-tab-frame-leading]")?.className
    ).toContain("pl-20");
    expect(
      element.querySelector("[data-browser-tab-frame-spacer]")
    ).toBeTruthy();
    expect(
      element.querySelector("[data-browser-tab-frame-spacer] > [data-tauri-drag-region]")
    ).toBeTruthy();
  });

  it("calls icon button handlers and respects disabled state", () => {
    const enabledClick = vi.fn();
    const disabledClick = vi.fn();
    const element = render(
      <>
        <BrowserTabFrameIconButton
          aria-label="Refresh"
          icon={<span aria-hidden="true">R</span>}
          onClick={enabledClick}
        />
        <BrowserTabFrameIconButton
          aria-label="Forward"
          icon={<span aria-hidden="true">F</span>}
          onClick={disabledClick}
          disabled
        />
      </>
    );

    const refresh = element.querySelector(
      'button[aria-label="Refresh"]'
    ) as HTMLButtonElement;
    const forward = element.querySelector(
      'button[aria-label="Forward"]'
    ) as HTMLButtonElement;

    act(() => {
      refresh.click();
      forward.click();
    });

    expect(enabledClick).toHaveBeenCalledTimes(1);
    expect(disabledClick).not.toHaveBeenCalled();
    expect(forward.disabled).toBe(true);
  });

  it("keeps tab close clicks from selecting the tab", () => {
    const select = vi.fn();
    const close = vi.fn();
    const element = render(
      <BrowserTabFrameTab
        label="Preview"
        icon={<span aria-hidden="true">P</span>}
        active
        closable
        onSelect={select}
        onClose={close}
      />
    );

    const closeButton = element.querySelector(
      'button[aria-label="Close Preview"]'
    ) as HTMLButtonElement;
    const tabButton = element.querySelector(
      'button[aria-current="page"]'
    ) as HTMLButtonElement;
    act(() => {
      closeButton.click();
    });

    expect(close).toHaveBeenCalledTimes(1);
    expect(select).not.toHaveBeenCalled();
    expect(tabButton.getAttribute("aria-current")).toBe("page");
  });
});
