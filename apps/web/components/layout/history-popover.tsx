"use client"

import * as React from "react"
import Link from "next/link"
import { useTranslation } from "react-i18next"
import { Clock } from "lucide-react"
import { thumbnailUrl } from "@/components/content/cover"
import { HoverPopover, useInfiniteFetch, timeAgo } from "./hover-popover"

interface HistoryItem {
  title: string
  cover_url?: string | null
  author_display_name?: string | null
  author_slug?: string
  page_id?: string
  url?: string
  last_viewed_at: string
}

interface HistoryPage {
  items: HistoryItem[]
  next_cursor: string | null
  has_more: boolean
}

export function HistoryPopover() {
  const { t } = useTranslation()
  const scrollRef = React.useRef<HTMLDivElement>(null)

  const fetchPage = React.useCallback(async (cursor: string | null) => {
    const params = new URLSearchParams({ limit: "8" })
    if (cursor) params.set("cursor", cursor)
    const res = await fetch(`/api/community/history?${params.toString()}`)
    return res.json() as Promise<HistoryPage>
  }, [])

  const { items, hasMore, loading, loaded, loadFirst, loadMore } = useInfiniteFetch(fetchPage)

  React.useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const handler = () => {
      if (!hasMore || loading) return
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) loadMore()
    }
    el.addEventListener("scroll", handler, { passive: true })
    return () => el.removeEventListener("scroll", handler)
  }, [hasMore, loading, loadMore])

  return (
    <HoverPopover
      icon={Clock}
      label={t("community.history")}
      title={t("community.history")}
      viewAllHref="/history"
      onFirstOpen={loadFirst}
    >
      {!loaded ? (
        <div className="flex items-center justify-center min-h-[58px] text-sm text-muted-foreground">
          {t("common.loading")}
        </div>
      ) : items.length === 0 ? (
        <div className="flex items-center justify-center min-h-[58px] text-sm text-muted-foreground">
          {t("common.noRecords")}
        </div>
      ) : (
        <div ref={scrollRef} className="max-h-[360px] overflow-y-auto">
          <div className="grid gap-1">
            {items.map((item, idx) => (
              <Link
                key={idx}
                href={item.url ?? (item.author_slug && item.page_id
                  ? `/${encodeURIComponent(item.author_slug)}/${encodeURIComponent(item.page_id)}?tab=read`
                  : "/history")}
                className="grid grid-cols-[46px_1fr] gap-2.5 items-center min-h-[48px] rounded-[10px] p-1.5 hover:bg-surface-secondary transition-colors"
              >
                <div
                  className="aspect-[4/3] rounded-lg bg-cover bg-center"
                  style={
                    item.cover_url
                      ? { backgroundImage: `url(${thumbnailUrl(item.cover_url)})` }
                      : { background: "linear-gradient(135deg, var(--primary), var(--accent))" }
                  }
                />
                <div className="min-w-0 grid gap-0.5">
                  <strong className="text-[13px] truncate">{item.title}</strong>
                  <span className="text-[11px] text-muted-foreground">
                    {item.author_display_name && <span>{item.author_display_name} · </span>}
                    {timeAgo(item.last_viewed_at)}
                  </span>
                </div>
              </Link>
            ))}
            {hasMore && (
              <div className="flex items-center justify-center py-2 text-xs text-muted-foreground">
                {loading ? t("common.loading") : t("common.scrollLoadMore")}
              </div>
            )}
          </div>
        </div>
      )}
    </HoverPopover>
  )
}
