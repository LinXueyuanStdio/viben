/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PageSettingPanel } from "./page-setting-panel";
import type { ButtonHTMLAttributes } from "react";
import { usePagePublishStore } from "@/stores/page-publish-store";

const mocks = vi.hoisted(() => ({
  publishPage: vi.fn(),
  openUrl: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  writeText: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
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

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: mocks.openUrl,
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
    usePagePublishStore.getState().actions.reset();
    Object.assign(navigator, {
      clipboard: {
        writeText: mocks.writeText,
      },
    });
    mocks.publishPage.mockResolvedValue({
      success: true,
      page_uid: "demo",
      url: "/page/user-1/demo",
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

  it("shows published status and URL after a successful publish", async () => {
    render(
      <PageSettingPanel
        workspacePath="/tmp/workspace"
        pageUid="demo"
        pageName="Demo"
        pageType="static"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Publish/i }));

    expect(await screen.findByText("https://viben-web.vercel.app")).toBeTruthy();
    expect(screen.getByText("/page/user-1/demo")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Copy published URL/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Open published page/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /搜索引擎索引/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /嵌入此页面/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /分享到社交平台/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /在浏览器打开/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Update Publish/i })).toBeTruthy();
  });

  it("copies the full published page URL", async () => {
    render(
      <PageSettingPanel
        workspacePath="/tmp/workspace"
        pageUid="demo"
        pageName="Demo"
        pageType="static"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Publish/i }));

    const copyButton = await screen.findByRole("button", {
      name: /Copy published URL/i,
    });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(mocks.writeText).toHaveBeenCalledWith(
        "https://viben-web.vercel.app/page/user-1/demo"
      );
    });
  });

  it("opens the published page in the browser", async () => {
    render(
      <PageSettingPanel
        workspacePath="/tmp/workspace"
        pageUid="demo"
        pageName="Demo"
        pageType="static"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Publish/i }));

    const openButton = await screen.findByRole("button", {
      name: /在浏览器打开/i,
    });
    fireEvent.click(openButton);

    await waitFor(() => {
      expect(mocks.openUrl).toHaveBeenCalledWith(
        "https://viben-web.vercel.app/page/user-1/demo"
      );
    });
  });

  it("clears published status when switching to another page", async () => {
    const { rerender } = render(
      <PageSettingPanel
        workspacePath="/tmp/workspace"
        pageUid="demo"
        pageName="Demo"
        pageType="static"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Publish/i }));
    expect(await screen.findByText("/page/user-1/demo")).toBeTruthy();

    rerender(
      <PageSettingPanel
        workspacePath="/tmp/workspace"
        pageUid="other-page"
        pageName="Other Page"
        pageType="static"
      />
    );

    expect(screen.queryByText("/page/user-1/demo")).toBeNull();
    expect(screen.getByRole("button", { name: /Publish/i })).toBeTruthy();
  });

  it("restores the current page published status when switching back", async () => {
    const { rerender } = render(
      <PageSettingPanel
        workspacePath="/tmp/workspace"
        pageUid="demo"
        pageName="Demo"
        pageType="static"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Publish/i }));
    expect(await screen.findByText("/page/user-1/demo")).toBeTruthy();

    rerender(
      <PageSettingPanel
        workspacePath="/tmp/workspace"
        pageUid="other-page"
        pageName="Other Page"
        pageType="static"
      />
    );
    expect(screen.queryByText("/page/user-1/demo")).toBeNull();

    rerender(
      <PageSettingPanel
        workspacePath="/tmp/workspace"
        pageUid="demo"
        pageName="Demo"
        pageType="static"
      />
    );

    expect(screen.getByText("/page/user-1/demo")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Update Publish/i })).toBeTruthy();
  });

  it("restores publishing state when switching back before publish completes", async () => {
    let resolvePublish: (value: {
      success: boolean;
      page_uid: string;
      url: string;
      updated: boolean;
    }) => void;
    mocks.publishPage.mockReturnValue(
      new Promise((resolve) => {
        resolvePublish = resolve;
      })
    );

    const { rerender } = render(
      <PageSettingPanel
        workspacePath="/tmp/workspace"
        pageUid="demo"
        pageName="Demo"
        pageType="static"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Publish/i }));
    expect(
      await screen.findByRole("button", { name: /Publishing.../i })
    ).toBeTruthy();

    rerender(
      <PageSettingPanel
        workspacePath="/tmp/workspace"
        pageUid="other-page"
        pageName="Other Page"
        pageType="static"
      />
    );
    expect(screen.getByRole("button", { name: /Publish/i })).toBeTruthy();

    rerender(
      <PageSettingPanel
        workspacePath="/tmp/workspace"
        pageUid="demo"
        pageName="Demo"
        pageType="static"
      />
    );
    expect(screen.getByRole("button", { name: /Publishing.../i })).toBeTruthy();

    resolvePublish!({
      success: true,
      page_uid: "demo",
      url: "/page/user-1/demo",
      updated: false,
    });

    expect(await screen.findByText("/page/user-1/demo")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Update Publish/i })).toBeTruthy();
  });

  it("shows the search indexing panel", async () => {
    render(
      <PageSettingPanel
        workspacePath="/tmp/workspace"
        pageUid="demo"
        pageName="Demo"
        pageType="static"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Publish/i }));
    fireEvent.click(await screen.findByRole("button", { name: /搜索引擎索引/i }));

    expect(screen.getByRole("button", { name: /Back to publish settings/i })).toBeTruthy();
    expect(screen.getByText("SEO 预览")).toBeTruthy();
    expect(screen.getByLabelText("链接标题")).toBeTruthy();
    expect(screen.getByLabelText("描述")).toBeTruthy();
    expect(screen.getByRole("switch", { name: /可在网络上被发现/i })).toBeTruthy();
  });

  it("shows the embed panel and copies iframe code", async () => {
    render(
      <PageSettingPanel
        workspacePath="/tmp/workspace"
        pageUid="demo"
        pageName="Demo"
        pageType="static"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Publish/i }));
    fireEvent.click(await screen.findByRole("button", { name: /嵌入此页面/i }));

    const embedInput = screen.getByLabelText("嵌入代码") as HTMLTextAreaElement;
    expect(embedInput.value).toBe(
      '<iframe src="https://viben-web.vercel.app/page/user-1/demo" width="100%" height="600" frameborder="0" allowfullscreen />'
    );

    fireEvent.click(screen.getByRole("button", { name: /复制代码/i }));
    await waitFor(() => {
      expect(mocks.writeText).toHaveBeenCalledWith(
        '<iframe src="https://viben-web.vercel.app/page/user-1/demo" width="100%" height="600" frameborder="0" allowfullscreen />'
      );
    });
  });

  it("shows the social sharing panel", async () => {
    render(
      <PageSettingPanel
        workspacePath="/tmp/workspace"
        pageUid="demo"
        pageName="Demo"
        pageType="static"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Publish/i }));
    fireEvent.click(await screen.findByRole("button", { name: /分享到社交平台/i }));

    expect(screen.getByRole("button", { name: /分享到 X/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /分享到 Whatsapp/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /分享到 Facebook/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /分享到 Linkin/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /分享到 电子邮件/i })).toBeTruthy();
  });

  it("updates the published state when publishing again", async () => {
    mocks.publishPage
      .mockResolvedValueOnce({
        success: true,
        page_uid: "demo",
        url: "/page/user-1/demo",
        updated: false,
      })
      .mockResolvedValueOnce({
        success: true,
        page_uid: "demo",
        url: "/page/user-1/demo",
        updated: true,
      });

    render(
      <PageSettingPanel
        workspacePath="/tmp/workspace"
        pageUid="demo"
        pageName="Demo"
        pageType="static"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Publish/i }));

    const updateButton = await screen.findByRole("button", {
      name: /Update Publish/i,
    });
    fireEvent.click(updateButton);

    await waitFor(() => {
      expect(mocks.publishPage).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByText("/page/user-1/demo")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Update Publish/i })).toBeTruthy();
  });

  it("does not enter published state when publish returns a failure", async () => {
    mocks.publishPage.mockResolvedValue({
      success: false,
      error: "Publish failed",
    });

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
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Publish failed",
        expect.objectContaining({ description: "Publish failed" })
      );
    });

    expect(screen.queryByText("Published")).toBeNull();
    expect(screen.queryByText("/page/user-1/demo")).toBeNull();
    expect(screen.getByRole("button", { name: /Publish/i })).toBeTruthy();
  });
});
