"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { Clock, Eye, MessageCircle, Bookmark, ThumbsUp, MoreHorizontal, Flag, MessageSquare, CircleUser } from "lucide-react"
import { Cover } from "./cover"
import { MetaRow } from "./meta-row"
import { StatsRow } from "./stats-row"
import type { StatProps } from "./stats-row"
import { ReportDialog } from "./report-dialog"
import { FeedbackDialog } from "./feedback-dialog"
import { useToggleLike } from "@/hooks/use-toggle-like"
import { useToggleBookmark } from "@/hooks/use-toggle-bookmark"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export interface PageCardData {
  coverUrl?: string | null
  title: string
  description?: string
  author: {
    name: string
    avatarUrl?: string
  }
  timeAgo: string
  stats: {
    views: number
    likes?: number
    comments?: number
    bookmarks?: number
  }
  viewerHasLiked?: boolean
  viewerHasBookmarked?: boolean
  isAuthenticated?: boolean
  pageDbId?: string
}

interface PageCardProps {
  data: PageCardData
  variant?: "default" | "home"
  href: string
  className?: string
  hideAuthor?: boolean
  timeIcon?: boolean
}

function extractPageUid(href: string): string | undefined {
  const segments = href.split("/")
  const last = segments[segments.length - 1]
  return last ? decodeURIComponent(last) : undefined
}

function MoreMenu({ pageId }: { pageId?: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = React.useState(false)
  const [reportOpen, setReportOpen] = React.useState(false)
  const [feedbackOpen, setFeedbackOpen] = React.useState(false)

  return (
    <>
      <div
        className="relative"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <button
          className="inline-flex items-center justify-center size-[30px] rounded-[9px] hover:bg-surface-secondary text-muted-foreground"
          aria-label={t("community.moreActions")}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="size-4" />
        </button>
        {open && (
          <div className="absolute bottom-full right-0 z-70 w-[min(180px,calc(100vw-28px))] grid gap-1 p-1.5 rounded-xl border border-border bg-popover/98 backdrop-blur-[14px] shadow-md">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setReportOpen(true)
              }}
              className="grid grid-cols-[18px_1fr] items-center gap-2 min-h-[38px] rounded-[9px] px-2.5 text-left font-extrabold text-muted-foreground hover:bg-surface-secondary hover:text-foreground"
            >
              <Flag className="h-4 w-4" /> {t("community.report")}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setFeedbackOpen(true)
              }}
              className="grid grid-cols-[18px_1fr] items-center gap-2 min-h-[38px] rounded-[9px] px-2.5 text-left font-extrabold text-muted-foreground hover:bg-surface-secondary hover:text-foreground"
            >
              <MessageSquare className="h-4 w-4" /> {t("community.feedback")}
            </button>
          </div>
        )}
      </div>
      {pageId && (
        <>
          <ReportDialog
            open={reportOpen}
            onOpenChange={setReportOpen}
            entityType="published_page"
            entityId={pageId}
          />
          <FeedbackDialog
            open={feedbackOpen}
            onOpenChange={setFeedbackOpen}
            pageId={pageId}
          />
        </>
      )}
    </>
  )
}

export function PageCard({ data, variant = "default", href, className, hideAuthor, timeIcon }: PageCardProps) {
  const router = useRouter()
  const { t } = useTranslation()
  const { coverUrl, title, description, author, timeAgo, stats } = data

  const like = useToggleLike({
    entityType: "published_page",
    entityId: data.pageDbId ?? "",
    initialLiked: data.viewerHasLiked ?? false,
    initialCount: data.stats?.likes ?? 0,
  })
  const bookmark = useToggleBookmark({
    entityType: "published_page",
    entityId: data.pageDbId ?? "",
    initialBookmarked: data.viewerHasBookmarked ?? false,
    initialCount: data.stats?.bookmarks ?? 0,
  })
  const interactive = !!data.pageDbId

  const wrapHandler = React.useCallback((fn: () => Promise<void>) => {
    return (action: string, e?: React.MouseEvent) => {
      e?.stopPropagation()
      if (!data.isAuthenticated) {
        toast.info(t("community.loginToInteract"))
        return
      }
      fn().catch(() => {})
    }
  }, [data.isAuthenticated, t])

  const coverStats: StatProps[] = [
    { icon: Eye, value: stats.views, format: true },
    { icon: MessageCircle, value: stats.comments ?? 0, format: true },
  ]

  const detailStats: StatProps[] = [
    { icon: Eye, value: stats.views, format: true },
  ]

  if (interactive) {
    detailStats.push({
      icon: ThumbsUp,
      value: like.count,
      format: true,
      dataAction: "like",
      onClick: wrapHandler(like.toggle),
      active: like.liked,
      activeColor: "text-red-500",
      bounce: like.bounce,
      disabled: like.pending,
      loading: like.pending,
    })
  } else if (stats.likes != null) {
    detailStats.push({ icon: ThumbsUp, value: stats.likes, format: true })
  }

  if (interactive) {
    detailStats.push({
      icon: Bookmark,
      value: bookmark.count,
      format: true,
      dataAction: "bookmark",
      onClick: wrapHandler(bookmark.toggle),
      active: bookmark.bookmarked,
      activeColor: "text-amber-500",
      bounce: bookmark.bounce,
      disabled: bookmark.pending,
      loading: bookmark.pending,
    })
  } else if (stats.bookmarks != null) {
    detailStats.push({ icon: Bookmark, value: stats.bookmarks, format: true })
  }

  if (stats.comments != null) {
    detailStats.push({ icon: MessageCircle, value: stats.comments, format: true })
  }

  const pageId = extractPageUid(href)

  const handleClick = () => {
    router.push(href)
  }

  return (
    <div
      onClick={handleClick}
      className={cn(
        "relative block rounded-[12px] border border-border bg-background shadow-sm overflow-hidden cursor-pointer",
        "hover:border-primary transition-colors duration-150",
        className
      )}
    >
      <Cover
        coverUrl={coverUrl}
        fallbackTitle={title}
        aspectRatio="16/9"
        overlay={variant === "home"}
      >
        {variant === "home" && (
          <StatsRow
            stats={coverStats}
            className="text-white [&_svg]:text-white [&_span]:text-white"
          />
        )}
      </Cover>
      <div className={cn("p-2.5", variant === "home" ? "space-y-1" : "space-y-1.5")}>
        <h3 className="font-['Lexend'] text-[15px] font-bold leading-snug line-clamp-2 text-foreground">
          {title}
        </h3>
        {variant === "default" && description && (
          <p className="text-[13px] text-muted-foreground truncate">{description}</p>
        )}
        {variant === "home" ? (
          !hideAuthor && (
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 min-w-0 text-[13px] text-muted-foreground">
                <CircleUser className="size-[18px] shrink-0" />
                <span className="font-bold truncate">{author.name}</span>
                {timeAgo ? (
                  <>
                    <span className="inline-block size-[3px] rounded-full bg-[#9bb8c2] dark:bg-muted-foreground/40 shrink-0" />
                    {timeIcon && <Clock className="size-3.5 shrink-0" />}
                    <span className="shrink-0">{timeAgo}</span>
                  </>
                ) : null}
              </span>
              <MoreMenu pageId={pageId} />
            </div>
          )
        ) : (
          <>
            {!hideAuthor && (
              <MetaRow
                author={author}
                meta={[timeAgo]}
              />
            )}
            <div className="flex items-end justify-between">
              <StatsRow stats={detailStats} />
              <MoreMenu pageId={pageId} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}