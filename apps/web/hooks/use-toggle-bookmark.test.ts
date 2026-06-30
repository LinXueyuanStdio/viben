import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { useToggleBookmark } from "./use-toggle-bookmark"

const mocks = vi.hoisted(() => ({
  toggleBookmark: vi.fn(),
}))

vi.mock("@/lib/api/community", () => ({
  toggleBookmark: mocks.toggleBookmark,
}))

describe("useToggleBookmark", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns initial bookmarked and count", () => {
    const { result } = renderHook(() =>
      useToggleBookmark({ entityType: "published_page", entityId: "p1", initialBookmarked: false, initialCount: 2 }),
    )
    expect(result.current.bookmarked).toBe(false)
    expect(result.current.count).toBe(2)
  })

  it("optimistically toggles bookmark on", async () => {
    mocks.toggleBookmark.mockResolvedValue({ has_bookmarked: true, bookmarks_count: 3 })

    const { result } = renderHook(() =>
      useToggleBookmark({ entityType: "moment", entityId: "m1", initialBookmarked: false, initialCount: 2 }),
    )

    await act(async () => { await result.current.toggle() })

    expect(result.current.bookmarked).toBe(true)
    expect(result.current.count).toBe(3)
    expect(mocks.toggleBookmark).toHaveBeenCalledWith({
      entityType: "moment", entityId: "m1",
    })
  })

  it("optimistically toggles bookmark off", async () => {
    mocks.toggleBookmark.mockResolvedValue({ has_bookmarked: false, bookmarks_count: 1 })

    const { result } = renderHook(() =>
      useToggleBookmark({ entityType: "moment", entityId: "m1", initialBookmarked: true, initialCount: 2 }),
    )

    await act(async () => { await result.current.toggle() })

    expect(result.current.bookmarked).toBe(false)
    expect(result.current.count).toBe(1)
  })

  it("triggers bounce on activation", async () => {
    mocks.toggleBookmark.mockResolvedValue({ has_bookmarked: true, bookmarks_count: 1 })

    const { result } = renderHook(() =>
      useToggleBookmark({ entityType: "published_page", entityId: "p1", initialBookmarked: false, initialCount: 0 }),
    )

    await act(async () => { await result.current.toggle() })
    expect(result.current.bounce).toBe(true)
  })

  it("reverts on API failure", async () => {
    mocks.toggleBookmark.mockRejectedValue(new Error("api_error"))

    const { result } = renderHook(() =>
      useToggleBookmark({ entityType: "published_page", entityId: "p1", initialBookmarked: true, initialCount: 5 }),
    )

    await act(async () => { await result.current.toggle() })

    expect(result.current.bookmarked).toBe(true)
    expect(result.current.count).toBe(5)
  })

  it("prevents concurrent toggles", async () => {
    let resolvePromise!: (value: unknown) => void
    mocks.toggleBookmark.mockReturnValue(new Promise((r) => { resolvePromise = r }))

    const { result } = renderHook(() =>
      useToggleBookmark({ entityType: "moment", entityId: "m1", initialBookmarked: false, initialCount: 1 }),
    )

    const first = act(() => { result.current.toggle() })
    // Second call should be silently ignored (guard prevents concurrent toggles)
    await act(() => result.current.toggle())

    await act(async () => {
      resolvePromise({ has_bookmarked: true, bookmarks_count: 2 })
      await first
    })

    expect(mocks.toggleBookmark).toHaveBeenCalledTimes(1)
  })
})
