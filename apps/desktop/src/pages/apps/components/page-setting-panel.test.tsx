/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PageSettingPanel } from "./page-setting-panel";
import type { ButtonHTMLAttributes } from "react";

const mocks = vi.hoisted(() => ({
  publishPage: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/stores/auth-store", () => ({
  useAuthStore: (selector: (state: {
    user: { accessToken: string };
    isAuthenticated: boolean;
  }) => unknown) =>
    selector({
      user: {
        accessToken: "session-token",
      },
      isAuthenticated: true,
    }),
}));

vi.mock("@/lib/gateway/config", () => ({
  getGatewayUrl: () => "http://127.0.0.1:18790",
}));

vi.mock("@/lib/gateway", () => ({
  getGatewayUrl: () => "http://127.0.0.1:18790",
  viewPage: vi.fn().mockResolvedValue({
    page: {
      uid: "demo",
      name: "Demo",
      type: "static",
      file: "index.html",
      icon: { type: "lucide", value: "file-text" },
      description: "Demo description",
    },
  }),
  readFile: vi.fn().mockResolvedValue({
    content: "<html><body>Demo</body></html>",
  }),
  publishPage: mocks.publishPage,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

describe("PageSettingPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.publishPage.mockResolvedValue({
      success: true,
      page_uid: "demo",
      url: "/page/demo",
      updated: false,
    });
  });

  it("shows publish button for static pages", () => {
    render(
      <PageSettingPanel
        workspacePath="/tmp/workspace"
        pageUid="demo"
        pageName="Demo"
        pageType="static"
      />
    );

    expect(screen.getByRole("button", { name: /Publish/i })).toBeTruthy();
  });

  it("does not show publish button for non-static pages", () => {
    render(
      <PageSettingPanel
        workspacePath="/tmp/workspace"
        pageUid="demo"
        pageName="Demo"
        pageType="markdown"
      />
    );

    expect(screen.queryByRole("button", { name: /Publish/i })).toBeNull();
  });

  it("reads the static entry html and publishes it", async () => {
    render(
      <PageSettingPanel
        workspacePath="/tmp/workspace"
        pageUid="demo"
        pageName="Demo"
        pageType="static"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Publish/i }));

    await waitFor(() => {
      expect(mocks.publishPage).toHaveBeenCalledWith("http://127.0.0.1:18790", {
        access_token: "session-token",
        uid: "demo",
        title: "Demo",
        icon: { type: "lucide", value: "file-text" },
        description: "Demo description",
        html: "<html><body>Demo</body></html>",
      });
    });
  });
});
