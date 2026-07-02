import Link from "next/link"
import { Eye, ThumbsUp, MessageCircle } from "lucide-react"
import { Cover } from "./cover"
import { StatsRow } from "./stats-row"
import type { StatProps } from "./stats-row"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

export interface MiniPageCardData {
  cover: string
  title: string
  description: string
  authorDisplayName: string
  authorAvatarUrl?: string
  authorFallbackText?: string
  commentCount?: number
  stats: {
    views: number
    likes: number
  }
}

interface MiniPageCardProps {
  data: MiniPageCardData
  href: string
  className?: string
}

export function MiniPageCard({ data, href, className }: MiniPageCardProps) {
  const { cover, title, description, authorDisplayName, authorAvatarUrl, authorFallbackText, commentCount, stats } = data

  const detailStats: StatProps[] = [
    { icon: Eye, value: stats.views, format: true },
    { icon: ThumbsUp, value: stats.likes, format: true },
    ...(commentCount !== undefined ? [{ icon: MessageCircle, value: commentCount, format: true } as StatProps] : []),
  ]

  return (
    <Link
      href={href}
      className={cn(
        "grid gap-[9px] rounded-[10px] border border-border p-[7px]",
        "hover:border-primary transition-colors duration-150",
        className
      )}
      style={{ gridTemplateColumns: "92px 1fr" }}
    >
      <Cover src={cover} aspectRatio="16/9" className="rounded-[7px]" />
      <div className="grid gap-0.5 min-w-0">
        <strong className="text-[14px] font-bold truncate">{title}</strong>
        <p className="text-[13px] text-muted-foreground truncate">{description}</p>
        <div className="flex items-center gap-2">
          {authorAvatarUrl !== undefined && (
            <div className="flex items-center gap-1 min-w-0">
              <Avatar className="size-[14px] shrink-0">
                <AvatarImage src={authorAvatarUrl} />
                <AvatarFallback className="text-[8px] leading-none">{authorFallbackText ?? authorDisplayName[0]}</AvatarFallback>
              </Avatar>
              <span className="text-[12px] text-muted-foreground truncate">{authorDisplayName}</span>
            </div>
          )}
          <StatsRow stats={detailStats} />
        </div>
      </div>
    </Link>
  )
}
