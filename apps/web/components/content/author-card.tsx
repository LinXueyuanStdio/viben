"use client"

import { useTranslation } from "react-i18next"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { FollowButton } from "./follow-button"
import { cn } from "@/lib/utils"
import { formatCount } from "@/lib/utils/format"

export interface AuthorCardData {
  fallbackText: string
  avatarUrl?: string
  name: string
  handle: string
  userSlug: string
  description: string
  pageCount: number
  followerCount: number
  representativeWork?: string
  mutualFollows?: number
}

interface AuthorCardProps {
  data: AuthorCardData
  className?: string
  currentUserSlug?: string
}

export function AuthorCard({ data, className, currentUserSlug }: AuthorCardProps) {
  const { t } = useTranslation()
  const { fallbackText, avatarUrl, name, userSlug, description, pageCount, followerCount, representativeWork, mutualFollows } = data

  return (
    <Link
      href={`/${encodeURIComponent(userSlug)}`}
      className={cn(
        "block grid grid-cols-[auto_1fr_auto] items-center gap-[9px] rounded-[10px] border border-border p-2.5",
        "hover:border-primary transition-colors duration-150",
        className
      )}
    >
      <Avatar className="size-[34px]">
        <AvatarImage src={avatarUrl} alt={name} />
        <AvatarFallback>{fallbackText}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="font-bold leading-[1.2] truncate">{name}</div>
        <div className="text-[13px] text-muted-foreground leading-[1.3] mt-[3px] mb-[6px]">
          <span className="block truncate">{description}</span>
          <span className="block truncate">
            {pageCount} {t("community.pages")} · {t("community.followersCountWithFormat", { formattedCount: formatCount(followerCount) })}
          </span>
        </div>
      </div>
      <FollowButton
        userSlug={userSlug}
        currentUserSlug={currentUserSlug}
        className="h-9 shrink-0 gap-1 border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400"
      />
      {(representativeWork || mutualFollows != null) && (
        <div className="col-span-full text-[13px] text-muted-foreground truncate">
          {representativeWork && <span>{t("community.representativeWork", { title: representativeWork })}</span>}
          {representativeWork && mutualFollows != null && <span> · </span>}
          {mutualFollows != null && <span>{t("community.mutualFollowsPerson", { count: mutualFollows })}</span>}
        </div>
      )}
    </Link>
  )
}
