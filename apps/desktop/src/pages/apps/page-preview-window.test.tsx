/**
 * @vitest-environment jsdom
 */

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PagePreviewWindow } from "./page-preview-window";
import { homeDir } from "@tauri-apps/api/path";
import { openFolder } from "@/lib/gateway/modules/files";
import { useTabStore } from "@/stores/tab-store";
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
      "/page-preview-window.html?workspace_id=global&workspace_path=/tmp/workspace&slug=demo"
    );
    mockAssign.mockClear();
    mockClose.mockClear();
    mockPrint.mockClear();
    vi.mocked(homeDir).mockResolvedValue("/home/tester");
    vi.mocked(openFolder).mockResolvedValue(undefined);
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
      <PagePreviewWindow navigateToWorkspace={mockAssign} />
    );
    const newTabButton = element.querySelector(
      'button[aria-label="New Tab"]'
    ) as HTMLButtonElement | null;

    expect(newTabButton).not.toBeNull();

    act(() => {
      newTabButton?.click();
    });

    const { tabs, activeTabId } = useTabStore.getState();
    expect(tabs).toHaveLength(0);
    expect(activeTabId).toBeNull();
    expect(mockAssign).toHaveBeenCalledWith("/workspace?viben_new_tab=1");
  });

  it("wires page-preview menu shortcuts to real actions", async () => {
    const element = render(
      <PagePreviewWindow navigateToWorkspace={mockAssign} />
    );

    expect(element.querySelector('[data-preview-zoom="1.0"]')).not.toBeNull();

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "=", ctrlKey: true })
      );
    });
    expect(element.querySelector('[data-preview-zoom="1.1"]')).not.toBeNull();

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "-", ctrlKey: true })
      );
    });
    expect(element.querySelector('[data-preview-zoom="1.0"]')).not.toBeNull();

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "f", ctrlKey: true })
      );
    });
    expect(element.querySelector('input[aria-label="Find..."]')).not.toBeNull();

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "p", ctrlKey: true })
      );
    });
    expect(mockPrint).toHaveBeenCalled();

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "l",
          ctrlKey: true,
          altKey: true,
        })
      );
      await Promise.resolve();
    });
    expect(openFolder).toHaveBeenCalledWith(
      "http://127.0.0.1:18790",
      "/home/tester/Downloads"
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
        })
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
        })
      );
    });

    expect(useTabStore.getState().tabs).toHaveLength(1);
    expect(mockAssign).toHaveBeenCalledWith("/workspace/global/chat");
  });
});
