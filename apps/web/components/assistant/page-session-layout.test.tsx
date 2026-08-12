import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { SessionLayoutShell } from "@/app/(dashboard)/assistant/[sessionId]/session-layout-shell";
import type { SessionChatListItem } from "@/hooks/assistant/use-session-chats";
import type { Session } from "@/lib/db/schema";

const routerPush = vi.fn();
const routerPrefetch = vi.fn();
let routeChatId = "chat-1";

vi.mock("next/navigation", () => ({
  useParams: () => ({ chatId: routeChatId }),
  useRouter: () => ({
    push: routerPush,
    prefetch: routerPrefetch,
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        "assistant.session.openPage": "Open page",
        "assistant.session.preview": "Preview",
      };
      return labels[key] ?? key;
    },
  }),
}));

vi.mock("@/hooks/assistant/use-session-chats", () => ({
  useSessionChats: () => ({
    chats: [
      {
        id: "chat-1",
        title: "Page chat",
        modelId: "openai/gpt-5",
        createdAt: new Date("2026-08-12T00:00:00.000Z"),
        updatedAt: new Date("2026-08-12T00:00:00.000Z"),
        hasUnread: false,
        activeStreamId: null,
      },
    ] satisfies SessionChatListItem[],
    loading: false,
    createChat: vi.fn(),
    deleteChat: vi.fn(),
    renameChat: vi.fn(),
  }),
}));

vi.mock("@/components/layout/app-shell", () => ({
  useAppShell: () => ({
    setTopbarCenterContent: vi.fn(),
  }),
}));

vi.mock("@/components/ui/sidebar", () => ({
  useSidebar: () => ({
    toggleSidebar: vi.fn(),
  }),
}));

vi.mock("@/hooks/assistant/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/components/assistant/git-panel-context", () => ({
  GitPanelProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="git-panel-provider">{children}</div>
  ),
  useGitPanel: () => ({
    panelPortalRef: { current: null },
    gitPanelOpen: false,
    setGitPanelOpen: vi.fn(),
    setShareRequested: vi.fn(),
  }),
}));

vi.mock("@/components/assistant/session-header", () => ({
  SessionHeader: () => (
    <header>
      <button type="button">Code Editor</button>
      <button type="button">Files</button>
      <button type="button">Diff</button>
      <button type="button">Pull Request</button>
      <button type="button">Sandbox</button>
    </header>
  ),
}));

function makeSession(overrides: Partial<Session>): Session {
  const now = new Date("2026-08-12T00:00:00.000Z");
  return {
    id: overrides.id ?? "session-1",
    userId: overrides.userId ?? "user-1",
    title: overrides.title ?? "Session",
    status: overrides.status ?? "running",
    agentType: overrides.agentType ?? "work",
    publishedPageId: overrides.publishedPageId ?? null,
    pageUserSlug: overrides.pageUserSlug ?? null,
    pageSlug: overrides.pageSlug ?? null,
    repoOwner: overrides.repoOwner ?? null,
    repoName: overrides.repoName ?? null,
    branch: overrides.branch ?? null,
    cloneUrl: overrides.cloneUrl ?? null,
    vercelProjectId: overrides.vercelProjectId ?? null,
    vercelProjectName: overrides.vercelProjectName ?? null,
    vercelTeamId: overrides.vercelTeamId ?? null,
    vercelTeamSlug: overrides.vercelTeamSlug ?? null,
    isNewBranch: overrides.isNewBranch ?? false,
    autoCommitPushOverride: overrides.autoCommitPushOverride ?? null,
    autoCreatePrOverride: overrides.autoCreatePrOverride ?? null,
    globalSkillRefs: overrides.globalSkillRefs ?? [],
    sandboxState: overrides.sandboxState ?? null,
    lifecycleState: overrides.lifecycleState ?? null,
    prNumber: overrides.prNumber ?? null,
    prStatus: overrides.prStatus ?? null,
    linesAdded: overrides.linesAdded ?? 0,
    linesRemoved: overrides.linesRemoved ?? 0,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  } as Session;
}

function renderShell(session: Session) {
  return render(
    <SessionLayoutShell session={session}>
      <main>Session child</main>
    </SessionLayoutShell>,
  );
}

describe("SessionLayoutShell page sessions", () => {
  beforeEach(() => {
    routeChatId = "chat-1";
    Element.prototype.scrollIntoView = vi.fn();
    vi.clearAllMocks();
  });

  test("work sessions keep the existing GitPanel shell", () => {
    renderShell(
      makeSession({
        agentType: "work",
        repoOwner: "acme",
        repoName: "repo",
      }),
    );

    expect(screen.getByTestId("git-panel-provider")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Preview" })).not.toBeInTheDocument();
  });

  test("page sessions render page shell without workspace providers", () => {
    renderShell(
      makeSession({
        agentType: "chat",
        publishedPageId: "published-page-1",
        pageUserSlug: "alice",
        pageSlug: "guide",
      }),
    );

    expect(screen.queryByTestId("git-panel-provider")).not.toBeInTheDocument();
    expect(screen.queryByText(/code editor/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/files|diff|pull request|sandbox/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Preview" })).toBeVisible();
  });

  test("external page button opens the current snapshot URL safely", () => {
    renderShell(
      makeSession({
        agentType: "chat",
        publishedPageId: "published-page-1",
        pageUserSlug: "alice",
        pageSlug: "guide",
      }),
    );

    const link = screen.getByRole("link", { name: "Open page" });
    expect(link).toHaveAttribute("href", "/alice/guide?tab=read");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
