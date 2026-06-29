"use client"

import { useTranslation } from "react-i18next"
import Link from "next/link"
import { Eye, Heart, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils/index"

export interface SearchResultData {
  id: string
  type: "page" | "author" | "moment" | "paper"
  title: string
  description: string
  coverUrl?: string
  author: { name: string; avatar?: string }
  stats: { views: number; likes: number; comments: number }
  url: string
}

const typeKeyMap: Record<string, string> = {
  page: "community.pageType",
  author: "community.authorType",
  moment: "community.momentType",
  paper: "community.paperType",
}

export function SearchResultCard({ data }: { data: SearchResultData }) {
  const { t } = useTranslation()
  return (
    <Link
      href={data.url}
      className="grid grid-cols-[118px_1fr_auto] gap-2.5 items-stretch rounded-xl border border-border bg-surface p-2 transition-all hover:border-primary/55 hover:shadow-sm"
    >
      {/* 缩略图 */}
      <div
        className="rounded-[9px] bg-cover bg-center min-h-[80px]"
        style={
          data.coverUrl
            ? { backgroundImage: `url(${data.coverUrl})` }
            : { background: "linear-gradient(135deg, var(--primary), var(--accent))" }
        }
      />

      {/* 正文 */}
      <div className="min-w-0 grid content-center gap-1.5">
        <span className="inline-flex items-center gap-1 w-max min-h-[22px] rounded-full bg-surface-secondary text-primary px-1.5 text-xs font-black">
          {t(typeKeyMap[data.type] || data.type)}
        </span>
        <h3 className="text-sm font-extrabold truncate">{data.title}</h3>
        <p className="text-[13px] text-muted-foreground truncate">
          {data.description}
        </p>
        <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground font-bold">
          <span className="truncate text-foreground">{data.author.name}</span>
        </div>
      </div>

      {/* 统计 */}
      <div className="flex flex-col justify-center gap-2 text-xs text-muted-foreground font-extrabold shrink-0">
        <span className="inline-flex items-center gap-1">
          <Eye className="h-3.5 w-3.5" />
          {data.stats.views.toLocaleString()}
        </span>
        <span className="inline-flex items-center gap-1">
          <Heart className="h-3.5 w-3.5" />
          {data.stats.likes.toLocaleString()}
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageSquare className="h-3.5 w-3.5" />
          {data.stats.comments.toLocaleString()}
        </span>
      </div>
    </Link>
  )
}
