import { Eye, MessageCircle, X } from "lucide-react"
import { Cover } from "./cover"
import { StatsRow } from "./stats-row"
import type { StatProps } from "./stats-row"
import { cn } from "@/lib/utils"

export interface AttachmentData {
  cover: string
  title: string
  description?: string
  authorName: string
  timeAgo: string
  stats: {
    views: number
    comments: number
  }
}

interface AttachmentProps {
  data: AttachmentData
  onRemove?: () => void
  className?: string
}

export function Attachment({ data, onRemove, className }: AttachmentProps) {
  const { cover, title, authorName, timeAgo, stats } = data

  const coverStats: StatProps[] = [
    { icon: Eye, value: stats.views, format: true },
    { icon: MessageCircle, value: stats.comments, format: true },
  ]

  return (
    <div className={cn(
      "relative max-w-[520px] border border-border rounded-[12px] overflow-hidden",
      "hover:border-primary transition-colors duration-150",
      className
    )}>
      <Cover src={cover} aspectRatio="16/9" overlay>
        <StatsRow stats={coverStats} className="text-white [&_svg]:text-white [&_span]:text-white" />
      </Cover>
      <div className="grid gap-[7px] p-2.5">
        <div className="font-bold text-[14.5px] leading-snug line-clamp-2 text-foreground">
          {title}
        </div>
        <div className="flex items-center gap-[7px] text-[13px] text-muted-foreground">
          <span className="font-bold">{authorName}</span>
          <span className="inline-block size-[3px] rounded-full bg-[#9bb8c2] shrink-0" />
          <span>{timeAgo}</span>
        </div>
      </div>
      {onRemove && (
        <button
          onClick={(e) => { e.preventDefault(); onRemove() }}
          className="absolute top-1.5 right-1.5 size-6 flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60"
          aria-label="移除附件"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}
