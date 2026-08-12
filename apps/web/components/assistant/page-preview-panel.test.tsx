import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { SWRConfig } from "swr";
import {
  PagePreviewProvider,
  usePagePreview,
} from "./page-preview-context";
import { PagePreviewPanel } from "./page-preview-panel";
import type { Session } from "@/lib/db/schema";
import { emitPageContentChanged } from "@/lib/page-chat/page-content-events";

let mobile = false;

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        "assistant.session.preview": "Preview",
        "assistant.session.previewUnavailable": "Page unavailable",
        "assistant.session.retryPreview": "Retry",
      };
      return labels[key] ?? key;
    },
  }),
}));

vi.mock("@/hooks/assistant/use-mobile", () => ({
  useIsMobile: () => mobile,
}));

const session = {
  id: "session-1",
  agentType: "chat",
  publishedPageId: "page-1",
  pageUserSlug: "alice",
  pageSlug: "guide",
} as Session;

const previewResponse = {
  published_page_id: "page-1",
  user_slug: "alice-new",
  page_slug: "guide-new",
  title: "Latest guide",
  html: "<main>latest</main>",
  url: "/alice-new/guide-new?tab=read",
};

function OpenPreviewButton() {
  const { open, setOpen } = usePagePreview();
  return (
    <button type="button" onClick={() => setOpen(!open)}>
      Preview
    </button>
  );
}

function renderPreview(children?: ReactNode) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <PagePreviewProvider publishedPageId="page-1">
        <OpenPreviewButton />
        <div>Chat transcript remains mounted</div>
        {children ?? <PagePreviewPanel session={session} />}
      </PagePreviewProvider>
    </SWRConfig>,
  );
}

describe("PagePreviewPanel", () => {
  beforeEach(() => {
    mobile = false;
    vi.restoreAllMocks();
  });

  test("stays closed by default and does not fetch", () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify(previewResponse)));

    renderPreview();

    expect(screen.queryByTitle("Latest guide")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("fetches only after Preview opens and renders a sandboxed iframe", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify(previewResponse)));

    renderPreview();
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/page-sessions/session-1/preview?revision=0",
      ),
    );
    const iframe = await screen.findByTitle("Latest guide");
    expect(iframe).toHaveAttribute(
      "sandbox",
      "allow-scripts allow-forms allow-popups allow-modals allow-downloads",
    );
    expect(iframe.getAttribute("sandbox")).not.toContain("allow-same-origin");
    expect(iframe).toHaveAttribute(
      "srcDoc",
      expect.stringContaining("<main>latest</main>"),
    );
  });

  test("uses a desktop right rail and a mobile overlay", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(previewResponse)),
    );

    const { rerender } = render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <PagePreviewProvider publishedPageId="page-1">
          <OpenPreviewButton />
          <PagePreviewPanel session={session} />
        </PagePreviewProvider>
      </SWRConfig>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(await screen.findByRole("complementary", { name: "Preview" }))
      .toHaveAttribute("data-layout", "desktop");

    mobile = true;
    rerender(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <PagePreviewProvider publishedPageId="page-1">
          <OpenPreviewButton />
          <PagePreviewPanel session={session} />
        </PagePreviewProvider>
      </SWRConfig>,
    );

    expect(screen.getByRole("dialog", { name: "Preview" })).toHaveAttribute(
      "data-layout",
      "mobile",
    );
  });

  test("keeps chat mounted and can retry when preview becomes unavailable", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("{}", { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(previewResponse)));

    renderPreview();
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    expect(await screen.findByText("Page unavailable")).toBeVisible();
    expect(screen.getByText("Chat transcript remains mounted")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await screen.findByTitle("Latest guide");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("reloads only the matching open preview", () => {
    function RevisionProbe() {
      const { open, setOpen, revision } = usePagePreview();
      return (
        <>
          <button type="button" onClick={() => setOpen(!open)}>
            Preview
          </button>
          <div data-testid="preview-revision">{revision}</div>
        </>
      );
    }

    render(
      <PagePreviewProvider publishedPageId="page-1">
        <RevisionProbe />
      </PagePreviewProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    act(() => {
      emitPageContentChanged({ publishedPageId: "page-2", chatId: "chat-1" });
    });
    expect(screen.getByTestId("preview-revision")).toHaveTextContent("0");

    act(() => {
      emitPageContentChanged({ publishedPageId: "page-1", chatId: "chat-1" });
    });
    expect(screen.getByTestId("preview-revision")).toHaveTextContent("1");
  });
});
