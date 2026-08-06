"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { useTranslation } from "react-i18next"
import { Settings } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface TeamStats {
  followersCount: number
  followingCount: number
  memberCount: number
  projectCount: number
}

interface TeamPageShellProps {
  teamSlug: string
  teamName: string
  teamAvatarUrl: string | null
  teamBio?: string | null
  teamWebsiteUrl?: string | null
  stats?: TeamStats
  currentUserRole: string | null
  activeTab?: "overview" | "projects" | "members" | "settings"
  children?: ReactNode
  followButton?: ReactNode
  /** 是否显示完整 profile header（头像、简介、网址、统计）。仅 overview 使用。 */
  showProfileHeader?: boolean
  /** 是否显示 header。默认 true，settings 页不需要。 */
  showHeader?: boolean
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

export function TeamPageShell({
  teamSlug, teamName, teamAvatarUrl, teamBio, teamWebsiteUrl,
  stats, currentUserRole, activeTab = "overview", children, followButton,
  showProfileHeader = false, showHeader = true,
}: TeamPageShellProps) {
  const { t } = useTranslation()
  const initials = teamName.slice(0, 2).toUpperCase()

  return (
    <div className="space-y-6">
      {showHeader && (showProfileHeader ? (
        /* 团队资料头部 — 仅 overview，参考用户 profile 左侧栏 */
        <div className="relative flex flex-col sm:flex-row items-start gap-5 p-5 rounded-xl border bg-card/50">
          {currentUserRole === "owner" && (
            <Link
              href={`/team/${encodeURIComponent(teamSlug)}/settings`}
              className="absolute top-3 right-3 inline-flex items-center justify-center size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-secondary transition-colors"
              aria-label={t("common.settings")}
            >
              <Settings className="size-4" />
            </Link>
          )}
          <Avatar className="h-20 w-20 sm:h-24 sm:w-24 rounded-full ring-2 ring-border shrink-0">
            <AvatarImage src={teamAvatarUrl ?? undefined} alt={teamName} />
            <AvatarFallback className="text-3xl font-semibold text-muted-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 space-y-2 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">{teamName}</h1>
              {followButton}
            </div>

            {teamBio ? (
              <p className="text-sm text-muted-foreground leading-relaxed">{teamBio}</p>
            ) : currentUserRole === "owner" ? (
              <p className="text-sm text-muted-foreground/60 italic">
                {t("team.overview.addBioHint")}
              </p>
            ) : null}

            {teamWebsiteUrl && (
              <a
                href={teamWebsiteUrl.startsWith("http") ? teamWebsiteUrl : `https://${teamWebsiteUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors font-medium"
              >
                <svg className="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                {teamWebsiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </a>
            )}

            {stats && (
              <div className="flex items-center gap-3 pt-1">
                <Link href={`/${encodeURIComponent(teamSlug)}/followers`} className="flex items-baseline gap-1 hover:underline">
                  <span className="text-sm font-bold tabular-nums">{formatCount(stats.followersCount)}</span>
                  <span className="text-[13px] text-muted-foreground">{t("team.stats.followers")}</span>
                </Link>
                <span className="text-muted-foreground/30">·</span>
                <Link href={`/${encodeURIComponent(teamSlug)}/following`} className="flex items-baseline gap-1 hover:underline">
                  <span className="text-sm font-bold tabular-nums">{formatCount(stats.followingCount)}</span>
                  <span className="text-[13px] text-muted-foreground">{t("team.stats.following")}</span>
                </Link>
                <span className="text-muted-foreground/30">·</span>
                <Link href={`/team/${encodeURIComponent(teamSlug)}/members`} className="flex items-baseline gap-1 hover:underline">
                  <span className="text-sm font-bold tabular-nums">{formatCount(stats.memberCount)}</span>
                  <span className="text-[13px] text-muted-foreground">{t("team.stats.members")}</span>
                </Link>
                <span className="text-muted-foreground/30">·</span>
                <Link href={`/team/${encodeURIComponent(teamSlug)}/projects`} className="flex items-baseline gap-1 hover:underline">
                  <span className="text-sm font-bold tabular-nums">{formatCount(stats.projectCount)}</span>
                  <span className="text-[13px] text-muted-foreground">{t("team.stats.projects")}</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* 简洁 header — projects / members / settings 等子页 */
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{teamName}</h1>
          {followButton}
        </div>
      ))}

      <div className="min-w-0">
        {children}
      </div>
    </div>
  )
}
