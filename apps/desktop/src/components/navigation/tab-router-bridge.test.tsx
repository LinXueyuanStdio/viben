/**
 * @vitest-environment jsdom
 */

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TabRouterBridge } from "./tab-router-bridge";
import { getTabCurrentState, useTabStore } from "@/stores/tab-store";
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

describe("TabRouterBridge", () => {
  beforeEach(() => {
    useTabStore.setState({
      tabs: [],
      activeTabId: null,
      recentlyClosedTabs: [],
    });
  });

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

  it("creates a fresh active tab for new-window entry routes", () => {
    render(
      <MemoryRouter initialEntries={["/workspace/global?viben_new_tab=1"]}>
        <TabRouterBridge />
      </MemoryRouter>
    );

    const { tabs, activeTabId } = useTabStore.getState();
    expect(tabs).toHaveLength(1);
    expect(activeTabId).toBe(tabs[0].id);
    expect(getTabCurrentState(tabs[0])?.url).toBe("/workspace/global");
    expect(getTabCurrentState(tabs[0])?.breadcrumbStack.at(-1)).toMatchObject({
      href: "/workspace/global",
      titleKey: "workspace.global",
    });
  });
});
