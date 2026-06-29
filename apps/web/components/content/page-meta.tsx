"use client"

import React, { useState } from "react"
import { ChevronRight, Eye, Bookmark, Share2, Heart, UserPlus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Pill } from "./pill"
import { Stat } from "./stats-row"
import { SectionHead } from "./section-head"
import { MiniPageCard } from "./mini-page-card"
import type { MiniPageCardData } from "./mini-page-card"
import { cn } from "@/lib/utils"
import { formatCount } from "@/lib/utils/format"

export interface PageMetaData {
  author: {
    name: string
    fallbackText: string
    avatarUrl?: string
    followerCount: number
  }
  title: string
  uid: string
  sidePageUid?: string
  description: string[]
  tags: string[]
  stats: {
    views: number
    bookmarks: number
    date: string
  }
  actions: {
    likes: number
    bookmarks: number
    shares: number
  }
  chapters?: {
    number: number
    title: string
    status?: string
  }[]
  chapterProgress?: {
    current: number
    total: number
  }
  recommendations?: MiniPageCardData[]
}

interface PageMetaProps {
  data: PageMetaData
  defaultExpanded?: boolean
  className?: string
}

export const PageMeta = React.memo(function PageMeta({ data, defaultExpanded = false, className }: PageMetaProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(defaultExpanded)
  const { author, title, uid, sidePageUid, description, tags, stats, actions, chapters, chapterProgress, recommendations } = data

  const actionButtons = [
    { icon: Heart, label: formatCount(actions.likes), value: actions.likes },
    { icon: Bookmark, label: formatCount(actions.bookmarks), value: actions.bookmarks },
    { icon: Share2, label: formatCount(actions.shares), value: actions.shares },
  ]

  return (
    <div className={cn("grid gap-[11px]", className)}>
      {/* Author */}
      <div className="grid grid-cols-[auto_1fr_auto] gap-[9px] items-center">
        <Avatar className="size-[34px]">
          <AvatarImage src={author.avatarUrl} alt={author.name} />
          <AvatarFallback>{author.fallbackText}</AvatarFallback>
        </Avatar>
        <div className="grid gap-[3px] min-w-0">
          <div className="font-bold text-sm truncate">{author.name}</div>
          <div className="text-[12.5px] text-muted-foreground">
            {formatCount(author.followerCount)} 位关注者
          </div>
        </div>
        <Button variant="outline" size="sm" className="h-9 gap-1 border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400 shrink-0">
          <UserPlus className="size-[14px]" />
          {t('community.follow')}
        </Button>
      </div>

      {/* Title Row */}
      <div className="grid grid-cols-[1fr_auto] gap-2 items-start">
        <h3 className="font-['Lexend'] text-xl font-bold leading-tight">{title}</h3>
        <button
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center justify-center size-8 rounded-[9px] hover:bg-surface-secondary text-muted-foreground shrink-0"
          aria-label={expanded ? "收起详情" : "展开详情"}
        >
          <ChevronRight className={cn("size-5 transition-transform", expanded && "rotate-90")} />
        </button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <Stat icon={Eye} value={stats.views} format />
        <Stat icon={Bookmark} value={stats.bookmarks} format />
        <span>{stats.date}</span>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-3 gap-[7px]">
        {actionButtons.map((btn, i) => (
          <button
            key={i}
            className="flex flex-col items-center justify-center gap-0.5 min-h-[62px] rounded-[13px] bg-surface-secondary hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
          >
            <btn.icon className="size-5" />
            <span className="text-[13px] font-bold">{btn.label}</span>
          </button>
        ))}
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="grid gap-[7px] text-sm text-muted-foreground leading-relaxed">
          <div className="text-[13px]">
            UID: {uid}{sidePageUid && <> · 副页: {sidePageUid}</>}
          </div>
          {description.map((p, i) => (
            <p key={i} className="max-w-[760px]">{p}</p>
          ))}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {tags.map((tag) => (
                <Pill key={tag} variant="tag">{tag}</Pill>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Chapters */}
      {chapters && chapters.length > 0 && (
        <div className="grid gap-2 pt-0.5">
          <SectionHead
            title={t('community.collections')}
            actionLabel={chapterProgress ? `${chapterProgress.current} / ${chapterProgress.total}` : undefined}
            actionHref={undefined}
          />
          <div className="grid gap-1.5">
            {chapters.map((ch) => (
              <div
                key={ch.number}
                className="grid gap-2 items-center rounded-[9px] px-2.5 min-h-[38px] hover:bg-surface-secondary cursor-pointer"
                style={{ gridTemplateColumns: "auto 1fr auto" }}
              >
                <Pill variant="rank">{String(ch.number).padStart(2, "0")}</Pill>
                <span className="font-bold text-sm truncate">{ch.title}</span>
                {ch.status && (
                  <span className="text-[12.5px] text-muted-foreground">{ch.status}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <div className="grid gap-2">
          <SectionHead title={t('community.recommended')} />
          <div className="grid gap-2">
            {recommendations.map((rec, i) => (
              <MiniPageCard key={i} data={rec} href={`/read/${rec.authorName}/${i}`} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
})
