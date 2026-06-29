"use client"

import { useTranslation } from "react-i18next"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { FollowButton } from "./follow-button"
import { Pill } from "./pill"
import { cn } from "@/lib/utils"
import { formatCount } from "@/lib/utils/format"

export interface ProfileHeroData {
  fallbackText: string
  avatarUrl?: string
  name: string
  handle: string
  tagline: string
  userSlug: string
  stats: {
    followers: number
    pages: number
    mutualFollows?: number
  }
}

interface ProfileHeroProps {
  data: ProfileHeroData
  className?: string
  currentUserSlug?: string
}

export function ProfileHero({ data, className, currentUserSlug }: ProfileHeroProps) {
  const { t } = useTranslation()
  const { fallbackText, avatarUrl, name, handle, tagline, userSlug, stats } = data

  return (
    <div className={cn(
      "grid gap-[14px] items-center p-[14px] rounded-[12px] border border-border bg-background shadow-sm",
      className
    )}
    style={{ gridTemplateColumns: "58px 1fr auto" }}>
      <Avatar className="size-[58px] shrink-0">
        <AvatarImage src={avatarUrl} alt={name} />
        <AvatarFallback>{fallbackText}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <h1 className="font-['Lexend'] text-[26px] leading-[1.1] font-bold truncate">{name}</h1>
        <div className="text-[13px] text-muted-foreground mt-1">
          {handle} · {tagline}
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <Pill variant="default">{t("community.followersCountWithFormat", { formattedCount: formatCount(stats.followers) })}</Pill>
          <Pill variant="default">{stats.pages} {t("community.pages")}</Pill>
          {stats.mutualFollows != null && (
            <Pill variant="default">{t("community.mutualFollows", { count: stats.mutualFollows })}</Pill>
          )}
        </div>
      </div>
      <FollowButton
        userSlug={userSlug}
        currentUserSlug={currentUserSlug}
        className="h-9 shrink-0 gap-1 border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400"
      />
    </div>
  )
}
