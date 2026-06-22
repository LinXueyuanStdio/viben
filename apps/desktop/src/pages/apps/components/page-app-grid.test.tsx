/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PageIconGrid } from "./page-app-grid";

const mocks = vi.hoisted(() => ({
  createMutateAsync: vi.fn(),
  deleteMutateAsync: vi.fn(),
  openWorkspacePage: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  pagesResult: { pages: [], index: { root: [] } } as {
    pages: Array<{
      uid: string;
      name: string;
      type: "markdown";
      icon: { type: "lucide"; value: string };
      permission: Array<"read" | "write">;
      path: string;
    }>;
    index: Record<string, string[]>;
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

vi.mock("@/hooks/use-desktop-routing", () => ({
  useDesktopRouting: () => ({
    openWorkspacePage: mocks.openWorkspacePage,
  }),
}));

vi.mock("@/hooks/use-pages", () => ({
  usePages: () => ({
    data: mocks.pagesResult,
    isLoading: false,
    error: null,
  }),
  useCreatePage: () => ({
    mutateAsync: mocks.createMutateAsync,
    isPending: false,
  }),
  useDeletePage: () => ({
    mutateAsync: mocks.deleteMutateAsync,
    isPending: false,
  }),
}));

vi.mock("./edit-page-dialog", () => ({
  EditPageDialog: () => null,
}));

vi.mock("./page-permissions-dialog", () => ({
  PagePermissionsDialog: () => null,
}));

vi.mock("./page-app-icon", () => ({
  PageIcon: ({
    node,
    onCreateSubpage,
  }: {
    node: { page: { uid: string; name: string } };
    onCreateSubpage: (uid: string) => void;
  }) => (
    <button type="button" onClick={() => onCreateSubpage(node.page.uid)}>
      Create subpage under {node.page.name}
    </button>
  ),
}));

vi.mock("./folder-overlay", () => ({
  FolderOverlay: () => null,
}));

describe("PageIconGrid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pagesResult = { pages: [], index: { root: [] } };
    mocks.createMutateAsync.mockResolvedValue({
      success: true,
      page: {
        uid: "0623-blank",
        name: "",
        type: "markdown",
        icon: { type: "lucide", value: "file-text" },
      },
    });
  });

  it("creates and opens an empty markdown page from the empty state create button", async () => {
    render(
      <PageIconGrid
        workspaceId="workspace-1"
        workspacePath="/tmp/workspace"
      />
    );

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(mocks.createMutateAsync).toHaveBeenCalledWith({
        workspace_path: "/tmp/workspace",
        type: "markdown",
        icon: { type: "lucide", value: "file-text" },
      });
    });
    expect(mocks.openWorkspacePage).toHaveBeenCalledWith(
      "workspace-1",
      "0623-blank",
      {
        title: "",
        icon: { type: "lucide", value: "file-text" },
        focus: "title",
      }
    );
  });

  it("creates an empty markdown subpage without opening the create dialog", async () => {
    mocks.pagesResult = {
      pages: [
        {
          uid: "parent",
          name: "Parent",
          type: "markdown",
          icon: { type: "lucide", value: "file-text" },
          permission: ["read", "write"],
          path: "/tmp/workspace/pages/parent",
        },
      ],
      index: { root: ["parent"] },
    };
    mocks.createMutateAsync.mockResolvedValue({
      success: true,
      page: {
        uid: "0623-child",
        name: "",
        type: "markdown",
        icon: { type: "lucide", value: "file-text" },
      },
    });

    render(
      <PageIconGrid
        workspaceId="workspace-1"
        workspacePath="/tmp/workspace"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Create subpage under Parent" }));

    await waitFor(() => {
      expect(mocks.createMutateAsync).toHaveBeenCalledWith({
        workspace_path: "/tmp/workspace",
        type: "markdown",
        icon: { type: "lucide", value: "file-text" },
        parent_uid: "parent",
      });
    });
  });

  it("does not submit duplicate empty markdown creates while one is in flight", async () => {
    let resolveCreate: (value: unknown) => void = () => {};
    mocks.createMutateAsync.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      })
    );

    render(
      <PageIconGrid
        workspaceId="workspace-1"
        workspacePath="/tmp/workspace"
      />
    );

    const createButton = screen.getByRole("button");
    fireEvent.click(createButton);
    fireEvent.click(createButton);

    expect(mocks.createMutateAsync).toHaveBeenCalledTimes(1);

    resolveCreate({
      success: true,
      page: {
        uid: "0623-blank",
        name: "",
        type: "markdown",
      },
    });
  });
});
