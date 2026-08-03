import Link from "next/link"
import { Eye, ThumbsUp, MessageCircle } from "lucide-react"
import { Cover } from "./cover"
import { MetaRow } from "./meta-row"
import { Stat } from "./stats-row"
import { cn } from "@/lib/utils"

export interface RankItemData {
  rank: number
  coverUrl?: string | null
  title: string
  description: string
  delta: string
  author: {
    name: string
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

/** 排名数字的颜色层级 */
function rankColor(rank: number): { fill: string; stroke: string } {
  if (rank === 1) return { fill: "#f59e0b", stroke: "#d97706" }   // 金
  if (rank === 2) return { fill: "#94a3b8", stroke: "#64748b" }    // 银
  if (rank === 3) return { fill: "#d97706", stroke: "#b45309" }    // 铜
  return { fill: "#71717a", stroke: "#52525b" }
}

export function RankItem({ data, href, className }: RankItemProps) {
  const { rank, coverUrl, title, description, delta, author, stats } = data
  const color = rankColor(rank)

  return (
    <Link
      href={href}
      className={cn(
        "grid gap-2.5 rounded-[12px] p-[9px]",
        "hover:bg-accent/50 transition-colors duration-150",
        className
      )}
      style={{ gridTemplateColumns: "46px 180px minmax(0, 1fr)" }}
    >
      {/* Rank — SVG 艺术字 + 排名变化 */}
      <div className="flex flex-col items-center justify-center gap-0.5">
        <svg viewBox="0 0 32 40" className="h-10 w-8">
          <text
            x="16" y="30"
            textAnchor="middle"
            fill={color.fill}
            stroke={color.stroke}
            strokeWidth="0.6"
            className="font-['Lexend'] text-[28px] font-extrabold"
            style={{ paintOrder: "stroke fill" }}
          >
            {rank}
          </text>
        </svg>
        {delta !== "—" && (
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">{delta}</span>
        )}
      </div>

      {/* Cover */}
      <div className="flex items-center">
        <Cover coverUrl={coverUrl} fallbackTitle={title} aspectRatio="16/10" className="rounded-[9px] w-full" />
      </div>

      {/* Body */}
      <div className="grid gap-[7px]">
        <div className="flex items-center gap-[7px]">
          <strong className="font-['Lexend'] text-[15px] font-bold line-clamp-2">{title}</strong>
        </div>
        <p className="text-[13px] text-muted-foreground truncate">{description}</p>
        <MetaRow author={author} />
        <div className="flex items-center gap-2">
          <Stat icon={Eye} value={stats.views} format />
          <Stat icon={ThumbsUp} value={stats.likes} format />
          <Stat icon={MessageCircle} value={stats.comments} format />
        </div>
      </div>
    </Link>
  )
}
