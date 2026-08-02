"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { FeedCard } from "@/components/content/feed-card"
import { SectionHead } from "@/components/content/section-head"
import { mapMomentRowToFeedCard, type MomentAttachmentData } from "@/lib/services/moment-mapper"
import type { FeedCardData, FeedCardSession } from "@/components/content/feed-card"
import type { moments as momentsTable } from "@/lib/db"
import type { InferSelectModel } from "drizzle-orm"

type MomentRow = InferSelectModel<typeof momentsTable>

interface ProfileMomentsInfiniteProps {
  userSlug: string
  displayName: string | null
  avatarUrl: string | null
  initialMoments: MomentRow[]
  initialAttachments: Map<string, MomentAttachmentData[]>
  initialCursor: string | null
  session?: FeedCardSession | null
}

export function ProfileMomentsInfinite({
  userSlug, displayName, avatarUrl,
  initialMoments, initialAttachments, initialCursor,
  session,
}: ProfileMomentsInfiniteProps) {
  const [moments, setMoments] = useState<MomentRow[]>(initialMoments)
  const [attachments, setAttachments] = useState<Map<string, MomentAttachmentData[]>>(initialAttachments)
  const [cursor, setCursor] = useState<string | null>(initialCursor)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(initialCursor !== null)
  const loaderRef = useRef<HTMLDivElement>(null)

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: "10" })
      if (cursor) params.set("cursor", cursor)
      const res = await fetch(`/api/users/${encodeURIComponent(userSlug)}/moments?${params}`)
      if (!res.ok) return
      const data = await res.json()
      setMoments((prev) => [...prev, ...data.moments])
      setCursor(data.nextCursor)
      setHasMore(data.nextCursor !== null)
      if (data.attachments) {
        setAttachments((prev) => {
          const next = new Map(prev)
          for (const [key, val] of Object.entries(data.attachments)) {
            next.set(key, val as MomentAttachmentData[])
          }
          return next
        })
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [cursor, loading, hasMore, userSlug])

  // Intersection observer
  useEffect(() => {
    const el = loaderRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loading) {
          loadMore()
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore, hasMore, loading])

  const feedCards: FeedCardData[] = moments.map((m) =>
    mapMomentRowToFeedCard(m, { displayName, userSlug, avatarUrl }, { attachments: attachments.get(m.id) })
  )

  if (feedCards.length === 0) return null

  return (
    <section>
      <SectionHead title="最近动态" />
      <div className="grid gap-2">
        {feedCards.map((feed, i) => (
          <FeedCard key={i} data={feed} variant="rich" session={session} />
        ))}
      </div>
      {/* Loader sentinel */}
      {hasMore && (
        <div ref={loaderRef} className="flex justify-center py-4">
          {loading && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          )}
        </div>
      )}
    </section>
  )
}
