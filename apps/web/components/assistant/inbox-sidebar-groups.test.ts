import { describe, expect, test } from "vitest"
import { groupAssistantSessions } from "./inbox-sidebar"
import type { SessionWithUnread } from "@/hooks/assistant/use-sessions"

const translate = (key: string) => {
  const labels: Record<string, string> = {
    "assistant.sidebar.chats": "Chats",
    "assistant.sidebar.pages": "Pages",
  }
  return labels[key] ?? key
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

describe("groupAssistantSessions", () => {
  test("groups chats, pages and repositories independently", () => {
    const workChat = makeSession({
      id: "work-chat",
      title: "Work chat",
    })
    const pageChat = makeSession({
      id: "page-chat",
      title: "Guide",
      agentType: "chat",
      publishedPageId: "page-1",
      pageUserSlug: "alice",
      pageSlug: "guide",
    })
    const repoWork = makeSession({
      id: "repo-work",
      title: "Repo work",
      repoOwner: "acme",
      repoName: "repo",
    })

    const groups = groupAssistantSessions(
      [workChat, pageChat, repoWork],
      translate,
    )

    expect(groups.map((group) => [group.kind, group.label])).toEqual([
      ["chats", "Chats"],
      ["pages", "Pages"],
      ["repo", "acme/repo"],
    ])
    expect(groups[1]?.sessions).toEqual([pageChat])
  })

  test("never puts chat agent sessions in Chats or repo groups", () => {
    const pageChatWithLegacyRepoFields = makeSession({
      id: "page-chat",
      title: "Guide",
      agentType: "chat",
      publishedPageId: "page-1",
      pageUserSlug: "alice",
      pageSlug: "guide",
      repoOwner: "legacy",
      repoName: "repo",
    })

    const groups = groupAssistantSessions(
      [pageChatWithLegacyRepoFields],
      translate,
    )

    expect(groups).toHaveLength(1)
    expect(groups[0]?.kind).toBe("pages")
    expect(groups[0]?.sessions).toEqual([pageChatWithLegacyRepoFields])
  })
})
