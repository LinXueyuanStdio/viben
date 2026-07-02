import Link from "next/link"
import { Cover } from "./cover"
import { Pill } from "./pill"
import { ProgressMini } from "./progress-mini"
import { cn } from "@/lib/utils"

export type HistorySource = "首页" | "动态" | "榜单" | "PDF" | "搜索" | "合集"

export interface HistoryItemData {
  coverUrl?: string | null
  title: string
  author: string
  chapter: string
  source: HistorySource
  timeAgo: string
  progress: number
  progressLabel: string
}

interface HistoryItemProps {
  data: HistoryItemData
  href: string
  className?: string
}

export function HistoryItem({ data, href, className }: HistoryItemProps) {
  const { coverUrl, title, author, chapter, source, timeAgo, progress, progressLabel } = data

  return (
    <Link
      href={href}
      className={cn(
        "group grid rounded-[12px] border border-border bg-background overflow-hidden",
        "hover:border-primary/60 hover:shadow-md hover:shadow-primary/3",
        "transition-all duration-200",
        className
      )}
      style={{ gridTemplateColumns: "108px minmax(0, 1fr)" }}
    >
      <Cover
        coverUrl={coverUrl}
        fallbackTitle={title}
        aspectRatio="16/10"
        overlay
        className="rounded-none min-h-full"
      />
      <div className="grid gap-[7px] p-3">
        <strong className="font-['Lexend'] text-[15px] font-bold leading-snug line-clamp-2 group-hover:text-primary transition-colors duration-200">
          {title}
        </strong>
        <div className="flex items-center justify-between gap-2 text-[12px] text-muted-foreground">
          <span className="truncate">{author} · {chapter}</span>
          <Pill variant="source">{source}</Pill>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <span className="shrink-0">{timeAgo}</span>
          <span className="inline-block w-[3px] h-[3px] rounded-full bg-border shrink-0" />
          <span className="truncate">{progressLabel}</span>
        </div>
        <ProgressMini value={progress} className="mt-0.5" />
      </div>
    </Link>
  )
}
