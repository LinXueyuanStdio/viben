/**
 * @vitest-environment jsdom
 */

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
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

function RouterProbe({
  onNavigate,
}: {
  onNavigate: (navigate: ReturnType<typeof useNavigate>) => void;
}) {
  const navigate = useNavigate();

  React.useEffect(() => {
    onNavigate(navigate);
  }, [navigate, onNavigate]);

  return null;
}

function LocationProbe({
  onLocation,
}: {
  onLocation: (location: ReturnType<typeof useLocation>) => void;
}) {
  const location = useLocation();

  React.useEffect(() => {
    onLocation(location);
  }, [location, onLocation]);

  return null;
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

  it("creates only one tab for a new-window entry under StrictMode", () => {
    render(
      <React.StrictMode>
        <MemoryRouter initialEntries={["/workspace/global?viben_new_tab=1"]}>
          <TabRouterBridge />
        </MemoryRouter>
      </React.StrictMode>
    );

    expect(useTabStore.getState().tabs).toHaveLength(1);
  });

  it("canonicalizes workspace root new-window requests to the global workspace route", () => {
    render(
      <MemoryRouter initialEntries={["/workspace?viben_new_tab=1"]}>
        <TabRouterBridge />
      </MemoryRouter>
    );

    const { tabs } = useTabStore.getState();
    expect(tabs).toHaveLength(1);
    expect(getTabCurrentState(tabs[0])?.url).toBe("/workspace/global");
  });

  it("preserves hash fragments for new-window entry routes", () => {
    render(
      <MemoryRouter initialEntries={["/workspace/global?viben_new_tab=1#section"]}>
        <TabRouterBridge />
      </MemoryRouter>
    );

    const { tabs } = useTabStore.getState();
    expect(tabs).toHaveLength(1);
    expect(getTabCurrentState(tabs[0])?.url).toBe("/workspace/global#section");
  });

  it("keeps tab and router synchronized after returning to a new-window entry tab", () => {
    let navigate: ReturnType<typeof useNavigate> | null = null;
    let currentPath = "";

    render(
      <MemoryRouter initialEntries={["/workspace/global?viben_new_tab=1"]}>
        <TabRouterBridge />
        <RouterProbe onNavigate={(nextNavigate) => { navigate = nextNavigate; }} />
        <LocationProbe
          onLocation={(location) => {
            currentPath = `${location.pathname}${location.search}`;
          }}
        />
      </MemoryRouter>
    );

    const workspaceTabId = useTabStore.getState().activeTabId;
    let documentTabId = "";
    act(() => {
      documentTabId = useTabStore.getState().openTab({
        navigationState: {
          url: "/documents",
          breadcrumbStack: [],
        },
        pinned: false,
      });
    });

    act(() => {
      navigate?.("/documents", { replace: true });
    });
    expect(useTabStore.getState().activeTabId).toBe(documentTabId);

    act(() => {
      useTabStore.getState().setActiveTab(workspaceTabId ?? "");
    });

    expect(currentPath).toBe("/workspace/global");
  });
});
