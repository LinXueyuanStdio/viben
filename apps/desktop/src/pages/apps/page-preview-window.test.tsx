/**
 * @vitest-environment jsdom
 */

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PagePreviewWindow } from "./page-preview-window";
import { homeDir } from "@tauri-apps/api/path";
import { getGatewayClient } from "@/lib/gateway";
import { openFolder } from "@/lib/gateway/modules/files";
import { getScopedTabStore, useTabStore } from "@/stores/tab-store";
import type { ChatListItem } from "@/lib/gateway/types/workspace";
import type { PageConfig } from "@/lib/gateway/types/page";
import type { Root } from "react-dom/client";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const mockPage: PageConfig = {
  slug: "demo",
  name: "Demo",
  type: "static",
  icon: { type: "lucide", value: "file-text" },
  permission: ["read"],
  path: "/tmp/workspace/pages/demo",
  file: "index.html",
};

const mockAssign = vi.fn();
const mockClose = vi.fn();
const mockPrint = vi.fn();
const mockListAgentSessions = vi.fn();
const mockCreateAgentSession = vi.fn();
const mockAppendSessionMessage = vi.fn();
const mockListGroupChatSessions = vi.fn();
const mockCreateGroupChatSession = vi.fn();
const mockSendGroupChatMessage = vi.fn();

const mockChatItems: ChatListItem[] = [
  {
    id: "agent-alpha",
    name: "Alpha Agent",
    item_type: "agent",
    source: "workspace",
    workspace_path: "/tmp/workspace",
    icon_type: "agent",
  },
  {
    id: "group-room",
    name: "Project Room",
    item_type: "group_chat",
    source: "workspace",
    workspace_path: "/tmp/workspace",
    icon_type: "group_chat",
  },
];

vi.mock("react-i18next", () => ({
  initReactI18next: {
    type: "3rdParty",
    init: vi.fn(),
  },
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock("@tauri-apps/api/path", () => ({
  homeDir: vi.fn().mockResolvedValue("/home/tester"),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    label: "page-preview-test",
    close: mockClose,
    isFullscreen: vi.fn().mockResolvedValue(false),
    onResized: vi.fn().mockResolvedValue(() => undefined),
  }),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-os", () => ({
  platform: () => "linux",
}));

vi.mock("@/lib/gateway/modules/files", () => ({
  openFolder: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/gateway", () => ({
  getGatewayClient: vi.fn(),
}));

vi.mock("@/hooks/use-workspace-resources", () => ({
  useChatList: () => ({
    items: mockChatItems,
    groupChats: mockChatItems.filter((item) => item.item_type === "group_chat"),
    executors: [],
    agents: mockChatItems.filter((item) => item.item_type === "agent"),
    counts: { group_chats: 1, executors: 0, agents: 1 },
    total: mockChatItems.length,
    loading: false,
    error: null,
    refresh: vi.fn(),
    agentOperations: {
      defaultAgentId: null,
      setDefaultAgent: vi.fn(),
      removeAgent: vi.fn(),
      updateAgent: vi.fn(),
      createAgent: vi.fn(),
    },
  }),
}));

vi.mock("@/hooks/use-pages", () => ({
  usePage: () => ({
    data: mockPage,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-vite-preview", () => ({
  useVitePreview: () => ({
    previewUrl: null,
    status: "idle",
    error: null,
    startPreview: vi.fn(),
    stopPreview: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-theme", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));

vi.mock("./components", () => ({
  PagePreview: () => <div data-testid="page-preview" />,
}));

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

describe("PagePreviewWindow", () => {
  beforeEach(() => {
    window.history.replaceState(
      null,
      "",
      "/page-preview-window.html?workspace_id=global&workspace_path=/tmp/workspace&slug=demo",
    );
    mockAssign.mockClear();
    mockClose.mockClear();
    mockPrint.mockClear();
    vi.mocked(homeDir).mockResolvedValue("/home/tester");
    vi.mocked(openFolder).mockResolvedValue(undefined);
    mockListAgentSessions.mockResolvedValue([]);
    mockCreateAgentSession.mockResolvedValue({
      id: "agent-session-1",
      agent_id: "agent-alpha",
      task_id: null,
      prompt: null,
      status: "idle",
      workspace_path: "/tmp/workspace",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      metadata: {},
    });
    mockAppendSessionMessage.mockResolvedValue({
      timestamp: "2026-01-01T00:00:00.000Z",
      role: "user",
      content: "",
    });
    mockListGroupChatSessions.mockResolvedValue([]);
    mockCreateGroupChatSession.mockResolvedValue({
      id: "group-session-1",
      group_chat_id: "group-room",
      title: "Forward - Demo",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      active_agents: [],
      status: "active",
    });
    mockSendGroupChatMessage.mockResolvedValue({
      message: {
        id: "message-1",
        type: "user",
        timestamp: "2026-01-01T00:00:00.000Z",
        sender_id: "user-1",
        sender_name: "You",
        content: "",
      },
      agents_triggered: [],
    });
    vi.mocked(getGatewayClient).mockReturnValue({
      listAgentSessions: mockListAgentSessions,
      createAgentSession: mockCreateAgentSession,
      appendSessionMessage: mockAppendSessionMessage,
      listGroupChatSessions: mockListGroupChatSessions,
      createGroupChatSession: mockCreateGroupChatSession,
      sendGroupChatMessage: mockSendGroupChatMessage,
    } as unknown as ReturnType<typeof getGatewayClient>);
    Object.defineProperty(window, "print", {
      configurable: true,
      writable: true,
      value: mockPrint,
    });
    useTabStore.setState({
      tabs: [],
      activeTabId: null,
      recentlyClosedTabs: [],
    });
    getScopedTabStore("page-preview-test").setState({
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
    vi.clearAllMocks();
  });

  it("opens the main app with a new-tab request from the preview window plus button", () => {
    const element = render(
      <PagePreviewWindow navigateToWorkspace={mockAssign} />,
    );
    const newTabButton = element.querySelector(
      'button[aria-label="New Tab"]',
    ) as HTMLButtonElement | null;

    expect(newTabButton).not.toBeNull();

    act(() => {
      newTabButton?.click();
    });

    expect(useTabStore.getState().tabs).toHaveLength(0);
    const scopedState = getScopedTabStore("page-preview-test").getState();
    expect(scopedState.tabs).toHaveLength(1);
    expect(scopedState.activeTabId).toBe(scopedState.tabs[0].id);
    expect(scopedState.getCurrentUrl(scopedState.tabs[0].id)).toBe(
      "/workspace",
    );
    expect(mockAssign).toHaveBeenCalledWith("/workspace?viben_new_tab=1");
  });

  it("uses preview-specific styling for tabs opened inside the preview window", () => {
    const element = render(
      <PagePreviewWindow navigateToWorkspace={mockAssign} />,
    );

    const newTabButton = element.querySelector(
      'button[aria-label="New Tab"]',
    ) as HTMLButtonElement | null;

    act(() => {
      newTabButton?.click();
    });

    expect(
      element.querySelector("[data-preview-window-tab='true']"),
    ).not.toBeNull();
  });

  it("wires page-preview menu shortcuts to real actions", async () => {
    const element = render(
      <PagePreviewWindow navigateToWorkspace={mockAssign} />,
    );

    expect(element.querySelector('[data-preview-zoom="1.0"]')).not.toBeNull();

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "=", ctrlKey: true }),
      );
    });
    expect(element.querySelector('[data-preview-zoom="1.1"]')).not.toBeNull();

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "-", ctrlKey: true }),
      );
    });
    expect(element.querySelector('[data-preview-zoom="1.0"]')).not.toBeNull();

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "f", ctrlKey: true }),
      );
    });
    expect(element.querySelector('input[aria-label="Find..."]')).not.toBeNull();

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "p", ctrlKey: true }),
      );
    });
    expect(mockPrint).toHaveBeenCalled();

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "l",
          ctrlKey: true,
          altKey: true,
        }),
      );
      await Promise.resolve();
    });
    expect(openFolder).toHaveBeenCalledWith(
      "http://127.0.0.1:18790",
      "/home/tester/Downloads",
    );
  });

  it("uses the tab store for close-all tabs", () => {
    useTabStore.setState({
      tabs: [
        {
          id: "tab-current",
          pinned: false,
          historyIndex: 0,
          navigationHistory: [
            {
              url: "/workspace/global/pages/demo",
              breadcrumbStack: [
                { id: "root", label: "Root", href: "/" },
                {
                  id: "demo",
                  label: "Demo",
                  href: "/workspace/global/pages/demo",
                },
              ],
            },
          ],
        },
      ],
      activeTabId: "tab-current",
      recentlyClosedTabs: [],
    });

    render(<PagePreviewWindow navigateToWorkspace={mockAssign} />);

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "w",
          ctrlKey: true,
          altKey: true,
        }),
      );
    });

    expect(useTabStore.getState().tabs).toHaveLength(0);
    expect(useTabStore.getState().recentlyClosedTabs).toHaveLength(1);
    expect(mockClose).toHaveBeenCalled();
  });

  it("uses the tab store to reopen a closed tab", () => {
    const restoredTab = {
      id: "tab-a",
      pinned: false,
      historyIndex: 0,
      navigationHistory: [
        {
          url: "/workspace/global/chat",
          breadcrumbStack: [
            { id: "root", label: "Root", href: "/" },
            { id: "chat", label: "Chat", href: "/workspace/global/chat" },
          ],
        },
      ],
    };

    useTabStore.setState({
      tabs: [],
      activeTabId: null,
      recentlyClosedTabs: [
        {
          tab: restoredTab,
          closedAt: Date.now(),
          originIndex: 0,
        },
      ],
    });

    render(<PagePreviewWindow navigateToWorkspace={mockAssign} />);

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "t",
          ctrlKey: true,
          shiftKey: true,
        }),
      );
    });

    expect(useTabStore.getState().tabs).toHaveLength(1);
    expect(mockAssign).toHaveBeenCalledWith("/workspace/global/chat");
  });

  it("forwards the preview link to an agent session", async () => {
    const element = render(
      <PagePreviewWindow navigateToWorkspace={mockAssign} />,
    );

    const moreButton = element.querySelector(
      'button[aria-label="More"]',
    ) as HTMLButtonElement | null;
    expect(moreButton).not.toBeNull();

    await act(async () => {
      moreButton?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
      await Promise.resolve();
    });

    const forwardItem = Array.from(
      document.body.querySelectorAll('[role="menuitem"]'),
    ).find((item) => item.textContent?.includes("Forward")) as
      | HTMLElement
      | undefined;
    expect(forwardItem).toBeDefined();

    await act(async () => {
      forwardItem?.click();
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain("Send to");

    const targetButton = Array.from(
      document.body.querySelectorAll("button"),
    ).find((button) => button.textContent?.includes("Alpha Agent")) as
      | HTMLButtonElement
      | undefined;
    expect(targetButton).toBeDefined();

    await act(async () => {
      targetButton?.click();
      await Promise.resolve();
    });

    const messageInput = document.body.querySelector(
      'textarea[aria-label="Message"]',
    ) as HTMLTextAreaElement | null;
    expect(messageInput).not.toBeNull();

    await act(async () => {
      if (messageInput) {
        const valueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          "value",
        )?.set;
        valueSetter?.call(messageInput, "Please review");
        messageInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });

    const sendButton = Array.from(
      document.body.querySelectorAll("button"),
    ).find((button) => button.textContent?.includes("Send")) as
      | HTMLButtonElement
      | undefined;
    expect(sendButton).toBeDefined();

    await act(async () => {
      sendButton?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockListAgentSessions).toHaveBeenCalledWith(
      "agent-alpha",
      "/tmp/workspace",
    );
    expect(mockCreateAgentSession).toHaveBeenCalledWith("agent-alpha", {
      prompt: "Forward - Demo",
      workspace_path: "/tmp/workspace",
    });
    expect(mockAppendSessionMessage).toHaveBeenCalledWith(
      "agent-alpha",
      "agent-session-1",
      expect.objectContaining({
        role: "user",
        content: expect.stringContaining("Please review"),
      }),
    );
    expect(mockAppendSessionMessage.mock.calls[0][2].content).toContain("Demo");
    expect(mockAppendSessionMessage.mock.calls[0][2].content).toContain(
      "http://127.0.0.1:18790/api/page/serve?workspace_path=%2Ftmp%2Fworkspace&slug=demo&theme=light",
    );
  });

  it("forwards the preview link to a group chat session", async () => {
    const element = render(
      <PagePreviewWindow navigateToWorkspace={mockAssign} />,
    );

    const moreButton = element.querySelector(
      'button[aria-label="More"]',
    ) as HTMLButtonElement | null;
    expect(moreButton).not.toBeNull();

    await act(async () => {
      moreButton?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
      await Promise.resolve();
    });

    const forwardItem = Array.from(
      document.body.querySelectorAll('[role="menuitem"]'),
    ).find((item) => item.textContent?.includes("Forward")) as
      | HTMLElement
      | undefined;
    expect(forwardItem).toBeDefined();

    await act(async () => {
      forwardItem?.click();
      await Promise.resolve();
    });

    const targetButton = Array.from(
      document.body.querySelectorAll("button"),
    ).find((button) => button.textContent?.includes("Project Room")) as
      | HTMLButtonElement
      | undefined;
    expect(targetButton).toBeDefined();

    await act(async () => {
      targetButton?.click();
      await Promise.resolve();
    });

    const sendButton = Array.from(
      document.body.querySelectorAll("button"),
    ).find((button) => button.textContent?.includes("Send")) as
      | HTMLButtonElement
      | undefined;
    expect(sendButton).toBeDefined();

    await act(async () => {
      sendButton?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockListGroupChatSessions).toHaveBeenCalledWith(
      "group-room",
      "/tmp/workspace",
    );
    expect(mockCreateGroupChatSession).toHaveBeenCalledWith(
      "group-room",
      "/tmp/workspace",
      { title: "Forward - Demo" },
    );
    expect(mockSendGroupChatMessage).toHaveBeenCalledWith(
      "group-room",
      "group-session-1",
      "/tmp/workspace",
      expect.objectContaining({
        content: expect.stringContaining("Demo"),
        sender_id: "user-1",
        sender_name: "You",
      }),
    );
  });
});
