"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toggleBookmark } from "@/lib/api/community"

interface UseToggleBookmarkOptions {
  entityType: "moment" | "published_page"
  entityId: string
  initialBookmarked: boolean
  initialCount: number
}

interface UseToggleBookmarkResult {
  bookmarked: boolean
  count: number
  pending: boolean
  bounce: boolean
  toggle: () => Promise<void>
}

export function useToggleBookmark({
  entityType,
  entityId,
  initialBookmarked,
  initialCount,
}: UseToggleBookmarkOptions): UseToggleBookmarkResult {
  const [bookmarked, setBookmarked] = useState(initialBookmarked)
  const [count, setCount] = useState(initialCount)
  const [pending, setPending] = useState(false)
  const [bounce, setBounce] = useState(false)

  const pendingRef = useRef(false)
  const snapshotRef = useRef(initialCount)

  // Sync from props when data changes externally, but skip during in-flight mutations
  useEffect(() => {
    if (pendingRef.current) return
    setBookmarked(initialBookmarked)
    setCount(initialCount)
    snapshotRef.current = initialCount
  }, [initialBookmarked, initialCount])

  const toggle = useCallback(async () => {
    if (pendingRef.current) return

    pendingRef.current = true
    setPending(true)
    const wasBookmarked = bookmarked
    setBookmarked(!wasBookmarked)
    setCount((c) => (wasBookmarked ? Math.max(0, c - 1) : c + 1))
    if (!wasBookmarked) {
      setBounce(true)
      setTimeout(() => setBounce(false), 600)
    }

    try {
      const result = await toggleBookmark({ entityType, entityId })
      setBookmarked(result.has_bookmarked)
      setCount(result.bookmarks_count)
      snapshotRef.current = result.bookmarks_count
    } catch {
      // Revert optimistic update
      setBookmarked(wasBookmarked)
      setCount(snapshotRef.current)
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }, [entityType, entityId, bookmarked])

  return { bookmarked, count, pending, bounce, toggle }
}
