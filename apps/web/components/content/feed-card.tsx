"use client"

import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Eye, MessageCircle, Bookmark, Heart, Repeat2, Share2 } from "lucide-react"
import { toast } from "sonner"
import { FeedHead } from "./feed-head"
import type { FeedHeadData } from "./feed-head"
import { Attachment } from "./attachment"
import type { AttachmentData } from "./attachment"
import { StatsRow } from "./stats-row"
import type { StatProps } from "./stats-row"
import { cn } from "@/lib/utils"

export interface FeedCardData {
  head: FeedHeadData
  text: string
  quote?: string
  attachment?: AttachmentData
  actions: {
    views: number
    likes: number
    comments: number
    reposts?: number
    bookmarks: number
  }
}

interface FeedCardProps {
  data: FeedCardData
  variant?: "preloaded" | "rich"
  className?: string
  onAction?: (action: string) => void
}

export function FeedCard({ data, variant = "preloaded", className, onAction }: FeedCardProps) {
  const { t } = useTranslation()
  const handleShare = useCallback(() => {
    const text = `${data.head.name}: ${data.text.slice(0, 60)}${data.text.length > 60 ? "..." : ""}`
    const url = window.location.href
    if (navigator.share) {
      navigator.share({ title: text, url }).catch(() => {})
    } else {
      navigator.clipboard.writeText(`${text}\n${url}`).catch(() => {})
    }
  }, [data.head.name, data.text])

  const handleAction = useCallback((action: string) => {
    if (onAction) {
      onAction(action)
    } else {
      toast.info(`操作: ${action}`)
    }
  }, [onAction])

  const { head, text, quote, attachment, actions } = data

  const actionStats: StatProps[] = variant === "rich"
    ? [
        { icon: Heart, value: actions.likes, format: true, dataAction: "like", onClick: handleAction },
        { icon: MessageCircle, value: actions.comments, format: true, dataAction: "comment", onClick: handleAction },
        { icon: Repeat2, value: actions.reposts ?? 0, format: true, dataAction: "repost", onClick: handleAction },
        { icon: Bookmark, value: actions.bookmarks, format: true, dataAction: "bookmark", onClick: handleAction },
      ]
    : [
        { icon: Eye, value: actions.views, format: true },
        { icon: MessageCircle, value: actions.comments, format: true, dataAction: "comment", onClick: handleAction },
        { icon: Bookmark, value: actions.bookmarks, format: true, dataAction: "bookmark", onClick: handleAction },
      ]

  return (
    <article className={cn(
      "border border-border rounded-[12px] bg-background shadow-sm p-2.5",
      variant === "rich" && "grid gap-[9px]",
      className
    )}>
      <FeedHead data={head} />
      <div className="ml-[42px] space-y-[9px]">
        <p className="text-[#173f4c] dark:text-foreground leading-relaxed text-sm">
          {text}
        </p>
        {quote && (
          <blockquote className="border-l-[3px] border-primary/30 rounded-r-md bg-primary/5 px-3 py-2 text-[13px] text-[#173f4c] dark:text-foreground">
            {quote}
          </blockquote>
        )}
        {attachment && <Attachment data={attachment} />}
        <div className="flex items-center justify-between mt-[5px]">
          <StatsRow stats={actionStats} />
          <button
            className="inline-flex items-center justify-center size-[30px] rounded-[9px] hover:bg-surface-secondary text-muted-foreground"
            aria-label={t("community.share")}
            onClick={handleShare}
          >
            <Share2 className="size-4" />
          </button>
        </div>
      </div>
    </article>
  )
}
