"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { Eye, MessageCircle, Bookmark, Heart, MoreHorizontal, Flag, MessageSquare } from "lucide-react"
import { Cover } from "./cover"
import { MetaRow } from "./meta-row"
import { StatsRow } from "./stats-row"
import type { StatProps } from "./stats-row"
import { ReportDialog } from "./report-dialog"
import { FeedbackDialog } from "./feedback-dialog"
import { cn } from "@/lib/utils"

export interface PageCardData {
  cover: string
  title: string
  description?: string
  author: {
    name: string
    fallbackText: string
    avatarUrl?: string
  }
  timeAgo: string
  stats: {
    views: number
    likes?: number
    comments?: number
    bookmarks?: number
  }
}

interface PageCardProps {
  data: PageCardData
  variant?: "default" | "home"
  href: string
  className?: string
  hideAuthor?: boolean
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

export function PageCard({ data, variant = "default", href, className, hideAuthor }: PageCardProps) {
  const router = useRouter()
  const { cover, title, description, author, timeAgo, stats } = data

  const coverStats: StatProps[] = [
    { icon: Eye, value: stats.views, format: true },
    { icon: MessageCircle, value: stats.comments ?? 0, format: true },
  ]

  const detailStats: StatProps[] = [
    { icon: Eye, value: stats.views, format: true },
    ...(stats.likes != null ? [{ icon: Heart, value: stats.likes, format: true }] : []),
    ...(stats.bookmarks != null ? [{ icon: Bookmark, value: stats.bookmarks, format: true }] : []),
    ...(stats.comments != null ? [{ icon: MessageCircle, value: stats.comments, format: true }] : []),
  ]

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
        src={cover}
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
        {!hideAuthor && (
          <MetaRow
            author={author}
            meta={[timeAgo]}
          />
        )}
        {variant === "default" && (
          <div className="flex items-end justify-between">
            <StatsRow stats={detailStats} />
            <MoreMenu pageId={pageId} />
          </div>
        )}
      </div>
    </div>
  )
}