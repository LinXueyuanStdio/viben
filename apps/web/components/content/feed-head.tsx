"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import Link from "next/link"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { IconButton } from "@/components/ui/icon-button"
import { MoreHorizontal, Flag, Share2 } from "lucide-react"
import { Pill } from "./pill"
import { cn } from "@/lib/utils"

export type FeedKind = "更新" | "发布" | "转发" | "评论" | "收藏" | "模板" | "数据" | "合集" | "论文" | "笔记"

export interface FeedHeadData {
  fallbackText: string
  avatarUrl?: string
  name: string
  handle: string
  userSlug: string
  kind: FeedKind
  timeAgo: string
  source?: string
}

interface FeedHeadProps {
  data: FeedHeadData
  className?: string
}

export function FeedHead({ data, className }: FeedHeadProps) {
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)
  const { fallbackText, avatarUrl, name, handle, userSlug, kind, timeAgo, source } = data
  const authorHref = `/author/${encodeURIComponent(userSlug)}`

  const handleCopyLink = () => {
    setMenuOpen(false)
    const url = `${window.location.origin}/author/${encodeURIComponent(userSlug)}`
    navigator.clipboard.writeText(url).then(
      () => toast.success(t("common.copied")),
      () => toast.error(t("community.copyLinkFailed"))
    )
  }

  return (
    <div className={cn("grid grid-cols-[auto_1fr_auto] gap-[9px] items-center", className)}>
      <Link href={authorHref} className="shrink-0">
        <Avatar className="size-[34px]">
          <AvatarImage src={avatarUrl} alt={name} />
          <AvatarFallback>{fallbackText}</AvatarFallback>
        </Avatar>
      </Link>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <Link href={authorHref} className="font-bold text-sm truncate hover:underline">
            {name}
          </Link>
          <Pill variant="kind">{kind}</Pill>
        </div>
        <div className="text-[13px] text-muted-foreground truncate">
          {handle}
          <span className="mx-[7px]">·</span>
          {timeAgo}
          {source && (
            <>
              <span className="mx-[7px]">·</span>
              {t("community.fromSource", { source })}
            </>
          )}
        </div>
      </div>
      <div
        className="relative"
        onMouseEnter={() => setMenuOpen(true)}
        onMouseLeave={() => setMenuOpen(false)}
      >
        <IconButton label={t("community.moreActions")} size="compact">
          <MoreHorizontal className="size-4" />
        </IconButton>
        {menuOpen && (
          <div className="absolute top-full right-0 z-70 w-[min(180px,calc(100vw-28px))] grid gap-1 p-1.5 rounded-xl border border-border bg-popover/98 backdrop-blur-[14px] shadow-md">
            <button
              onClick={() => {
                setMenuOpen(false)
                toast.info(t("community.reportFeatureSoon"))
              }}
              className="grid grid-cols-[18px_1fr] items-center gap-2 min-h-[38px] rounded-[9px] px-2.5 text-left font-extrabold text-muted-foreground hover:bg-surface-secondary hover:text-foreground"
            >
              <Flag className="h-4 w-4" /> {t("community.report")}
            </button>
            <button
              onClick={handleCopyLink}
              className="grid grid-cols-[18px_1fr] items-center gap-2 min-h-[38px] rounded-[9px] px-2.5 text-left font-extrabold text-muted-foreground hover:bg-surface-secondary hover:text-foreground"
            >
              <Share2 className="h-4 w-4" /> {t("community.copyLink")}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
