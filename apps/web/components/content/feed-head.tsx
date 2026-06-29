"use client"

import { useTranslation } from "react-i18next"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { IconButton } from "@/components/ui/icon-button"
import { MoreHorizontal } from "lucide-react"
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
  const { fallbackText, avatarUrl, name, handle, userSlug, kind, timeAgo, source } = data
  const authorHref = `/author/${encodeURIComponent(userSlug)}`

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
      <IconButton label={t("community.moreActions")} size="compact">
        <MoreHorizontal className="size-4" />
      </IconButton>
    </div>
  )
}
