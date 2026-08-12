import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { PageAssistantPanel } from "./page-assistant-panel"
import type { WebAgentUIMessage } from "@/app/types"
import type { SessionChatListItem } from "@/hooks/assistant/use-session-chats"
import type { PageSessionResponse } from "@/lib/page-chat/types"
import type { Chat, Session } from "@/lib/db/schema"
import type { ReactNode } from "react"

const sharedCoreSpy = vi.hoisted(() => vi.fn())
const createChat = vi.hoisted(() => vi.fn())

vi.mock("@/components/assistant/shared-chat-core", () => ({
  SharedChatCore: (props: object) => {
    sharedCoreSpy(props)
    const {
      chat,
      emptyState,
      toolbar,
    } = props as { chat: Chat; emptyState?: ReactNode; toolbar?: ReactNode }
    return (
      <div>
        {toolbar}
        <div data-testid="shared-chat-core">{chat.id}</div>
        {emptyState}
      </div>
    )
  },
}))

vi.mock("@/components/assistant/page-chat-provider", () => ({
  PageChatProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="page-chat-provider">{children}</div>
  ),
}))

let sessionChats: SessionChatListItem[]

vi.mock("@/hooks/assistant/use-session-chats", () => ({
  useSessionChats: () => ({
    chats: sessionChats,
    loading: false,
    error: null,
    createChat,
    refreshChats: vi.fn(),
  }),
}))

vi.mock("@/hooks/assistant/use-model-options", () => ({
  useModelOptions: () => ({
    modelOptions: [
      {
        id: "anthropic/claude-haiku-4.5",
        label: "Claude Haiku",
        shortLabel: "Haiku",
        isVariant: false,
        provider: "anthropic",
      },
    ],
    loading: false,
    error: null,
  }),
}))

const panelProps = {
  pageDbId: "page-db-1",
  userSlug: "alice",
  pageSlug: "guide",
}

function makeSession(): Session {
  const now = new Date("2026-08-12T00:00:00.000Z")
  return {
    id: "session-1",
    userId: "user-1",
    title: "Page assistant",
    status: "running",
    agentType: "chat",
    publishedPageId: "page-db-1",
    pageUserSlug: "alice",
    pageSlug: "guide",
    repoOwner: null,
    repoName: null,
    branch: null,
    cloneUrl: null,
    vercelProjectId: null,
    vercelProjectName: null,
    vercelTeamId: null,
    vercelTeamSlug: null,
    isNewBranch: false,
    autoCommitPushOverride: null,
    autoCreatePrOverride: null,
    globalSkillRefs: [],
    sandboxState: null,
    lifecycleState: null,
    lifecycleVersion: 0,
    lastActivityAt: null,
    sandboxExpiresAt: null,
    hibernateAfter: null,
    lifecycleRunId: null,
    sandboxProvisioningRunId: null,
    lifecycleError: null,
    linesAdded: 0,
    linesRemoved: 0,
    prNumber: null,
    prStatus: null,
    snapshotUrl: null,
    snapshotCreatedAt: null,
    snapshotSizeBytes: null,
    cachedDiff: null,
    cachedDiffUpdatedAt: null,
    createdAt: now,
    updatedAt: now,
  }
}

function makeChat(id: string, title: string): Chat {
  const now = new Date("2026-08-12T00:00:00.000Z")
  return {
    id,
    sessionId: "session-1",
    title,
    modelId: "anthropic/claude-haiku-4.5",
    activeStreamId: null,
    lastAssistantMessageAt: null,
    createdAt: now,
    updatedAt: now,
  }
}

let pageSessionResponse: PageSessionResponse | Response
let fetchMock: ReturnType<typeof vi.fn>

function successPageSession(canEdit = true): PageSessionResponse {
  return {
    session: makeSession(),
    chat: makeChat("latest-chat", "Current conversation"),
    page: {
      published_page_id: "page-db-1",
      user_slug: "alice",
      page_slug: "guide",
      title: "Guide",
      url: "/alice/guide",
      can_edit: canEdit,
      available: true,
    },
  }
}

function setChats(...chats: Chat[]) {
  sessionChats = chats.map((chat) => ({
    ...chat,
    hasUnread: false,
    isStreaming: false,
  }))
}

function renderPanel() {
  return render(<PageAssistantPanel {...panelProps} />)
}

describe("PageAssistantPanel", () => {
  beforeEach(() => {
    sharedCoreSpy.mockClear()
    createChat.mockReset()
    const latestChat = makeChat("latest-chat", "Current conversation")
    setChats(latestChat, makeChat("older-chat", "Older chat"))
    pageSessionResponse = successPageSession(true)
    createChat.mockReturnValue({
      chat: makeChat("chat-2", "New conversation"),
      persisted: Promise.resolve(makeChat("chat-2", "New conversation")),
    })

    fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const href = String(url)
      if (href === "/api/page-sessions") {
        if (pageSessionResponse instanceof Response) {
          return pageSessionResponse
        }
        return new Response(JSON.stringify(pageSessionResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
      if (href.includes("/api/sessions/session-1/chats/")) {
        return new Response(
          JSON.stringify({
            chat: {
              id: href.endsWith("/older-chat") ? "older-chat" : "latest-chat",
              modelId: "anthropic/claude-haiku-4.5",
              activeStreamId: null,
            },
            isStreaming: false,
            messages: [] satisfies WebAgentUIMessage[],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )
      }
      return new Response(JSON.stringify({ error: "Unexpected fetch" }), {
        status: 500,
      })
    })
    vi.stubGlobal("fetch", fetchMock)
  })

  test("posts snake_case identity once and restores the returned latest chat", async () => {
    renderPanel()

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/page-sessions",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ user_slug: "alice", page_slug: "guide" }),
        }),
      ),
    )
    await waitFor(() =>
      expect(sharedCoreSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          session: expect.objectContaining({ id: "session-1" }),
          chat: expect.objectContaining({ id: "latest-chat" }),
          mode: "page",
          density: "compact",
        }),
      ),
    )
  })

  test("shows author prompts for can_edit and reader prompts otherwise", async () => {
    pageSessionResponse = successPageSession(true)
    const authorView = renderPanel()

    expect(await screen.findByRole("button", { name: "Add multilingual support" })).toBeVisible()
    expect(screen.getByRole("button", { name: "Improve page SEO" })).toBeVisible()
    expect(screen.getByRole("button", { name: "Check structure and accessibility" })).toBeVisible()
    authorView.unmount()

    pageSessionResponse = successPageSession(false)
    renderPanel()

    expect(await screen.findByRole("button", { name: "Summarize this page" })).toBeVisible()
    expect(screen.getByRole("button", { name: "Extract key points" })).toBeVisible()
    expect(screen.getByRole("button", { name: "Explain a difficult section" })).toBeVisible()
  })

  test("creates a new chat in the same session and switches to it", async () => {
    setChats(
      makeChat("latest-chat", "Current conversation"),
      makeChat("chat-2", "New conversation"),
    )
    renderPanel()

    fireEvent.click(await screen.findByRole("button", { name: "New conversation" }))

    expect(createChat).toHaveBeenCalledOnce()
    await waitFor(() =>
      expect(sharedCoreSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          chat: expect.objectContaining({ id: "chat-2" }),
        }),
      ),
    )
  })

  test("switches historical chats from the compact dropdown", async () => {
    renderPanel()

    fireEvent.click(await screen.findByRole("button", { name: "Current conversation" }))
    fireEvent.click(screen.getByRole("menuitem", { name: "Older chat" }))

    await waitFor(() =>
      expect(sharedCoreSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          chat: expect.objectContaining({ id: "older-chat" }),
        }),
      ),
    )
  })

  test("renders retryable states without creating a sandbox", async () => {
    pageSessionResponse = new Response("MCP unavailable", { status: 503 })

    renderPanel()

    expect(await screen.findByRole("button", { name: "Retry" })).toBeVisible()
    const urls = fetchMock.mock.calls.map(([url]) => String(url))
    expect(urls.some((url) => /sandbox|files|skills|diff/.test(url))).toBe(false)
  })
})
