import { act, render } from "@testing-library/react"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { ReadPageClient } from "./read-page-client"
import { emitPageContentChanged } from "@/lib/page-chat/page-content-events"

const readDrawerSpy = vi.hoisted(() => vi.fn())
const refreshSpy = vi.hoisted(() => vi.fn())

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        "community.read": "Read",
        "community.comments": "Comments",
        "community.notes": "Notes",
      }
      return labels[key] ?? key
    },
  }),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshSpy }),
}))

vi.mock("next/dynamic", () => ({
  default: () => () => <div data-testid="dynamic-panel" />,
}))

vi.mock("@/components/layout/app-shell", () => ({
  useAppShell: () => ({ isMobile: false }),
}))

vi.mock("@/components/layout/read-drawer", () => ({
  ReadDrawer: (props: object) => {
    readDrawerSpy(props)
    return <div data-testid="read-drawer" />
  },
}))

const baseProps = {
  userSlug: "alice",
  pageId: "guide",
  pageHtml: "<main>Guide</main>",
  pageTitle: "Guide",
  pageDescription: "A guide",
  pageUid: "guide",
  pageViewCount: 10,
  pageBookmarkCount: 2,
  pageLikeCount: 3,
  pageCommentCount: 4,
  pageShareCount: 1,
  pagePublishedAt: "2026-08-12T00:00:00.000Z",
  pageTags: ["docs"],
  authorDisplayName: "Alice",
  authorAvatarUrl: null,
  authorFollowersCount: 5,
  isAuthenticated: false,
  communityEntityId: "entity-1",
  pageDbId: "page-db-1",
  recommendationEntries: [],
  viewerHasReacted: false,
  viewerHasBookmarked: false,
  initialComments: [],
  initialCommentsNextCursor: null,
}

function renderClient(overrides: Partial<typeof baseProps> = {}) {
  return render(<ReadPageClient {...baseProps} {...overrides} />)
}

function lastReadDrawerTabs() {
  return readDrawerSpy.mock.calls.at(-1)?.[0]?.tabs ?? []
}

describe("ReadPageClient assistant drawer tab", () => {
  beforeEach(() => {
    readDrawerSpy.mockClear()
    refreshSpy.mockClear()
  })

  test("omits the assistant tab for anonymous readers", () => {
    renderClient({ isAuthenticated: false, sessionUserId: undefined })

    expect(lastReadDrawerTabs()).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "assistant" })]),
    )
  })

  test("adds the current page assistant identity for logged-in readers", () => {
    renderClient({ isAuthenticated: true, sessionUserId: "user-2" })

    expect(lastReadDrawerTabs()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: "assistant",
          label: "Assistant",
          type: "assistant",
          pageDbId: "page-db-1",
          userSlug: "alice",
          pageSlug: "guide",
        }),
      ]),
    )
  })

  test("refreshes only when this page content changes", () => {
    renderClient({ isAuthenticated: true, sessionUserId: "user-2" })

    act(() => {
      emitPageContentChanged({
        publishedPageId: "other-page",
        chatId: "chat-1",
      })
    })
    expect(refreshSpy).not.toHaveBeenCalled()

    act(() => {
      emitPageContentChanged({
        publishedPageId: "page-db-1",
        chatId: "chat-1",
      })
    })
    expect(refreshSpy).toHaveBeenCalledOnce()
  })
})
