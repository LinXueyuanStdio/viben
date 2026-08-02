"use client"

import Link from "next/link"
import { useState } from "react"
import { Eye, ThumbsUp, MessageCircle, MoreHorizontal, Download } from "lucide-react"
import { Cover } from "@/components/content/cover"
import { MetaRow } from "@/components/content/meta-row"
import { Stat } from "@/components/content/stats-row"
import { cn } from "@/lib/utils"

export interface ProfileContentItemData {
  coverUrl?: string | null
  title: string
  description?: string
  author: {
    name: string
    avatarUrl?: string
  }
  timeAgo?: string
  stats?: {
    views?: number
    likes?: number
    comments?: number
    downloads?: number
  }
  /** 类型标签，如 "MCP"、"技能"、"v1.0.0" */
  badges?: string[]
  /** 可见性标签，如 "公开"、"私有"，显示为彩色胶囊 */
  visibilityLabel?: string
}

interface ProfileContentItemProps {
  data: ProfileContentItemData
  href?: string
  className?: string
  /** 更多菜单项，不传则不显示更多按钮 */
  moreMenuItems?: {
    label: string
    icon?: React.ReactNode
    onClick: () => void
    destructive?: boolean
  }[]
}

export function ProfileContentItem({ data, href, className, moreMenuItems }: ProfileContentItemProps) {
  const { coverUrl, title, description, author, timeAgo, stats, badges, visibilityLabel } = data
  const [menuOpen, setMenuOpen] = useState(false)
  const hasMenu = moreMenuItems && moreMenuItems.length > 0

  const inner = (
    <div
      className={cn(
        "grid gap-2.5 rounded-[12px] border border-border p-[9px]",
        href && "hover:border-primary transition-colors duration-150",
        className
      )}
      style={{ gridTemplateColumns: "150px minmax(0, 1fr) auto" }}
    >
      {/* Cover */}
      <Cover coverUrl={coverUrl} fallbackTitle={title} aspectRatio="16/10" className="rounded-[9px]" />

      {/* Body */}
      <div className="grid gap-[7px] content-start">
        <div className="flex items-center gap-[7px] flex-wrap">
          <strong className="font-['Lexend'] text-[15px] font-bold line-clamp-2">{title}</strong>
          {visibilityLabel && (
            <span className={cn(
              "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold shrink-0",
              visibilityLabel === "公开"
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            )}>
              {visibilityLabel}
            </span>
          )}
          {badges?.map((badge, i) => (
            <span key={i} className="inline-flex items-center rounded-md border border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {badge}
            </span>
          ))}
        </div>
        {description && (
          <p className="text-[13px] text-muted-foreground truncate">{description}</p>
        )}
        <MetaRow author={author} meta={timeAgo ? [timeAgo] : undefined} />
        {stats && (
          <div className="flex items-center gap-2">
            {stats.views != null && <Stat icon={Eye} value={stats.views} format />}
            {stats.likes != null && <Stat icon={ThumbsUp} value={stats.likes} format />}
            {stats.comments != null && <Stat icon={MessageCircle} value={stats.comments} format />}
            {stats.downloads != null && <Stat icon={Download} value={stats.downloads} format />}
          </div>
        )}
      </div>

      {/* More menu */}
      {hasMenu && (
        <div className="relative self-start" onMouseLeave={() => setMenuOpen(false)}>
          <button
            className="inline-flex items-center justify-center size-[30px] rounded-[9px] hover:bg-surface-secondary text-muted-foreground"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(!menuOpen) }}
            onMouseEnter={() => setMenuOpen(true)}
          >
            <MoreHorizontal className="size-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-70 w-[min(180px,calc(100vw-28px))] grid gap-1 p-1.5 rounded-xl border border-border bg-popover/98 backdrop-blur-[14px] shadow-md">
              {moreMenuItems.map((item, i) => (
                <button
                  key={i}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    item.onClick()
                    setMenuOpen(false)
                  }}
                  className={cn(
                    "grid grid-cols-[18px_1fr] items-center gap-2 min-h-[38px] rounded-[9px] px-2.5 text-left font-extrabold hover:bg-surface-secondary",
                    item.destructive
                      ? "text-destructive hover:text-destructive"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {item.icon ?? <span className="w-[18px]" />}
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )

  if (href) {
    return (
      <Link href={href} className={cn("block cursor-pointer", className)}>
        {inner}
      </Link>
    )
  }

  return inner
}
