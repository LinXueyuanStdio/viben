/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "./sidebar";
import type { Workspace } from "@/types";

const selectWorkspace = vi.fn();
const removeWorkspace = vi.fn();
const openWorkspaceSection = vi.fn();
const openWorkspaceHome = vi.fn();
const openPath = vi.fn();
const openDashboard = vi.fn();
const openSettings = vi.fn();
const mockGetWorkspace = vi.fn();
const mockWorkspaces: Workspace[] = [
  {
    id: "global",
    name: "Global",
    path: "/global",
    created_at: "2026-01-01T00:00:00.000Z",
    last_accessed: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "project",
    name: "Project Workspace",
    path: "/project",
    created_at: "2026-01-01T00:00:00.000Z",
    last_accessed: "2026-01-01T00:00:00.000Z",
  },
];

vi.mock("react-i18next", () => ({
  initReactI18next: {
    type: "3rdParty",
    init: vi.fn(),
  },
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    isAuthenticated: false,
  }),
}));

vi.mock("@/hooks/use-workspaces", () => ({
  useLocalWorkspaces: () => ({
    workspaces: mockWorkspaces,
    activeWorkspaceId: "project",
    selectWorkspace,
    removeWorkspace,
    getWorkspace: mockGetWorkspace,
    isLoading: false,
  }),
}));

vi.mock("@/hooks/use-desktop-routing", () => ({
  useDesktopRouting: () => ({
    currentTab: null,
    openWorkspaceSection,
    openWorkspaceHome,
    openPath,
    openDashboard,
    openSettings,
  }),
}));

vi.mock("@/stores", () => ({
  useUiStore: () => ({
    sidebarCollapsed: true,
    isCreateTaskDialogOpen: false,
    setCreateTaskDialogOpen: vi.fn(),
  }),
}));

vi.mock("@/stores/tab-store", () => ({
  getCurrentWindowTabStore: () => ({
    getState: () => ({
      jumpToHistory: vi.fn(),
    }),
  }),
}));

vi.mock("@/pages/settings/settings-sidebar-content", () => ({
  SettingsSidebarContent: () => null,
}));

vi.mock("@/pages/settings/settings-sidebar-utils", () => ({
  findPreviousNonSettingsHistoryIndex: () => null,
  isSettingsPathname: () => false,
}));

vi.mock("@/hooks/use-kanban", () => ({
  _useCreateTask: () => ({
    isPending: false,
    mutateAsync: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-workspace-resources", () => ({
  useAgents: () => ({
    agents: [],
    loading: false,
  }),
}));

vi.mock("@/hooks/use-models", () => ({
  useModels: () => ({
    models: [],
    loading: false,
  }),
}));

vi.mock("@/hooks/use-github", () => ({
  useGitHubAuth: () => ({ status: null }),
  useGitHubRepository: () => ({ repository: null }),
}));

vi.mock("@/components/layout/page-section", () => ({
  PageSection: () => <div data-testid="page-section" />,
}));

vi.mock("@/components/layout/status-indicator", () => ({
  StatusIndicator: () => null,
}));

vi.mock("@/components/layout/wake-word-task-button", () => ({
  WakeWordTaskButton: () => null,
}));

vi.mock("@/components/workspace", () => ({
  AddWorkspaceModal: () => null,
}));

vi.mock("@/components/workspace/workspace-settings-dialog", () => ({
  WorkspaceSettingsDialog: () => null,
}));

vi.mock("@/components/workspace/kanban/create-task-dialog", () => ({
  CreateTaskDialog: () => null,
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWorkspace.mockImplementation((id: string) =>
      mockWorkspaces.find((workspace) => workspace.id === id),
    );
  });

  it("shows a workspace popup from the collapsed workspace icon", async () => {
    render(
      <MemoryRouter initialEntries={["/workspace/project/chat"]}>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: "workspace.global" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Project Workspace" })).toHaveLength(1);

    fireEvent.mouseEnter(
      screen.getByRole("button", { name: "Project Workspace" }),
    );

    expect(await screen.findByRole("button", { name: "workspace.global" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Project Workspace" })).toHaveLength(2);
  });
});
