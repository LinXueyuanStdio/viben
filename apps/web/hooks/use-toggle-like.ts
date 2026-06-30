"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toggleReaction } from "@/lib/api/community"

interface UseToggleLikeOptions {
  entityType: "moment" | "published_page" | "comment"
  entityId: string
  initialLiked: boolean
  initialCount: number
}

interface UseToggleLikeResult {
  liked: boolean
  count: number
  pending: boolean
  bounce: boolean
  toggle: () => Promise<void>
}

export function useToggleLike({
  entityType,
  entityId,
  initialLiked,
  initialCount,
}: UseToggleLikeOptions): UseToggleLikeResult {
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [pending, setPending] = useState(false)
  const [bounce, setBounce] = useState(false)

  const pendingRef = useRef(false)
  const snapshotRef = useRef(initialCount)

  // Sync from props when data changes externally, but skip during in-flight mutations
  useEffect(() => {
    if (pendingRef.current) return
    setLiked(initialLiked)
    setCount(initialCount)
    snapshotRef.current = initialCount
  }, [initialLiked, initialCount])

  const toggle = useCallback(async () => {
    if (pendingRef.current) return

    pendingRef.current = true
    setPending(true)
    const wasLiked = liked
    setLiked(!wasLiked)
    setCount((c) => (wasLiked ? Math.max(0, c - 1) : c + 1))
    if (!wasLiked) {
      setBounce(true)
      setTimeout(() => setBounce(false), 600)
    }

    try {
      const result = await toggleReaction({ entityType, entityId })
      setLiked(result.has_reacted)
      setCount(result.reactions_count)
      snapshotRef.current = result.reactions_count
    } catch {
      // Revert optimistic update
      setLiked(wasLiked)
      setCount(snapshotRef.current)
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }, [entityType, entityId, liked])

  return { liked, count, pending, bounce, toggle }
}
