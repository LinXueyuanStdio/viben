"use client"

import * as React from "react"
import Link from "next/link"
import { useTranslation } from "react-i18next"
import { Bell } from "lucide-react"
import { thumbnailUrl } from "@/components/content/cover"
import { HoverPopover, useInfiniteFetch, timeAgo } from "./hover-popover"

interface NotificationItem {
  id: string
  title: string
  body?: string
  created_at: string
  actor_name?: string | null
  actor_avatar_url?: string | null
  page_uid?: string | null
  page_author_slug?: string | null
}

interface NotifPage {
  items: NotificationItem[]
  next_cursor: string | null
  has_more: boolean
  unread_count: number
}

export function NotificationPopover() {
  const { t } = useTranslation()
  const [unreadCount, setUnreadCount] = React.useState(0)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  // 延迟获取未读计数
  React.useEffect(() => {
    const timer = setTimeout(() => {
      fetch("/api/notifications?limit=1&unread_only=true")
        .then((r) => r.json())
        .then((d) => setUnreadCount(d.unread_count ?? 0))
        .catch(() => {})
    }, 3000)
    return () => clearTimeout(timer)
  }, [])

  const fetchPage = React.useCallback(async (cursor: string | null) => {
    const params = new URLSearchParams({ limit: "10" })
    if (cursor) params.set("cursor", cursor)
    const res = await fetch(`/api/notifications?${params.toString()}`)
    const data: NotifPage = await res.json()
    return data
  }, [])

  const { items, hasMore, loading, loaded, loadFirst, loadMore } = useInfiniteFetch(fetchPage)

  // 滚动加载更多
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

  function href(item: NotificationItem) {
    if (item.page_author_slug && item.page_uid) {
      return `/${encodeURIComponent(item.page_author_slug)}/${encodeURIComponent(item.page_uid)}?tab=read`
    }
    return "/notifications"
  }

  return (
    <HoverPopover
      icon={Bell}
      label={t("community.notifications")}
      title={`${t("community.notifications")}${unreadCount > 0 ? ` · ${unreadCount} ${t("community.unreadSuffix")}` : ""}`}
      viewAllHref="/notifications"
      count={unreadCount}
      onFirstOpen={loadFirst}
    >
      {!loaded ? (
        <div className="flex items-center justify-center min-h-[80px] text-sm text-muted-foreground">
          {t("common.loading")}
        </div>
      ) : items.length === 0 ? (
        <div className="flex items-center justify-center min-h-[80px] text-sm text-muted-foreground">
          {t("community.noNotifications")}
        </div>
      ) : (
        <div ref={scrollRef} className="max-h-[360px] overflow-y-auto">
          <div className="grid gap-1">
            {items.map((item) => (
              <Link
                key={item.id}
                href={href(item)}
                className="grid grid-cols-[36px_1fr] gap-2.5 items-start rounded-[10px] p-2 hover:bg-surface-secondary transition-colors"
              >
                <div
                  className="aspect-square rounded-full bg-cover bg-center mt-0.5"
                  style={
                    item.actor_avatar_url
                      ? { backgroundImage: `url(${thumbnailUrl(item.actor_avatar_url)})` }
                      : { background: "linear-gradient(135deg, var(--primary), var(--accent))" }
                  }
                />
                <div className="min-w-0 grid gap-0.5">
                  <strong className="text-[13px] leading-snug line-clamp-2">{item.title}</strong>
                  {item.body && (
                    <span className="text-[12px] text-muted-foreground line-clamp-1">{item.body}</span>
                  )}
                  <span className="text-[11px] text-muted-foreground/70">
                    {item.actor_name && <span>{item.actor_name} · </span>}
                    {timeAgo(item.created_at)}
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
