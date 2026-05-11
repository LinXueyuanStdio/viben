// apps/desktop/src/navigation/navigate.test.ts
import { describe, it, expect, vi } from "vitest";
import { buildNavigateLeaf, isStackPrefixOf, navigate, popToBreadcrumb } from "./navigate";
import type { BreadcrumbStackItem } from "./breadcrumb-builder";

describe("buildNavigateLeaf", () => {
  it("builds leaf from URL with registry defaults", () => {
    const leaf = buildNavigateLeaf("/workspace/x/agent/gpt");
    expect(leaf.id).toBe("/workspace/x/agent/gpt");
    expect(leaf.label).toBe("gpt");
    expect(leaf.pattern).toBe("/workspace/:workspaceId/agent/:agentId");
    expect(leaf.href).toBe("/workspace/x/agent/gpt");
  });

  it("applies headers overrides", () => {
    const leaf = buildNavigateLeaf("/workspace/x/agent/gpt", {
      label: "GPT-4o",
      id: "custom-id",
      icon: { type: "lucide", value: "sparkles" },
    });
    expect(leaf.id).toBe("custom-id");
    expect(leaf.label).toBe("GPT-4o");
    expect(leaf.icon).toEqual({ type: "lucide", value: "sparkles" });
  });

  it("handles unknown URL gracefully", () => {
    const leaf = buildNavigateLeaf("/unknown/path");
    expect(leaf.label).toBe("path"); // last segment
    expect(leaf.pattern).toBeUndefined();
  });
});

describe("isStackPrefixOf", () => {
  it("returns true when stack top is ancestor of target", () => {
    const stack: BreadcrumbStackItem[] = [
      { id: "1", label: "Workspaces", pattern: "/workspace", href: "/workspace" },
      { id: "2", label: "my-proj", pattern: "/workspace/:workspaceId", href: "/workspace/my-proj" },
      { id: "3", label: "Agents", pattern: "/workspace/:workspaceId/agent", href: "/workspace/my-proj/agent" },
    ];
    const match = { pattern: "/workspace/:workspaceId/agent/:agentId", params: {}, icon: {} as any, title: "", entry: {} as any };
    expect(isStackPrefixOf(stack, match)).toBe(true);
  });

  it("returns false when stack top is unrelated", () => {
    const stack: BreadcrumbStackItem[] = [
      { id: "1", label: "Settings", pattern: "/settings", href: "/settings" },
    ];
    const match = { pattern: "/workspace/:workspaceId/agent/:agentId", params: {}, icon: {} as any, title: "", entry: {} as any };
    expect(isStackPrefixOf(stack, match)).toBe(false);
  });

  it("returns false for empty stack", () => {
    expect(isStackPrefixOf([], { pattern: "/documents", params: {}, icon: {} as any, title: "", entry: {} as any })).toBe(false);
  });
});

describe("navigate", () => {
  function createMockTabStore() {
    return {
      activeTabId: "tab-1",
      pushNavigation: vi.fn(),
      replaceNavigation: vi.fn(),
      resetNavigation: vi.fn(),
    };
  }

  it("dispatches push with leaf to pushNavigation", () => {
    const store = createMockTabStore();
    navigate("push", "/workspace/my-proj/agent/gpt", undefined, store);

    expect(store.pushNavigation).toHaveBeenCalledOnce();
    expect(store.pushNavigation).toHaveBeenCalledWith(
      "tab-1",
      "/workspace/my-proj/agent/gpt",
      expect.objectContaining({
        href: "/workspace/my-proj/agent/gpt",
        pattern: "/workspace/:workspaceId/agent/:agentId",
      }),
    );
    expect(store.replaceNavigation).not.toHaveBeenCalled();
    expect(store.resetNavigation).not.toHaveBeenCalled();
  });

  it("dispatches replace with leaf to replaceNavigation", () => {
    const store = createMockTabStore();
    navigate("replace", "/workspace/my-proj/agent/gpt", { label: "GPT" }, store);

    expect(store.replaceNavigation).toHaveBeenCalledOnce();
    expect(store.replaceNavigation).toHaveBeenCalledWith(
      "tab-1",
      "/workspace/my-proj/agent/gpt",
      expect.objectContaining({
        label: "GPT",
        href: "/workspace/my-proj/agent/gpt",
      }),
    );
    expect(store.pushNavigation).not.toHaveBeenCalled();
    expect(store.resetNavigation).not.toHaveBeenCalled();
  });

  it("dispatches reset with full cold-start breadcrumb stack", () => {
    const store = createMockTabStore();
    navigate("reset", "/workspace/my-proj/agent/gpt", undefined, store);

    expect(store.resetNavigation).toHaveBeenCalledOnce();
    const [tabId, url, stack] = store.resetNavigation.mock.calls[0];
    expect(tabId).toBe("tab-1");
    expect(url).toBe("/workspace/my-proj/agent/gpt");
    // Cold-start builds ancestors: at minimum /workspace and /workspace/:workspaceId ancestor entries + the leaf
    expect(stack.length).toBeGreaterThanOrEqual(2);
    expect(stack[stack.length - 1].href).toBe("/workspace/my-proj/agent/gpt");
  });

  it("applies headers overrides in all methods", () => {
    const store = createMockTabStore();
    const headers = { label: "Custom", id: "custom-id" };

    navigate("push", "/workspace/my-proj", headers, store);
    const leaf = store.pushNavigation.mock.calls[0][2];
    expect(leaf.id).toBe("custom-id");
    expect(leaf.label).toBe("Custom");
  });
});

describe("popToBreadcrumb", () => {
  it("jumps to existing history entry when URL matches (dedup path)", () => {
    const store = {
      activeTabId: "tab-1",
      getCurrentState: vi.fn().mockReturnValue({
        url: "/workspace/my-proj/agent/gpt",
        breadcrumbStack: [
          { id: "1", label: "Workspace", href: "/workspace/my-proj", pattern: "/workspace/:workspaceId" },
          { id: "2", label: "Agents", href: "/workspace/my-proj/agent", pattern: "/workspace/:workspaceId/agent" },
          { id: "3", label: "GPT", href: "/workspace/my-proj/agent/gpt", pattern: "/workspace/:workspaceId/agent/:agentId" },
        ],
      }),
      findHistoryEntryByUrl: vi.fn().mockReturnValue(2), // found at history index 2
      jumpToHistory: vi.fn(),
      insertHistoryBeforeCurrent: vi.fn(),
    };

    popToBreadcrumb(0, store); // click on breadcrumb index 0 (Workspace)

    expect(store.findHistoryEntryByUrl).toHaveBeenCalledWith("tab-1", "/workspace/my-proj");
    expect(store.jumpToHistory).toHaveBeenCalledWith("tab-1", 2);
    expect(store.insertHistoryBeforeCurrent).not.toHaveBeenCalled();
  });

  it("inserts before current when no history match (insert path)", () => {
    const breadcrumbStack = [
      { id: "1", label: "Workspace", href: "/workspace/my-proj", pattern: "/workspace/:workspaceId" },
      { id: "2", label: "Agents", href: "/workspace/my-proj/agent", pattern: "/workspace/:workspaceId/agent" },
      { id: "3", label: "GPT", href: "/workspace/my-proj/agent/gpt", pattern: "/workspace/:workspaceId/agent/:agentId" },
    ];
    const store = {
      activeTabId: "tab-1",
      getCurrentState: vi.fn().mockReturnValue({
        url: "/workspace/my-proj/agent/gpt",
        breadcrumbStack,
      }),
      findHistoryEntryByUrl: vi.fn().mockReturnValue(-1), // not found
      jumpToHistory: vi.fn(),
      insertHistoryBeforeCurrent: vi.fn(),
    };

    popToBreadcrumb(1, store); // click on breadcrumb index 1 (Agents)

    expect(store.jumpToHistory).not.toHaveBeenCalled();
    expect(store.insertHistoryBeforeCurrent).toHaveBeenCalledWith("tab-1", {
      url: "/workspace/my-proj/agent",
      breadcrumbStack: breadcrumbStack.slice(0, 2), // items 0..1
    });
  });

  it("does nothing when current state is null", () => {
    const store = {
      activeTabId: "tab-1",
      getCurrentState: vi.fn().mockReturnValue(null),
      findHistoryEntryByUrl: vi.fn(),
      jumpToHistory: vi.fn(),
      insertHistoryBeforeCurrent: vi.fn(),
    };

    popToBreadcrumb(0, store);

    expect(store.findHistoryEntryByUrl).not.toHaveBeenCalled();
    expect(store.jumpToHistory).not.toHaveBeenCalled();
    expect(store.insertHistoryBeforeCurrent).not.toHaveBeenCalled();
  });

  it("does nothing when target item has no href", () => {
    const store = {
      activeTabId: "tab-1",
      getCurrentState: vi.fn().mockReturnValue({
        url: "/workspace/my-proj",
        breadcrumbStack: [
          { id: "1", label: "No Link" }, // no href
        ],
      }),
      findHistoryEntryByUrl: vi.fn(),
      jumpToHistory: vi.fn(),
      insertHistoryBeforeCurrent: vi.fn(),
    };

    popToBreadcrumb(0, store);

    expect(store.findHistoryEntryByUrl).not.toHaveBeenCalled();
  });

  it("does nothing when index is out of bounds", () => {
    const store = {
      activeTabId: "tab-1",
      getCurrentState: vi.fn().mockReturnValue({
        url: "/workspace/my-proj",
        breadcrumbStack: [
          { id: "1", label: "Workspace", href: "/workspace/my-proj" },
        ],
      }),
      findHistoryEntryByUrl: vi.fn(),
      jumpToHistory: vi.fn(),
      insertHistoryBeforeCurrent: vi.fn(),
    };

    popToBreadcrumb(5, store); // out of bounds

    expect(store.findHistoryEntryByUrl).not.toHaveBeenCalled();
  });
});
