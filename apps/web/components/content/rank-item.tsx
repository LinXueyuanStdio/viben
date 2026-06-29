import Link from "next/link"
import { Eye, Heart, MessageCircle } from "lucide-react"
import { Cover } from "./cover"
import { MetaRow } from "./meta-row"
import { Stat } from "./stats-row"
import { cn } from "@/lib/utils"

export interface RankItemData {
  rank: number
  cover: string
  title: string
  description: string
  delta: string
  author: {
    name: string
    fallbackText: string
    avatarUrl?: string
  }
  stats: {
    views: number
    likes: number
    comments: number
  }
  score: number
  scoreLabel: string
}

interface RankItemProps {
  data: RankItemData
  href: string
  className?: string
}

export function RankItem({ data, href, className }: RankItemProps) {
  const { rank, cover, title, description, delta, author, stats, score, scoreLabel } = data

  return (
    <Link
      href={href}
      className={cn(
        "grid gap-2.5 rounded-[12px] border border-border p-[9px]",
        "hover:border-primary transition-colors duration-150",
        className
      )}
      style={{ gridTemplateColumns: "46px 150px minmax(0, 1fr) auto" }}
    >
      {/* Rank Number */}
      <div className="flex items-center justify-center font-['Lexend'] text-lg font-bold text-primary">
        {String(rank).padStart(2, "0")}
      </div>

      {/* Cover */}
      <Cover src={cover} aspectRatio="16/10" className="rounded-[9px]" />

      {/* Body */}
      <div className="grid gap-[7px]">
        <div className="flex items-center gap-[7px]">
          <strong className="font-['Lexend'] text-[15px] font-bold line-clamp-2">{title}</strong>
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{delta}</span>
        </div>
        <p className="text-[13px] text-muted-foreground truncate">{description}</p>
        <MetaRow author={author} />
        <div className="flex items-center gap-2">
          <Stat icon={Eye} value={stats.views} format />
          <Stat icon={Heart} value={stats.likes} format />
          <Stat icon={MessageCircle} value={stats.comments} format />
        </div>
      </div>

      {/* Score */}
      <div className="flex flex-col items-end justify-center gap-[5px] min-w-[78px]">
        <span className="font-['Lexend'] text-xl font-bold text-primary">{score.toLocaleString()}</span>
        <span className="text-xs text-muted-foreground">{scoreLabel}</span>
      </div>
    </Link>
  )
}
