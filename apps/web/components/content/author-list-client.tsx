"use client"

import * as React from "react"
import { AuthorCard } from "@/components/content/author-card"
import { SectionHead } from "@/components/content/section-head"
import { EmptyState } from "@/components/content/i18n-text"
import { Loader2 } from "lucide-react"
import type { AuthorCardData } from "@/components/content/author-card"

interface AuthorListClientProps {
  initialAuthors: AuthorCardData[]
  initialHasMore: boolean
  initialCursor: string | null
}

export function AuthorListClient({ initialAuthors, initialHasMore, initialCursor }: AuthorListClientProps) {
  const [authors, setAuthors] = React.useState(initialAuthors)
  const [cursor, setCursor] = React.useState<string | null>(initialCursor)
  const [hasMore, setHasMore] = React.useState(initialHasMore)
  const [loading, setLoading] = React.useState(false)
  const sentinelRef = React.useRef<HTMLDivElement>(null)

  // IntersectionObserver — 自动预加载
  React.useEffect(() => {
    if (!hasMore) return
    const el = sentinelRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && hasMore) {
          setLoading(true)
          const params = new URLSearchParams({ limit: "20" })
          if (cursor) params.set("cursor", cursor)

          fetch(`/api/authors?${params}`)
            .then((res) => res.json())
            .then((data) => {
              setAuthors((prev) => [...prev, ...(data.items ?? [])])
              setCursor(data.next_cursor)
              setHasMore(data.has_more)
            })
            .catch((err) => console.error("Failed to load more authors:", err))
            .finally(() => setLoading(false))
        }
      },
      { rootMargin: "200px" }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [cursor, hasMore, loading])

  if (authors.length === 0) {
    return <EmptyState tKey="community.noData" fallback="暂无作者" />
  }

  return (
    <div className="grid gap-4">
      <SectionHead title="作者" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {authors.map((author, i) => (
          <AuthorCard key={`${author.userSlug}-${i}`} data={author} />
        ))}
      </div>

      {/* Sentinel — 滚动到此处时触发预加载 */}
      {hasMore && (
        <div
          ref={sentinelRef}
          className="flex items-center justify-center min-h-[60px] text-muted-foreground"
        >
          {loading && <Loader2 className="h-5 w-5 animate-spin" />}
        </div>
      )}

      {!hasMore && authors.length > 0 && (
        <p className="text-center text-[13px] text-muted-foreground py-4">
          — 已展示全部作者 —
        </p>
      )}
    </div>
  )
}
