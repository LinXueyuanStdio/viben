import { beforeEach, describe, expect, it } from "vitest";
import { executeBuiltin } from "./builtins";
import { useTabStore } from "@/stores/tab-store";
import type { ExecutionContext } from "./types";

function createContext(): ExecutionContext {
  return {
    sessionId: "session-1",
    toolUseId: "tool-use-1",
    requireApproval: async () => true,
  };
}

function getTextContent(result: NonNullable<Awaited<ReturnType<typeof executeBuiltin>>>): string {
  const content = result.content[0];
  if (content.type !== "text") {
    throw new Error(`Expected text content, got ${content.type}`);
  }
  return content.text;
}

describe("action-system builtins", () => {
  beforeEach(() => {
    useTabStore.setState({
      tabs: [],
      activeTabId: null,
      recentlyClosedTabs: [],
    });
  });

  it("returns action detail for navigate_to with route patterns", async () => {
    const result = await executeBuiltin(
      "get_action_detail",
      { action: "navigate_to" },
      createContext()
    );

    expect(result).not.toBeNull();
    expect(result?.isError).toBeUndefined();

    const detail = JSON.parse(getTextContent(result!));
    expect(detail).toMatchObject({
      name: "navigate_to",
      input_schema: {
        type: "object",
        required: ["url"],
      },
    });
    expect(detail.description).toContain("Navigate");
    expect(detail.urls).toEqual(
      expect.arrayContaining([
        "/workspace/:workspaceId/chat",
        "/settings/:section",
      ])
    );
    expect(detail.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pattern: "/workspace/:workspaceId/chat" }),
        expect.objectContaining({ pattern: "/settings/:section" }),
      ])
    );
  });

  it("navigates through the tab navigation store instead of browser history", async () => {
    const initialTabId = useTabStore.getState().openTab({
      navigationState: {
        url: "/documents",
        breadcrumbStack: [{ id: "/documents", label: "Documents", href: "/documents" }],
      },
    });

    const result = await executeBuiltin(
      "navigate_to",
      { url: "/workspace/global/chat" },
      createContext()
    );

    expect(result).not.toBeNull();
    expect(result?.isError).toBeUndefined();
    expect(JSON.parse(getTextContent(result!))).toEqual({
      success: true,
      url: "/workspace/global/chat",
    });

    const tab = useTabStore.getState().tabs.find((entry) => entry.id === initialTabId);
    expect(tab?.historyIndex).toBe(1);
    expect(tab?.navigationHistory[1].url).toBe("/workspace/global/chat");
    expect(tab?.navigationHistory[1].breadcrumbStack.map((item) => item.pattern)).toEqual([
      "/workspace/:workspaceId",
      "/workspace/:workspaceId/chat",
    ]);
  });
});
