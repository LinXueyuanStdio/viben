import { beforeEach, describe, expect, it } from "vitest";
import type { BreadcrumbStackItem } from "@/navigation/breadcrumb-builder";
import {
  TAB_STORE_STORAGE_KEY,
  getScopedTabStore,
  getTabCurrentLeaf,
  getTabCurrentState,
  getTabUrl,
  getTabViewModel,
  mergePersistedTabState,
  selectActiveTab,
  selectPinnedTabs,
  selectUnpinnedTabs,
  useTabStore,
  type ClosedTabSnapshot,
  type PageTab,
  type TabNavigationState,
} from "./tab-store";

const FORBIDDEN_PAGE_TAB_FIELDS = [
  "label",
  "icon",
  "descriptorId",
  "meta",
  "target",
  "sourceNodeId",
  "parentNodeId",
  "history",
] as const;

function leaf(
  id: string,
  label: string,
  href: string,
  meta?: BreadcrumbStackItem["meta"],
): BreadcrumbStackItem {
  return {
    id,
    label,
    href,
    meta,
  };
}

function state(
  url: string,
  stack: BreadcrumbStackItem[] = [],
): TabNavigationState {
  return { url, breadcrumbStack: stack };
}

function documentsState(): TabNavigationState {
  return state("/documents", [leaf("documents", "Documents", "/documents")]);
}

function settingsState(section: "general" | "about"): TabNavigationState {
  const url = `/settings/${section}`;
  return state(url, [
    leaf("settings", section === "general" ? "General" : "About", url),
  ]);
}

function workspaceAgentsState(workspaceId = "workspace-a"): TabNavigationState {
  const url = `/workspace/${workspaceId}/agent`;
  return state(url, [
    leaf("workspace", "Workspace A", `/workspace/${workspaceId}`, {
      workspaceId,
    }),
    leaf("workspace-section:agent", "Agents", url, {
      workspaceId,
      section: "agent",
    }),
  ]);
}

function agentDetailState(
  workspaceId = "workspace-a",
  agentId = "agent-a",
): TabNavigationState {
  const url = `/workspace/${workspaceId}/agent/${agentId}`;
  return state(url, [
    ...workspaceAgentsState(workspaceId).breadcrumbStack,
    leaf("workspace-agent", "Personal Assistant", url, {
      workspaceId,
      agentId,
    }),
  ]);
}

function makeTab(partial: {
  id: string;
  pinned?: boolean;
  historyIndex?: number;
  navigationHistory?: TabNavigationState[];
  viewMode?: PageTab["viewMode"];
}): PageTab {
  return {
    id: partial.id,
    pinned: partial.pinned ?? false,
    historyIndex: partial.historyIndex ?? 0,
    navigationHistory: partial.navigationHistory ?? [documentsState()],
    viewMode: partial.viewMode,
  };
}

function makeClosedSnapshot(
  tab: PageTab,
  originIndex: number,
): ClosedTabSnapshot {
  return {
    tab,
    originIndex,
    closedAt: Date.now(),
  };
}

function expectNoRemovedPageTabFields(tab: PageTab) {
  for (const field of FORBIDDEN_PAGE_TAB_FIELDS) {
    expect(tab).not.toHaveProperty(field);
  }
}

function mergePersisted(input: {
  tabs?: unknown[];
  activeTabId?: string | null;
  recentlyClosedTabs?: unknown[];
}) {
  return mergePersistedTabState(
    {
      tabs: input.tabs as PageTab[] | undefined,
      activeTabId: input.activeTabId ?? null,
      recentlyClosedTabs: input.recentlyClosedTabs as
        | ClosedTabSnapshot[]
        | undefined,
    },
    {
      tabs: [],
      activeTabId: null,
      recentlyClosedTabs: [],
    },
  );
}

describe("tab-store URL-based navigation state", () => {
  beforeEach(() => {
    useTabStore.setState({
      tabs: [],
      activeTabId: null,
      recentlyClosedTabs: [],
    });
  });

  it("uses a new persisted storage key and ignores the old tab store key", () => {
    expect(TAB_STORE_STORAGE_KEY).toBe("viben-tab-store-v2");
    expect(TAB_STORE_STORAGE_KEY).not.toBe("viben-tab-store");
  });

  it("does not define a legacy persisted storage key", () => {
    expect(TAB_STORE_STORAGE_KEY).not.toBe("viben-tab-store");
  });

  it("creates scoped tab stores with independent storage keys and state", () => {
    const previewStore = getScopedTabStore("page-preview-1");
    const anotherPreviewStore = getScopedTabStore("page-preview-2");

    useTabStore.setState({
      tabs: [],
      activeTabId: null,
      recentlyClosedTabs: [],
    });
    previewStore.setState({
      tabs: [],
      activeTabId: null,
      recentlyClosedTabs: [],
    });
    anotherPreviewStore.setState({
      tabs: [],
      activeTabId: null,
      recentlyClosedTabs: [],
    });

    const previewTabId = previewStore.getState().openTab({
      navigationState: documentsState(),
    });

    expect(previewStore.persist.getOptions().name).toBe(
      "viben-tab-store-v2:page-preview-1",
    );
    expect(anotherPreviewStore.persist.getOptions().name).toBe(
      "viben-tab-store-v2:page-preview-2",
    );
    expect(useTabStore.getState().tabs).toHaveLength(0);
    expect(previewStore.getState().activeTabId).toBe(previewTabId);
    expect(anotherPreviewStore.getState().tabs).toHaveLength(0);
  });

  it("merges v2 persisted state and drops invalid new-structure tabs without reading legacy fields", () => {
    const validTab = makeTab({
      id: "tab-valid",
      pinned: true,
      historyIndex: 5,
      navigationHistory: [workspaceAgentsState(), agentDetailState()],
      viewMode: "skill",
    });
    const invalidLegacyTab = {
      id: "tab-legacy",
      pinned: false,
      historyIndex: 0,
      history: ["/workspace/workspace-a/agent"],
      label: "Legacy",
    };
    const snapshotTab = makeTab({
      id: "tab-closed",
      navigationHistory: [settingsState("about")],
      viewMode: "page",
    });

    const result = mergePersisted({
      tabs: [validTab, invalidLegacyTab],
      activeTabId: "missing-tab",
      recentlyClosedTabs: [
        makeClosedSnapshot(snapshotTab, 4),
        { tab: invalidLegacyTab, originIndex: 1, closedAt: Date.now() },
      ],
    });

    expect(result.tabs).toHaveLength(1);
    expect(result.tabs[0]).toMatchObject({
      id: "tab-valid",
      pinned: true,
      historyIndex: 1,
      viewMode: "skill",
    });
    expect(result.tabs[0].navigationHistory).toEqual([
      workspaceAgentsState(),
      agentDetailState(),
    ]);
    expect(result.activeTabId).toBe("tab-valid");
    expectNoRemovedPageTabFields(result.tabs[0]);

    expect(result.recentlyClosedTabs).toHaveLength(1);
    expect(result.recentlyClosedTabs[0].tab.id).toBe("tab-closed");
    expect(result.recentlyClosedTabs[0].originIndex).toBe(4);
    expectNoRemovedPageTabFields(result.recentlyClosedTabs[0].tab);
  });

  it("partializes only the new PageTab shape", () => {
    const openedId = useTabStore.getState().openTab({
      navigationState: agentDetailState(),
      pinned: true,
      viewMode: "page",
    });

    const storeState = useTabStore.getState();
    const persisted = {
      tabs: storeState.tabs,
      activeTabId: storeState.activeTabId,
      recentlyClosedTabs: storeState.recentlyClosedTabs,
    };

    expect(persisted.activeTabId).toBe(openedId);
    expect(persisted.tabs).toHaveLength(1);
    expect(Object.keys(persisted.tabs[0]).sort()).toEqual([
      "historyIndex",
      "id",
      "navigationHistory",
      "pinned",
      "viewMode",
    ]);
    expectNoRemovedPageTabFields(persisted.tabs[0]);
  });

  it("PageTab fixtures only contain tab container fields and navigation history", () => {
    const tab = makeTab({ id: "tab-a" });

    expect(Object.keys(tab).sort()).toEqual([
      "historyIndex",
      "id",
      "navigationHistory",
      "pinned",
      "viewMode",
    ]);
    expectNoRemovedPageTabFields(tab);
  });

  it("opens a tab from navigationState without persisting breadcrumb leaf fields on PageTab", () => {
    const openedId = useTabStore.getState().openTab({
      navigationState: workspaceAgentsState(),
      pinned: false,
    });

    const opened = useTabStore
      .getState()
      .tabs.find((tab) => tab.id === openedId);
    expect(opened).toBeTruthy();
    expect(opened?.navigationHistory).toEqual([workspaceAgentsState()]);
    expect(opened?.historyIndex).toBe(0);
    expect(opened).toBeDefined();
    expectNoRemovedPageTabFields(opened!);
  });

  it("duplicates a tab with the same navigation history and no removed fields", () => {
    const original = makeTab({
      id: "tab-a",
      pinned: true,
      historyIndex: 1,
      navigationHistory: [documentsState(), settingsState("general")],
      viewMode: "skill",
    });

    useTabStore.setState({
      tabs: [original],
      activeTabId: original.id,
      recentlyClosedTabs: [],
    });

    const duplicatedId = useTabStore.getState().duplicateTab(original.id);
    const duplicated = useTabStore
      .getState()
      .tabs.find((tab) => tab.id === duplicatedId);

    expect(duplicatedId).toBeTruthy();
    expect(duplicated?.id).not.toBe(original.id);
    expect(duplicated?.historyIndex).toBe(original.historyIndex);
    expect(duplicated?.navigationHistory).toEqual(original.navigationHistory);
    expect(duplicated?.viewMode).toBe("skill");
    expect(duplicated?.pinned).toBe(false);
    expect(useTabStore.getState().activeTabId).toBe(duplicatedId);
    expect(useTabStore.getState().tabs.map((tab) => tab.id)).toEqual([
      original.id,
      duplicatedId,
    ]);
    expect(duplicated).toBeDefined();
    expectNoRemovedPageTabFields(duplicated!);
  });

  it("returns null and leaves state unchanged when duplicating an unknown tab", () => {
    const tab = makeTab({ id: "tab-a" });
    useTabStore.setState({
      tabs: [tab],
      activeTabId: tab.id,
      recentlyClosedTabs: [],
    });

    expect(useTabStore.getState().duplicateTab("missing")).toBeNull();
    expect(useTabStore.getState().tabs).toEqual([tab]);
  });

  it("archives and restores recently closed tabs using only the new PageTab shape", () => {
    const tabA = makeTab({
      id: "tab-a",
      navigationHistory: [workspaceAgentsState()],
    });
    const tabB = makeTab({
      id: "tab-b",
      navigationHistory: [agentDetailState()],
    });

    useTabStore.setState({
      tabs: [tabA, tabB],
      activeTabId: tabA.id,
      recentlyClosedTabs: [],
    });

    useTabStore.getState().closeTab(tabA.id);

    const closed = useTabStore.getState().recentlyClosedTabs[0];
    expect(closed.tab.id).toBe(tabA.id);
    expectNoRemovedPageTabFields(closed.tab);

    const reopenedId = useTabStore.getState().reopenClosedTab();
    const reopened = useTabStore
      .getState()
      .tabs.find((tab) => tab.id === reopenedId);

    expect(reopenedId).toBeTruthy();
    expect(reopened?.id).not.toBe(tabA.id);
    expect(reopened?.navigationHistory).toEqual(tabA.navigationHistory);
    expect(useTabStore.getState().tabs.map((tab) => tab.id)).toEqual([
      reopenedId,
      tabB.id,
    ]);
    expect(reopened).toBeDefined();
    expectNoRemovedPageTabFields(reopened!);
  });

  it("reopenClosedTab returns null when there is no snapshot", () => {
    expect(useTabStore.getState().reopenClosedTab()).toBeNull();
    expect(useTabStore.getState().tabs).toEqual([]);
  });

  it("jumpToHistory only changes historyIndex and leaves navigationHistory untouched", () => {
    const tab = makeTab({
      id: "tab-a",
      historyIndex: 2,
      navigationHistory: [
        documentsState(),
        settingsState("general"),
        settingsState("about"),
      ],
    });

    useTabStore.setState({
      tabs: [tab],
      activeTabId: tab.id,
      recentlyClosedTabs: [],
    });

    useTabStore.getState().jumpToHistory(tab.id, 0);

    const updated = useTabStore.getState().tabs[0];
    expect(updated.historyIndex).toBe(0);
    expect(updated.navigationHistory).toEqual(tab.navigationHistory);
    expectNoRemovedPageTabFields(updated);
  });

  it("replaceLocation replaces the current entry and truncates forward history", () => {
    const tab = makeTab({
      id: "tab-a",
      historyIndex: 1,
      navigationHistory: [
        documentsState(),
        agentDetailState(),
        settingsState("about"),
      ],
    });

    useTabStore.setState({
      tabs: [tab],
      activeTabId: tab.id,
      recentlyClosedTabs: [],
    });

    const next = workspaceAgentsState();
    useTabStore.getState().replaceLocation(tab.id, next);

    const updated = useTabStore.getState().tabs[0];
    expect(updated.historyIndex).toBe(1);
    expect(updated.navigationHistory).toEqual([documentsState(), next]);
    expectNoRemovedPageTabFields(updated);
  });

  it("replaceLocation preserves container fields while replacing the current entry", () => {
    const tab = makeTab({
      id: "tab-a",
      pinned: true,
      viewMode: "skill",
      navigationHistory: [workspaceAgentsState()],
    });

    useTabStore.setState({
      tabs: [tab],
      activeTabId: tab.id,
      recentlyClosedTabs: [],
    });

    useTabStore.getState().replaceLocation(tab.id, settingsState("about"));

    const updated = useTabStore.getState().tabs[0];
    expect(updated.pinned).toBe(true);
    expect(updated.viewMode).toBe("skill");
    expect(updated.navigationHistory).toEqual([settingsState("about")]);
  });

  it("pushLocation truncates forward history before appending the next entry", () => {
    const tab = makeTab({
      id: "tab-a",
      historyIndex: 0,
      navigationHistory: [workspaceAgentsState(), agentDetailState()],
    });

    useTabStore.setState({
      tabs: [tab],
      activeTabId: tab.id,
      recentlyClosedTabs: [],
    });

    const next = settingsState("general");
    useTabStore.getState().pushLocation(tab.id, next);

    const updated = useTabStore.getState().tabs[0];
    expect(updated.historyIndex).toBe(1);
    expect(updated.navigationHistory).toEqual([workspaceAgentsState(), next]);
    expectNoRemovedPageTabFields(updated);
  });

  it("pushNavigation appends leaf to current breadcrumb stack and truncates forward", () => {
    const tab = makeTab({
      id: "tab-a",
      historyIndex: 0,
      navigationHistory: [workspaceAgentsState()],
    });

    useTabStore.setState({
      tabs: [tab],
      activeTabId: tab.id,
      recentlyClosedTabs: [],
    });

    const newLeaf = leaf(
      "workspace-agent",
      "Personal Assistant",
      "/workspace/workspace-a/agent/agent-a",
      { workspaceId: "workspace-a", agentId: "agent-a" },
    );
    useTabStore
      .getState()
      .pushNavigation(tab.id, "/workspace/workspace-a/agent/agent-a", newLeaf);

    const updated = useTabStore.getState().tabs[0];
    expect(updated.historyIndex).toBe(1);
    expect(updated.navigationHistory[1].url).toBe(
      "/workspace/workspace-a/agent/agent-a",
    );
    expect(updated.navigationHistory[1].breadcrumbStack).toEqual([
      ...workspaceAgentsState().breadcrumbStack,
      newLeaf,
    ]);
  });

  it("replaceNavigation replaces last breadcrumb item and truncates forward", () => {
    const tab = makeTab({
      id: "tab-a",
      historyIndex: 0,
      navigationHistory: [agentDetailState()],
    });

    useTabStore.setState({
      tabs: [tab],
      activeTabId: tab.id,
      recentlyClosedTabs: [],
    });

    const replacementLeaf = leaf(
      "workspace-agent",
      "Updated Agent",
      "/workspace/workspace-a/agent/agent-b",
      { workspaceId: "workspace-a", agentId: "agent-b" },
    );
    useTabStore
      .getState()
      .replaceNavigation(
        tab.id,
        "/workspace/workspace-a/agent/agent-b",
        replacementLeaf,
      );

    const updated = useTabStore.getState().tabs[0];
    expect(updated.historyIndex).toBe(1);
    expect(updated.navigationHistory[1].url).toBe(
      "/workspace/workspace-a/agent/agent-b",
    );
    // The stack should have the first two items from agentDetailState, with the last replaced
    const expectedStack = [
      ...agentDetailState().breadcrumbStack.slice(0, -1),
      replacementLeaf,
    ];
    expect(updated.navigationHistory[1].breadcrumbStack).toEqual(expectedStack);
  });

  it("resetNavigation creates a new state with fresh stack", () => {
    const tab = makeTab({
      id: "tab-a",
      historyIndex: 0,
      navigationHistory: [agentDetailState()],
    });

    useTabStore.setState({
      tabs: [tab],
      activeTabId: tab.id,
      recentlyClosedTabs: [],
    });

    const newStack = [leaf("documents", "Documents", "/documents")];
    useTabStore.getState().resetNavigation(tab.id, "/documents", newStack);

    const updated = useTabStore.getState().tabs[0];
    expect(updated.historyIndex).toBe(1);
    expect(updated.navigationHistory[1]).toEqual({
      url: "/documents",
      breadcrumbStack: newStack,
    });
  });

  it("getCurrentUrl returns the URL of the current navigation state", () => {
    const tab = makeTab({
      id: "tab-a",
      historyIndex: 1,
      navigationHistory: [documentsState(), agentDetailState()],
    });

    useTabStore.setState({
      tabs: [tab],
      activeTabId: tab.id,
      recentlyClosedTabs: [],
    });

    expect(useTabStore.getState().getCurrentUrl(tab.id)).toBe(
      "/workspace/workspace-a/agent/agent-a",
    );
  });

  it("findHistoryEntryByUrl scans backward history for matching URL", () => {
    const tab = makeTab({
      id: "tab-a",
      historyIndex: 2,
      navigationHistory: [
        documentsState(),
        workspaceAgentsState(),
        agentDetailState(),
      ],
    });

    useTabStore.setState({
      tabs: [tab],
      activeTabId: tab.id,
      recentlyClosedTabs: [],
    });

    expect(
      useTabStore.getState().findHistoryEntryByUrl(tab.id, "/documents"),
    ).toBe(0);
    expect(
      useTabStore
        .getState()
        .findHistoryEntryByUrl(tab.id, "/workspace/workspace-a/agent"),
    ).toBe(1);
    expect(
      useTabStore.getState().findHistoryEntryByUrl(tab.id, "/unknown"),
    ).toBe(-1);
  });

  it("insertHistoryBeforeCurrent inserts before current position", () => {
    const tab = makeTab({
      id: "tab-a",
      historyIndex: 1,
      navigationHistory: [documentsState(), agentDetailState()],
    });

    useTabStore.setState({
      tabs: [tab],
      activeTabId: tab.id,
      recentlyClosedTabs: [],
    });

    const inserted = workspaceAgentsState();
    useTabStore.getState().insertHistoryBeforeCurrent(tab.id, inserted);

    const updated = useTabStore.getState().tabs[0];
    expect(updated.historyIndex).toBe(1);
    expect(updated.navigationHistory).toEqual([
      documentsState(),
      inserted,
      agentDetailState(),
    ]);
    expect(useTabStore.getState().canGoForward(tab.id)).toBe(true);
  });

  it("goBack and goForward only move historyIndex within bounds", () => {
    const tab = makeTab({
      id: "tab-a",
      historyIndex: 1,
      navigationHistory: [documentsState(), workspaceAgentsState()],
    });

    useTabStore.setState({
      tabs: [tab],
      activeTabId: tab.id,
      recentlyClosedTabs: [],
    });

    useTabStore.getState().goBack(tab.id);
    expect(useTabStore.getState().tabs[0].historyIndex).toBe(0);
    expect(useTabStore.getState().canGoBack(tab.id)).toBe(false);
    expect(useTabStore.getState().canGoForward(tab.id)).toBe(true);
    expect(useTabStore.getState().tabs[0].navigationHistory).toEqual(
      tab.navigationHistory,
    );

    useTabStore.getState().goBack(tab.id);
    expect(useTabStore.getState().tabs[0].historyIndex).toBe(0);

    useTabStore.getState().goForward(tab.id);
    expect(useTabStore.getState().tabs[0].historyIndex).toBe(1);

    useTabStore.getState().goForward(tab.id);
    expect(useTabStore.getState().tabs[0].historyIndex).toBe(1);
  });

  it("closeOtherTabs keeps pinned tabs and the target tab", () => {
    const tabA = makeTab({ id: "tab-a" });
    const tabB = makeTab({ id: "tab-b", pinned: true });
    const tabC = makeTab({ id: "tab-c" });

    useTabStore.setState({
      tabs: [tabA, tabB, tabC],
      activeTabId: tabA.id,
      recentlyClosedTabs: [],
    });

    useTabStore.getState().closeOtherTabs(tabC.id);

    const result = useTabStore.getState();
    expect(result.tabs.map((tab) => tab.id)).toEqual([tabB.id, tabC.id]);
    expect(result.activeTabId).toBe(tabC.id);
    expect(
      result.recentlyClosedTabs.map((snapshot) => snapshot.tab.id),
    ).toEqual([tabA.id]);
  });

  it("closeTabsToRight closes only unpinned tabs to the right", () => {
    const tabA = makeTab({ id: "tab-a" });
    const tabB = makeTab({ id: "tab-b" });
    const tabC = makeTab({ id: "tab-c", pinned: true });
    const tabD = makeTab({ id: "tab-d" });

    useTabStore.setState({
      tabs: [tabA, tabB, tabC, tabD],
      activeTabId: tabD.id,
      recentlyClosedTabs: [],
    });

    useTabStore.getState().closeTabsToRight(tabB.id);

    const result = useTabStore.getState();
    expect(result.tabs.map((tab) => tab.id)).toEqual([
      tabA.id,
      tabB.id,
      tabC.id,
    ]);
    expect(result.activeTabId).toBe(tabB.id);
    expect(
      result.recentlyClosedTabs.map((snapshot) => snapshot.tab.id),
    ).toEqual([tabD.id]);
  });

  it("pinTab and unpinTab update pinned state and tab ordering", () => {
    const tabA = makeTab({ id: "tab-a", pinned: true });
    const tabB = makeTab({ id: "tab-b" });
    const tabC = makeTab({ id: "tab-c" });

    useTabStore.setState({
      tabs: [tabA, tabB, tabC],
      activeTabId: tabC.id,
      recentlyClosedTabs: [],
    });

    useTabStore.getState().pinTab(tabC.id);
    expect(
      useTabStore.getState().tabs.map((tab) => [tab.id, tab.pinned]),
    ).toEqual([
      [tabA.id, true],
      [tabC.id, true],
      [tabB.id, false],
    ]);

    useTabStore.getState().unpinTab(tabA.id);
    expect(
      useTabStore.getState().tabs.map((tab) => [tab.id, tab.pinned]),
    ).toEqual([
      [tabC.id, true],
      [tabA.id, false],
      [tabB.id, false],
    ]);
  });

  it("setViewMode updates only the tab container view mode", () => {
    const tab = makeTab({
      id: "tab-a",
      navigationHistory: [workspaceAgentsState()],
    });

    useTabStore.setState({
      tabs: [tab],
      activeTabId: tab.id,
      recentlyClosedTabs: [],
    });

    useTabStore.getState().setViewMode(tab.id, "skill");

    const updated = useTabStore.getState().tabs[0];
    expect(updated.viewMode).toBe("skill");
    expect(updated.navigationHistory).toEqual(tab.navigationHistory);
    expectNoRemovedPageTabFields(updated);
  });

  it("closeAllTabs keeps pinned tabs and archives the rest without removed fields", () => {
    const tabA = makeTab({ id: "tab-a" });
    const tabB = makeTab({ id: "tab-b", pinned: true });
    const tabC = makeTab({ id: "tab-c" });

    useTabStore.setState({
      tabs: [tabA, tabB, tabC],
      activeTabId: tabC.id,
      recentlyClosedTabs: [],
    });

    useTabStore.getState().closeAllTabs();

    const store = useTabStore.getState();
    expect(store.tabs.map((tab) => tab.id)).toEqual(["tab-b"]);
    expect(store.activeTabId).toBe(tabB.id);
    expect(store.recentlyClosedTabs.map((snapshot) => snapshot.tab.id)).toEqual(
      ["tab-c", "tab-a"],
    );
    expectNoRemovedPageTabFields(store.tabs[0]);
    for (const snapshot of store.recentlyClosedTabs) {
      expectNoRemovedPageTabFields(snapshot.tab);
    }
  });

  it("closeAllTabs clears activeTabId when no pinned tabs remain", () => {
    const tabA = makeTab({ id: "tab-a" });
    const tabB = makeTab({ id: "tab-b" });

    useTabStore.setState({
      tabs: [tabA, tabB],
      activeTabId: tabB.id,
      recentlyClosedTabs: [],
    });

    useTabStore.getState().closeAllTabs();

    expect(useTabStore.getState().tabs).toEqual([]);
    expect(useTabStore.getState().activeTabId).toBeNull();
    expect(
      useTabStore
        .getState()
        .recentlyClosedTabs.map((snapshot) => snapshot.tab.id),
    ).toEqual([tabB.id, tabA.id]);
  });

  it("restores a closed tab snapshot that already uses the new shape", () => {
    const tabA = makeTab({ id: "tab-a" });
    const tabB = makeTab({
      id: "tab-b",
      navigationHistory: [agentDetailState()],
    });

    useTabStore.setState({
      tabs: [tabA],
      activeTabId: tabA.id,
      recentlyClosedTabs: [makeClosedSnapshot(tabB, 1)],
    });

    const reopenedId = useTabStore.getState().reopenClosedTab();
    const result = useTabStore.getState();

    expect(reopenedId).toBeTruthy();
    expect(result.tabs).toHaveLength(2);
    expect(result.tabs[1].id).not.toBe(tabB.id);
    expect(result.tabs[1].navigationHistory).toEqual(tabB.navigationHistory);
    expect(result.activeTabId).toBe(reopenedId);
    expect(result.recentlyClosedTabs).toHaveLength(0);
    expectNoRemovedPageTabFields(result.tabs[1]);
  });

  it("derives current state, url, leaf, and view model from navigationHistory", () => {
    const tab = makeTab({
      id: "tab-a",
      historyIndex: 1,
      navigationHistory: [workspaceAgentsState(), agentDetailState()],
      viewMode: "page",
    });

    expect(getTabCurrentState(tab)).toEqual(agentDetailState());
    expect(getTabCurrentLeaf(tab)).toEqual(
      agentDetailState().breadcrumbStack[
        agentDetailState().breadcrumbStack.length - 1
      ],
    );
    expect(getTabUrl(tab)).toBe("/workspace/workspace-a/agent/agent-a");

    const viewModel = getTabViewModel(tab);
    expect(viewModel.label).toBe("Personal Assistant");
    expect(viewModel.currentUrl).toBe("/workspace/workspace-a/agent/agent-a");
    expect(viewModel.meta).toEqual({
      workspaceId: "workspace-a",
      agentId: "agent-a",
    });
    expect(viewModel.url).toBe("/workspace/workspace-a/agent/agent-a");
    expect(Object.keys(tab).sort()).toEqual([
      "historyIndex",
      "id",
      "navigationHistory",
      "pinned",
      "viewMode",
    ]);
    expectNoRemovedPageTabFields(tab);
  });

  it("uses url as view model label fallback when current leaf is missing", () => {
    const tab = makeTab({
      id: "tab-a",
      navigationHistory: [state("/documents", [])],
    });

    expect(getTabViewModel(tab).label).toBe("/documents");
  });

  describe("moveTab", () => {
    it("moves a tab from index 0 to index 2", () => {
      const tabA = makeTab({ id: "tab-a" });
      const tabB = makeTab({ id: "tab-b" });
      const tabC = makeTab({ id: "tab-c" });

      useTabStore.setState({
        tabs: [tabA, tabB, tabC],
        activeTabId: tabA.id,
        recentlyClosedTabs: [],
      });

      useTabStore.getState().moveTab(0, 2);

      expect(useTabStore.getState().tabs.map((tab) => tab.id)).toEqual([
        "tab-b",
        "tab-c",
        "tab-a",
      ]);
    });

    it("does nothing when fromIndex equals toIndex", () => {
      const tabA = makeTab({ id: "tab-a" });
      const tabB = makeTab({ id: "tab-b" });

      useTabStore.setState({
        tabs: [tabA, tabB],
        activeTabId: tabA.id,
        recentlyClosedTabs: [],
      });

      useTabStore.getState().moveTab(1, 1);

      expect(useTabStore.getState().tabs.map((tab) => tab.id)).toEqual([
        "tab-a",
        "tab-b",
      ]);
    });

    it("does nothing when index is out of bounds", () => {
      const tabA = makeTab({ id: "tab-a" });
      const tabB = makeTab({ id: "tab-b" });

      useTabStore.setState({
        tabs: [tabA, tabB],
        activeTabId: tabA.id,
        recentlyClosedTabs: [],
      });

      useTabStore.getState().moveTab(-1, 0);
      expect(useTabStore.getState().tabs.map((tab) => tab.id)).toEqual([
        "tab-a",
        "tab-b",
      ]);

      useTabStore.getState().moveTab(0, -1);
      expect(useTabStore.getState().tabs.map((tab) => tab.id)).toEqual([
        "tab-a",
        "tab-b",
      ]);

      useTabStore.getState().moveTab(5, 0);
      expect(useTabStore.getState().tabs.map((tab) => tab.id)).toEqual([
        "tab-a",
        "tab-b",
      ]);

      useTabStore.getState().moveTab(0, 5);
      expect(useTabStore.getState().tabs.map((tab) => tab.id)).toEqual([
        "tab-a",
        "tab-b",
      ]);
    });
  });

  it("setActiveTab sets activeTabId to a valid tab id", () => {
    const tabA = makeTab({ id: "tab-a" });
    const tabB = makeTab({ id: "tab-b" });

    useTabStore.setState({
      tabs: [tabA, tabB],
      activeTabId: tabA.id,
      recentlyClosedTabs: [],
    });

    useTabStore.getState().setActiveTab(tabB.id);

    expect(useTabStore.getState().activeTabId).toBe("tab-b");
  });

  describe("closeTab branch coverage", () => {
    it("closing the only remaining tab sets activeTabId to null", () => {
      const tabA = makeTab({ id: "tab-a" });

      useTabStore.setState({
        tabs: [tabA],
        activeTabId: tabA.id,
        recentlyClosedTabs: [],
      });

      useTabStore.getState().closeTab(tabA.id);

      expect(useTabStore.getState().tabs).toEqual([]);
      expect(useTabStore.getState().activeTabId).toBeNull();
    });

    it("closing the last-position active tab activates the previous tab", () => {
      const tabA = makeTab({ id: "tab-a" });
      const tabB = makeTab({ id: "tab-b" });
      const tabC = makeTab({ id: "tab-c" });

      useTabStore.setState({
        tabs: [tabA, tabB, tabC],
        activeTabId: tabC.id,
        recentlyClosedTabs: [],
      });

      useTabStore.getState().closeTab(tabC.id);

      expect(useTabStore.getState().tabs.map((tab) => tab.id)).toEqual([
        "tab-a",
        "tab-b",
      ]);
      expect(useTabStore.getState().activeTabId).toBe("tab-b");
    });

    it("closing a non-active tab does not change activeTabId", () => {
      const tabA = makeTab({ id: "tab-a" });
      const tabB = makeTab({ id: "tab-b" });
      const tabC = makeTab({ id: "tab-c" });

      useTabStore.setState({
        tabs: [tabA, tabB, tabC],
        activeTabId: tabA.id,
        recentlyClosedTabs: [],
      });

      useTabStore.getState().closeTab(tabC.id);

      expect(useTabStore.getState().tabs.map((tab) => tab.id)).toEqual([
        "tab-a",
        "tab-b",
      ]);
      expect(useTabStore.getState().activeTabId).toBe("tab-a");
    });
  });

  describe("selectors", () => {
    it("selectActiveTab returns the active tab object", () => {
      const tabA = makeTab({ id: "tab-a" });
      const tabB = makeTab({ id: "tab-b" });

      const result = selectActiveTab({
        tabs: [tabA, tabB],
        activeTabId: "tab-b",
        recentlyClosedTabs: [],
      });

      expect(result).toEqual(tabB);
    });

    it("selectActiveTab returns null when activeTabId does not match", () => {
      const tabA = makeTab({ id: "tab-a" });

      const result = selectActiveTab({
        tabs: [tabA],
        activeTabId: "missing",
        recentlyClosedTabs: [],
      });

      expect(result).toBeNull();
    });

    it("selectPinnedTabs returns only pinned tabs", () => {
      const tabA = makeTab({ id: "tab-a", pinned: true });
      const tabB = makeTab({ id: "tab-b", pinned: false });
      const tabC = makeTab({ id: "tab-c", pinned: true });

      const result = selectPinnedTabs({
        tabs: [tabA, tabB, tabC],
        activeTabId: tabA.id,
        recentlyClosedTabs: [],
      });

      expect(result.map((tab) => tab.id)).toEqual(["tab-a", "tab-c"]);
    });

    it("selectUnpinnedTabs returns only unpinned tabs", () => {
      const tabA = makeTab({ id: "tab-a", pinned: true });
      const tabB = makeTab({ id: "tab-b", pinned: false });
      const tabC = makeTab({ id: "tab-c", pinned: false });

      const result = selectUnpinnedTabs({
        tabs: [tabA, tabB, tabC],
        activeTabId: tabB.id,
        recentlyClosedTabs: [],
      });

      expect(result.map((tab) => tab.id)).toEqual(["tab-b", "tab-c"]);
    });
  });
});
