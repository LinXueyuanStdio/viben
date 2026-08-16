import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { InboxSidebar } from "./inbox-sidebar"
import type { SessionWithUnread } from "@/hooks/assistant/use-sessions"

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode
    href: string
    className?: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const labels: Record<string, string> = {
        "assistant.sidebar.active": "Active",
        "assistant.sidebar.archive": "Archive",
        "assistant.sidebar.archiveConfirmCancel": "Cancel",
        "assistant.sidebar.archiveConfirmDescription": "Archive this session",
        "assistant.sidebar.archiveConfirmTitle": "Archive session",
        "assistant.sidebar.archiveSession": "Archive",
        "assistant.sidebar.cancelArchive": "Unarchive",
        "assistant.sidebar.chats": "Chats",
        "assistant.sidebar.createFromBranch": "Create from branch",
        "assistant.sidebar.createSession": "Create session",
        "assistant.sidebar.createSessionForRepo": `Create session for ${params?.label ?? ""}`,
        "assistant.sidebar.createSessionFromBranch": `Create from branch for ${params?.label ?? ""}`,
        "assistant.sidebar.delete": "Delete",
        "assistant.sidebar.moreActions": "More actions",
        "assistant.sidebar.newChat": "New Chat",
        "assistant.sidebar.noArchivedSessions": "No archived sessions",
        "assistant.sidebar.noSessions": "No sessions",
        "assistant.sidebar.pages": "Pages",
        "assistant.sidebar.pin": "Pin",
        "assistant.sidebar.rename": "Rename",
        "assistant.sidebar.share": "Share",
        "assistant.sidebar.statusIdle": "Idle",
        "assistant.sidebar.statusSandboxRunning": "Running",
        "assistant.sidebar.unpin": "Unpin",
      }
      return labels[key] ?? key
    },
  }),
}))

vi.mock("@/components/ui/sidebar", () => ({
  useSidebar: () => ({ isMobile: false, setOpenMobile: vi.fn() }),
}))

vi.mock("@/hooks/assistant/use-mobile", () => ({
  useIsMobile: () => false,
}))

vi.mock("@/hooks/assistant/use-session", () => ({
  useSession: () => ({ session: null }),
}))

vi.mock("@/hooks/assistant/use-leaderboard-rank", () => ({
  useLeaderboardRank: () => ({ rank: null, loading: false }),
}))

vi.mock("@/components/assistant/branch-picker-dialog", () => ({
  BranchPickerDialog: () => null,
}))

// Node 22.4+ (and Node 25+, where it is unflagged) exposes a stub `localStorage`
// global that shadows jsdom's Storage and lacks clear/getItem/setItem. Provide a
// complete in-memory Storage so the sidebar's pinned-session reads and this
// beforeEach reset behave like a real browser.
function createStorageMock(): Storage {
  let store: Record<string, string> = {}
  return {
    get length() {
      return Object.keys(store).length
    },
    clear() {
      store = {}
    },
    getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null
    },
    key(index: number) {
      return Object.keys(store)[index] ?? null
    },
    removeItem(key: string) {
      delete store[key]
    },
    setItem(key: string, value: string) {
      store[key] = String(value)
    },
  } as Storage
}

function makeSession(
  overrides: Partial<SessionWithUnread>,
): SessionWithUnread {
  const now = new Date("2026-08-12T00:00:00.000Z")
  return {
    id: overrides.id ?? "session-1",
    title: overrides.title ?? "Session",
    status: overrides.status ?? "running",
    agentType: overrides.agentType ?? "work",
    publishedPageId: overrides.publishedPageId ?? null,
    pageUserSlug: overrides.pageUserSlug ?? null,
    pageSlug: overrides.pageSlug ?? null,
    repoOwner: overrides.repoOwner ?? null,
    repoName: overrides.repoName ?? null,
    branch: overrides.branch ?? null,
    linesAdded: overrides.linesAdded ?? 0,
    linesRemoved: overrides.linesRemoved ?? 0,
    prNumber: overrides.prNumber ?? null,
    prStatus: overrides.prStatus ?? null,
    lifecycleState: overrides.lifecycleState ?? null,
    createdAt: overrides.createdAt ?? now,
    hasUnread: overrides.hasUnread ?? false,
    hasStreaming: overrides.hasStreaming ?? false,
    latestChatId: overrides.latestChatId ?? null,
    lastActivityAt: overrides.lastActivityAt ?? now,
  }
}

function renderSidebar(sessions: SessionWithUnread[]) {
  return render(
    <InboxSidebar
      sessions={sessions}
      archivedCount={0}
      sessionsLoading={false}
      activeSessionId=""
      pendingSessionId={null}
      onSessionClick={vi.fn()}
      onSessionPrefetch={vi.fn()}
      onRenameSession={vi.fn()}
      onArchiveSession={vi.fn()}
      onUnarchiveSession={vi.fn()}
      onDeleteSession={vi.fn()}
      onOpenNewSession={vi.fn()}
      onCreateSessionForRepo={vi.fn()}
      onCreateSessionFromBranch={vi.fn()}
      initialUser={{
        id: "user-1",
        email: "alice@example.com",
        username: "alice",
        name: "Alice",
        image: null,
        avatar: null,
        role: "developer",
        type: "user",
      }}
    />,
  )
}

describe("InboxSidebar page groups", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      value: createStorageMock(),
      configurable: true,
      writable: true,
    })
  })

  test("renders Pages independently from Chats and repo groups", () => {
    renderSidebar([
      makeSession({ id: "chat-1", title: "General chat" }),
      makeSession({
        id: "page-1",
        title: "Guide page",
        agentType: "chat",
        publishedPageId: "published-page-1",
        pageUserSlug: "alice",
        pageSlug: "guide",
      }),
      makeSession({
        id: "repo-1",
        title: "Repo work",
        repoOwner: "acme",
        repoName: "repo",
      }),
    ])

    expect(screen.getByRole("button", { name: /Chats/ })).toBeVisible()
    expect(screen.getByRole("button", { name: /Pages/ })).toBeVisible()
    expect(screen.getByRole("button", { name: "acme/repo" })).toBeVisible()
    expect(screen.getByText("Guide page")).toBeVisible()
  })

  test("does not render repo creation actions for the Pages group", () => {
    renderSidebar([
      makeSession({
        id: "page-1",
        title: "Guide page",
        agentType: "chat",
        publishedPageId: "published-page-1",
        pageUserSlug: "alice",
        pageSlug: "guide",
      }),
    ])

    expect(screen.queryByLabelText(/Create session for Pages/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Create from branch for Pages/)).not.toBeInTheDocument()
  })
})
