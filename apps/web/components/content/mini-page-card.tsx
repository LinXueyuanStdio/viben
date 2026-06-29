import Link from "next/link"
import { Eye, Heart } from "lucide-react"
import { Cover } from "./cover"
import { StatsRow } from "./stats-row"
import type { StatProps } from "./stats-row"
import { cn } from "@/lib/utils"

export interface MiniPageCardData {
  cover: string
  title: string
  description: string
  authorName: string
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
  const { cover, title, description, stats } = data

  const detailStats: StatProps[] = [
    { icon: Eye, value: stats.views, format: true },
    { icon: Heart, value: stats.likes, format: true },
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
        <StatsRow stats={detailStats} />
      </div>
    </Link>
  )
}
