"use client"

import * as React from "react"
import Link from "next/link"
import { useTranslation } from "react-i18next"
import { MessageSquare } from "lucide-react"
import { thumbnailUrl } from "@/components/content/cover"
import { HoverPopover, useInfiniteFetch, timeAgo } from "./hover-popover"

interface MomentFeedItem {
  moment: { uid: string; body: string | null; created_at: string }
  author: { display_name: string | null; user_slug: string; avatar_url: string | null }
}

interface MomentPage {
  items: MomentFeedItem[]
  next_cursor: string | null
  has_more: boolean
}

export function MomentPopover() {
  const { t } = useTranslation()
  const scrollRef = React.useRef<HTMLDivElement>(null)

  const fetchPage = React.useCallback(async (cursor: string | null) => {
    const params = new URLSearchParams({ feed_type: "latest", limit: "8" })
    if (cursor) params.set("cursor", cursor)
    const res = await fetch(`/api/moments?${params.toString()}`)
    return res.json() as Promise<MomentPage>
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
      icon={MessageSquare}
      label={t("nav.moment", "动态")}
      title={t("nav.moment", "动态")}
      viewAllHref="/moment"
      onFirstOpen={loadFirst}
    >
      {!loaded ? (
        <div className="flex items-center justify-center min-h-[58px] text-sm text-muted-foreground">
          {t("common.loading")}
        </div>
      ) : items.length === 0 ? (
        <div className="flex items-center justify-center min-h-[58px] text-sm text-muted-foreground">
          暂无动态
        </div>
      ) : (
        <div ref={scrollRef} className="max-h-[360px] overflow-y-auto">
          <div className="grid gap-1">
            {items.map((item) => {
              const body = (item.moment.body ?? "").slice(0, 100)
              return (
                <Link
                  key={item.moment.uid}
                  href={`/moment/${item.moment.uid}`}
                  className="grid grid-cols-[36px_1fr] gap-2.5 items-start rounded-[10px] p-2 hover:bg-surface-secondary transition-colors"
                >
                  <div
                    className="aspect-square rounded-full bg-cover bg-center mt-0.5"
                    style={
                      item.author.avatar_url
                        ? { backgroundImage: `url(${thumbnailUrl(item.author.avatar_url)})` }
                        : { background: "linear-gradient(135deg, var(--primary), var(--accent))" }
                    }
                  />
                  <div className="min-w-0 grid gap-0.5">
                    <span className="text-[13px] leading-snug line-clamp-2">
                      {body || "(无文字)"}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {item.author.display_name && <span>{item.author.display_name} · </span>}
                      {timeAgo(item.moment.created_at)}
                    </span>
                  </div>
                </Link>
              )
            })}
            {hasMore && (
              <div className="flex items-center justify-center py-2 text-xs text-muted-foreground">
                {loading ? "加载中…" : "滚动加载更多"}
              </div>
            )}
          </div>
        </div>
      )}
    </HoverPopover>
  )
}
