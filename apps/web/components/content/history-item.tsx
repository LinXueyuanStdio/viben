import Link from "next/link"
import { Cover } from "./cover"
import { Pill } from "./pill"
import { ProgressMini } from "./progress-mini"
import { cn } from "@/lib/utils"

export type HistorySource = "首页" | "动态" | "榜单" | "PDF" | "搜索" | "合集"

export interface HistoryItemData {
  cover: string
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
  const { cover, title, author, chapter, source, timeAgo, progress, progressLabel } = data

  return (
    <Link
      href={href}
      className={cn(
        "grid rounded-[12px] border border-border overflow-hidden",
        "hover:border-primary transition-colors duration-150",
        className
      )}
      style={{ gridTemplateColumns: "104px minmax(0, 1fr)" }}
    >
      <Cover src={cover} aspectRatio="16/9" overlay className="rounded-none min-h-[92px]" />
      <div className="grid gap-1.5 p-2.5">
        <strong className="font-['Lexend'] text-[15px] font-bold line-clamp-2">{title}</strong>
        <div className="flex items-center justify-between gap-2 text-[12.5px] text-muted-foreground">
          <span className="truncate">{author} · {chapter}</span>
          <Pill variant="source">{source}</Pill>
        </div>
        <div className="text-[12.5px] text-muted-foreground">
          {timeAgo} · {progressLabel}
        </div>
        <ProgressMini value={progress} />
      </div>
    </Link>
  )
}
