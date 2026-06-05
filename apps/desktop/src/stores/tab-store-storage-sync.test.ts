/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  TAB_STORE_STORAGE_KEY,
  installTabStoreStorageSync,
  useTabStore,
} from "./tab-store";

function persistedTabStore(tabId: string, url: string) {
  return JSON.stringify({
    state: {
      tabs: [
        {
          id: tabId,
          pinned: false,
          historyIndex: 0,
          navigationHistory: [
            {
              url,
              breadcrumbStack: [
                {
                  id: url,
                  label: url,
                  href: url,
                },
              ],
            },
          ],
        },
      ],
      activeTabId: tabId,
      recentlyClosedTabs: [],
    },
    version: 2,
  });
}

describe("tab store storage sync", () => {
  let unsubscribe: (() => void) | null = null;

  beforeEach(() => {
    localStorage.clear();
    useTabStore.setState({
      tabs: [],
      activeTabId: null,
      recentlyClosedTabs: [],
    });
  });

  afterEach(() => {
    unsubscribe?.();
    unsubscribe = null;
    localStorage.clear();
  });

  it("rehydrates when another window writes the tab store", async () => {
    unsubscribe = installTabStoreStorageSync();
    const nextValue = persistedTabStore("external-tab", "/workspace/external");

    localStorage.setItem(TAB_STORE_STORAGE_KEY, nextValue);
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: TAB_STORE_STORAGE_KEY,
        newValue: nextValue,
        oldValue: null,
        storageArea: localStorage,
      })
    );
    await Promise.resolve();

    expect(useTabStore.getState().tabs.map((tab) => tab.id)).toEqual([
      "external-tab",
    ]);
    expect(useTabStore.getState().activeTabId).toBe("external-tab");
  });
});
