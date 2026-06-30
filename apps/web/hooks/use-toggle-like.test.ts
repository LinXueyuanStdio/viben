import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { useToggleLike } from "./use-toggle-like"

const mocks = vi.hoisted(() => ({
  toggleReaction: vi.fn(),
}))

vi.mock("@/lib/api/community", () => ({
  toggleReaction: mocks.toggleReaction,
}))

describe("useToggleLike", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns initial liked and count", () => {
    const { result } = renderHook(() =>
      useToggleLike({ entityType: "moment", entityId: "m1", initialLiked: true, initialCount: 5 }),
    )
    expect(result.current.liked).toBe(true)
    expect(result.current.count).toBe(5)
    expect(result.current.pending).toBe(false)
    expect(result.current.bounce).toBe(false)
  })

  it("optimistically toggles like on", async () => {
    mocks.toggleReaction.mockResolvedValue({ has_reacted: true, reactions_count: 6 })

    const { result } = renderHook(() =>
      useToggleLike({ entityType: "moment", entityId: "m1", initialLiked: false, initialCount: 5 }),
    )

    await act(async () => { await result.current.toggle() })

    expect(result.current.liked).toBe(true)
    expect(result.current.count).toBe(6)
    expect(mocks.toggleReaction).toHaveBeenCalledWith({
      entityType: "moment", entityId: "m1",
    })
  })

  it("optimistically toggles like off", async () => {
    mocks.toggleReaction.mockResolvedValue({ has_reacted: false, reactions_count: 4 })

    const { result } = renderHook(() =>
      useToggleLike({ entityType: "moment", entityId: "m1", initialLiked: true, initialCount: 5 }),
    )

    await act(async () => { await result.current.toggle() })

    expect(result.current.liked).toBe(false)
    expect(result.current.count).toBe(4)
  })

  it("triggers bounce on activation", async () => {
    mocks.toggleReaction.mockResolvedValue({ has_reacted: true, reactions_count: 1 })

    const { result } = renderHook(() =>
      useToggleLike({ entityType: "moment", entityId: "m1", initialLiked: false, initialCount: 0 }),
    )

    await act(async () => { await result.current.toggle() })
    expect(result.current.bounce).toBe(true)
  })

  it("reverts on API failure", async () => {
    mocks.toggleReaction.mockRejectedValue(new Error("api_error"))

    const { result } = renderHook(() =>
      useToggleLike({ entityType: "moment", entityId: "m1", initialLiked: false, initialCount: 5 }),
    )

    await act(async () => { await result.current.toggle() })

    expect(result.current.liked).toBe(false)
    expect(result.current.count).toBe(5)
  })

  it("prevents concurrent toggles", async () => {
    let resolvePromise!: (value: unknown) => void
    mocks.toggleReaction.mockReturnValue(new Promise((r) => { resolvePromise = r }))

    const { result } = renderHook(() =>
      useToggleLike({ entityType: "published_page", entityId: "p1", initialLiked: false, initialCount: 3 }),
    )

    const first = act(() => { result.current.toggle() })
    // Second call should be silently ignored (guard prevents concurrent toggles)
    await act(() => result.current.toggle())

    await act(async () => {
      resolvePromise({ has_reacted: true, reactions_count: 4 })
      await first
    })

    // Only one API call despite two toggle attempts
    expect(mocks.toggleReaction).toHaveBeenCalledTimes(1)
    expect(result.current.count).toBe(4)
  })
})
