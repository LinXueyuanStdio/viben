/**
 * @vitest-environment jsdom
 */

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PagePreviewWindow } from "./page-preview-window";
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

vi.mock("react-i18next", () => ({
  initReactI18next: {
    type: "3rdParty",
    init: vi.fn(),
  },
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    close: vi.fn(),
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
});
