import { beforeEach, describe, expect, it } from "vitest";
import { createTabNavigationState } from "@/navigation/tab-navigation";
import { useTabStore, type PageTab, type ClosedTabSnapshot } from "./tab-store";

function makeTab(partial: Partial<PageTab> & Pick<PageTab, "id" | "name">): PageTab {
  const navigationHistory = partial.navigationHistory ?? [
    createTabNavigationState({ kind: "documents" }, []),
  ];

  return {
    id: partial.id,
    type: partial.type ?? "workspace",
    name: partial.name,
    slug: partial.slug,
    workspaceId: partial.workspaceId,
    icon: partial.icon,
    pinned: partial.pinned ?? false,
    history: partial.history ?? ["/documents"],
    historyIndex: partial.historyIndex ?? 0,
    navigationHistory,
    viewMode: partial.viewMode,
  };
}

function makeClosedSnapshot(tab: PageTab, originIndex: number): ClosedTabSnapshot {
  return {
    tab,
    originIndex,
    closedAt: Date.now(),
  };
}

describe("tab-store", () => {
  beforeEach(() => {
    useTabStore.setState({
      tabs: [],
      activeTabId: null,
      recentlyClosedTabs: [],
    });
  });

  it("duplicates a tab with a new id and same navigation history", () => {
    const original = makeTab({
      id: "tab-a",
      name: "A",
      pinned: true,
      history: ["/documents", "/settings/general"],
      historyIndex: 1,
      navigationHistory: [
        createTabNavigationState({ kind: "documents" }, []),
        createTabNavigationState({ kind: "settings", section: "general" }, []),
      ],
    });

    useTabStore.setState({
      tabs: [original],
      activeTabId: original.id,
      recentlyClosedTabs: [],
    });

    const duplicatedId = useTabStore.getState().duplicateTab(original.id);
    const state = useTabStore.getState();

    expect(duplicatedId).toBeTruthy();
    expect(state.tabs).toHaveLength(2);
    expect(state.activeTabId).toBe(duplicatedId);

    const duplicated = state.tabs[1];
    expect(duplicated.id).not.toBe(original.id);
    expect(duplicated.history).toEqual(original.history);
    expect(duplicated.historyIndex).toBe(original.historyIndex);
    expect(duplicated.navigationHistory).toEqual(original.navigationHistory);
    expect(duplicated.pinned).toBe(false);
  });

  it("pushes closed tab into recentlyClosedTabs on closeTab", () => {
    const tabA = makeTab({ id: "tab-a", name: "A" });
    const tabB = makeTab({ id: "tab-b", name: "B" });

    useTabStore.setState({
      tabs: [tabA, tabB],
      activeTabId: tabA.id,
      recentlyClosedTabs: [],
    });

    useTabStore.getState().closeTab(tabA.id);

    const state = useTabStore.getState();
    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0].id).toBe(tabB.id);
    expect(state.recentlyClosedTabs).toHaveLength(1);
    expect(state.recentlyClosedTabs[0].tab.id).toBe(tabA.id);
  });

  it("closes tabs to the right but keeps pinned tabs", () => {
    const tabA = makeTab({ id: "tab-a", name: "A" });
    const tabB = makeTab({ id: "tab-b", name: "B" });
    const tabC = makeTab({ id: "tab-c", name: "C", pinned: true });
    const tabD = makeTab({ id: "tab-d", name: "D" });

    useTabStore.setState({
      tabs: [tabA, tabB, tabC, tabD],
      activeTabId: tabD.id,
      recentlyClosedTabs: [],
    });

    useTabStore.getState().closeTabsToRight(tabB.id);

    const state = useTabStore.getState();
    expect(state.tabs.map((tab) => tab.id)).toEqual(["tab-a", "tab-b", "tab-c"]);
    expect(state.recentlyClosedTabs).toHaveLength(1);
    expect(state.recentlyClosedTabs[0].tab.id).toBe(tabD.id);
    expect(state.activeTabId).toBe(tabB.id);
  });

  it("closes other tabs but keeps pinned tabs and current tab", () => {
    const tabA = makeTab({ id: "tab-a", name: "A" });
    const tabB = makeTab({ id: "tab-b", name: "B", pinned: true });
    const tabC = makeTab({ id: "tab-c", name: "C" });
    const tabD = makeTab({ id: "tab-d", name: "D" });

    useTabStore.setState({
      tabs: [tabA, tabB, tabC, tabD],
      activeTabId: tabC.id,
      recentlyClosedTabs: [],
    });

    useTabStore.getState().closeOtherTabs(tabC.id);

    const state = useTabStore.getState();
    expect(state.tabs.map((tab) => tab.id)).toEqual(["tab-b", "tab-c"]);
    expect(state.activeTabId).toBe(tabC.id);
    expect(state.recentlyClosedTabs.map((snapshot) => snapshot.tab.id)).toEqual([
      "tab-d",
      "tab-a",
    ]);
  });

  it("reopens the most recently closed tab near its original index", () => {
    const tabA = makeTab({ id: "tab-a", name: "A" });
    const tabB = makeTab({ id: "tab-b", name: "B" });

    useTabStore.setState({
      tabs: [tabA],
      activeTabId: tabA.id,
      recentlyClosedTabs: [makeClosedSnapshot(tabB, 1)],
    });

    const reopenedId = useTabStore.getState().reopenClosedTab();
    const state = useTabStore.getState();

    expect(reopenedId).toBeTruthy();
    expect(state.tabs).toHaveLength(2);
    expect(state.tabs[1].name).toBe("B");
    expect(state.tabs[1].id).not.toBe(tabB.id);
    expect(state.activeTabId).toBe(reopenedId);
    expect(state.recentlyClosedTabs).toHaveLength(0);
  });

  it("jumps directly to a specific history entry", () => {
    const tab = makeTab({
      id: "tab-a",
      name: "A",
      history: ["/documents", "/settings/general", "/settings/about"],
      historyIndex: 2,
      navigationHistory: [
        createTabNavigationState({ kind: "documents" }, []),
        createTabNavigationState({ kind: "settings", section: "general" }, []),
        createTabNavigationState({ kind: "settings", section: "about" }, []),
      ],
    });

    useTabStore.setState({
      tabs: [tab],
      activeTabId: tab.id,
      recentlyClosedTabs: [],
    });

    useTabStore.getState().jumpToHistory(tab.id, 0);

    const state = useTabStore.getState();
    expect(state.tabs[0].historyIndex).toBe(0);
    expect(state.tabs[0].history[0]).toBe("/documents");
  });

  it("closeAllTabs keeps pinned tabs and archives the rest", () => {
    const tabA = makeTab({ id: "tab-a", name: "A" });
    const tabB = makeTab({ id: "tab-b", name: "B", pinned: true });
    const tabC = makeTab({ id: "tab-c", name: "C" });

    useTabStore.setState({
      tabs: [tabA, tabB, tabC],
      activeTabId: tabC.id,
      recentlyClosedTabs: [],
    });

    useTabStore.getState().closeAllTabs();

    const state = useTabStore.getState();
    expect(state.tabs.map((tab) => tab.id)).toEqual(["tab-b"]);
    expect(state.activeTabId).toBe(tabB.id);
    expect(state.recentlyClosedTabs.map((snapshot) => snapshot.tab.id)).toEqual([
      "tab-c",
      "tab-a",
    ]);
  });
});
