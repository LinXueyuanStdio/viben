import { Eye, MessageCircle, Bookmark, Heart, Repeat2, Share2 } from "lucide-react"
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
}

export function FeedCard({ data, variant = "preloaded", className }: FeedCardProps) {
  const { head, text, quote, attachment, actions } = data

  const actionStats: StatProps[] = variant === "rich"
    ? [
        { icon: Heart, value: actions.likes, format: true },
        { icon: MessageCircle, value: actions.comments, format: true },
        { icon: Repeat2, value: actions.reposts ?? 0, format: true },
        { icon: Bookmark, value: actions.bookmarks, format: true },
      ]
    : [
        { icon: Eye, value: actions.views, format: true },
        { icon: MessageCircle, value: actions.comments, format: true },
        { icon: Bookmark, value: actions.bookmarks, format: true },
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
            aria-label="分享"
          >
            <Share2 className="size-4" />
          </button>
        </div>
      </div>
    </article>
  )
}
