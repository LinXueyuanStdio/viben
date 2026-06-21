/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PageSection } from "./page-section";
import type { PageConfig } from "@/hooks/use-pages";

const openWorkspacePage = vi.fn();
const mockUsePages = vi.fn();
const mockDeleteMutateAsync = vi.fn();
const mockDuplicateMutate = vi.fn();
const mockReorderMutate = vi.fn();

vi.mock("react-i18next", () => ({
  initReactI18next: {
    type: "3rdParty",
    init: vi.fn(),
  },
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

vi.mock("@/hooks/use-desktop-routing", () => ({
  useDesktopRouting: () => ({
    openWorkspacePage,
  }),
}));

vi.mock("@/hooks/use-pages", () => ({
  usePages: (...args: unknown[]) => mockUsePages(...args),
  useDeletePage: () => ({
    isPending: false,
    mutateAsync: mockDeleteMutateAsync,
  }),
  useDuplicatePage: () => ({
    mutate: mockDuplicateMutate,
  }),
  useReorderPages: () => ({
    mutate: mockReorderMutate,
  }),
}));

vi.mock("@/components/ui/icon-picker", () => ({
  IconDisplay: ({ icon }: { icon?: { value?: string } | string }) => (
    <span data-testid="icon-display">{typeof icon === "string" ? icon : icon?.value}</span>
  ),
}));

vi.mock("@/pages/apps/components/create-page-dialog", () => ({
  CreatePageDialog: () => null,
}));

vi.mock("@/pages/apps/components/edit-page-dialog", () => ({
  EditPageDialog: () => null,
}));

vi.mock("@/pages/apps/components/page-permissions-dialog", () => ({
  PagePermissionsDialog: () => null,
}));

function makePage(uid: string, name: string, parentUid?: string): PageConfig {
  return {
    uid,
    name,
    type: "markdown",
    description: "",
    icon: { type: "lucide", value: "file-text" },
    permission: ["read", "write"],
    parent_uid: parentUid,
    path: `pages/${uid}`,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  } as PageConfig;
}

describe("PageSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePages.mockReturnValue({
      data: {
        pages: [
          makePage("alpha", "Alpha"),
          makePage("bravo", "Bravo", "alpha"),
        ],
        index: {
          root: ["alpha"],
          alpha: ["bravo"],
        },
      },
      isLoading: false,
      error: null,
    });
  });

  it("uses one read-only page tree popup entry when collapsed", async () => {
    render(
      <MemoryRouter initialEntries={["/workspace/ws-1/chat"]}>
        <TooltipProvider>
          <PageSection workspaceId="ws-1" workspacePath="/workspace" collapsed />
        </TooltipProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "page.pages" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Alpha" })).toBeNull();
    expect(screen.queryByRole("button", { name: "page.createPage" })).toBeNull();

    fireEvent.mouseEnter(screen.getByRole("button", { name: "page.pages" }));

    expect(await screen.findByRole("button", { name: "Alpha" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Bravo" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "page.createPage" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "page.createSubpage" })).toBeNull();
    expect(screen.queryByRole("button", { name: "common.edit" })).toBeNull();
  });
});
