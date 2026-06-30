"use client"

import * as React from "react"
import Link from "next/link"
import { LogIn } from "lucide-react"
import { useTranslation } from "react-i18next"
import { ProfileHero } from "@/components/content/profile-hero"
import { PageCard } from "@/components/content/page-card"
import { FeedCard } from "@/components/content/feed-card"
import { VibenTabs, VibenTabsList, VibenTabsTrigger, VibenTabsContent } from "@/components/ui/viben-tabs"
import { SectionHead } from "@/components/content/section-head"
import { EmptyState, T } from "@/components/content/i18n-text"
import { useAppShell } from "@/components/layout/app-shell"
import type { Session } from "@/lib/auth/types"
import type { PageCardData } from "@/components/content/page-card"
import type { ProfileHeroData } from "@/components/content/profile-hero"
import type { FeedCardData } from "@/components/content/feed-card"
import type { FeedKind } from "@/components/content/feed-head"

const PROFILE_TABS = ["页面", "动态", "合集", "关于"]

function gradientCover(title: string): string {
  const hue = title.charCodeAt(0) % 360
  return `linear-gradient(135deg, hsl(${hue},60%,35%), hsl(${(hue + 30) % 360},50%,45%))`
}

function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return ""
  const d = new Date(date)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "刚刚"
  if (mins < 60) return `${mins}分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}天前`
  if (days < 30) return `${Math.floor(days / 7)}周前`
  if (days < 365) return `${Math.floor(days / 30)}个月前`
  return `${Math.floor(days / 365)}年前`
}

const FEED_KIND_MAP: Record<string, FeedKind> = {
  post: "发布",
  page_update: "更新",
  repost: "转发",
  system: "更新",
}

interface ProfileData {
  user: {
    displayName: string
    userSlug: string
    avatarUrl: string | null
    bio: string | null
    followersCount: number
  }
  pageCards: Array<{ card: PageCardData; href: string }>
  feedCards: FeedCardData[]
  collections: Array<{ id: string; name: string; itemCount: number }>
}

interface ProfilePageClientProps {
  session: Session | null
}

export function ProfilePageClient({ session }: ProfilePageClientProps) {
  const { t } = useTranslation()
  const appShell = useAppShell()

  // 优先使用 AppShell context 中的 session（来自 layout，最可靠）
  const effectiveSession = appShell.session ?? session

  const [data, setData] = React.useState<ProfileData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(false)

  React.useEffect(() => {
    if (!effectiveSession?.userId) {
      setLoading(false)
      return
    }

    let cancelled = false

    async function fetchProfile() {
      try {
        const res = await fetch("/api/profile")
        if (!res.ok) throw new Error("Failed to fetch profile")
        const json = await res.json()
        if (!cancelled) {
          // 转换 API 返回数据为组件消费格式
          const user = json.user
          const profileData: ProfileData = {
            user: {
              displayName: user.displayName,
              userSlug: user.userSlug,
              avatarUrl: user.avatarUrl,
              bio: user.bio,
              followersCount: user.followersCount,
            },
            pageCards: (json.pages ?? []).map((p: Record<string, unknown>) => ({
              card: {
                cover: (p.coverUrl as string) ? `url(${p.coverUrl})` : gradientCover(p.title as string),
                title: p.title as string,
                description: (p.description as string) ?? undefined,
                author: {
                  name: (p.authorName as string) ?? user.displayName,
                  fallbackText: ((p.authorName as string) ?? user.displayName)?.[0] ?? "?",
                  avatarUrl: (p.authorAvatarUrl as string) ?? user.avatarUrl ?? undefined,
                },
                timeAgo: timeAgo(p.lastPublishedAt as string),
                stats: {
                  views: (p.viewCount as number) ?? 0,
                  likes: (p.likeCount as number) ?? 0,
                  comments: (p.commentCount as number) ?? 0,
                  bookmarks: (p.favoriteCount as number) ?? 0,
                },
              } satisfies PageCardData,
              href: `/read/${encodeURIComponent(user.userSlug)}/${encodeURIComponent(p.uid as string)}`,
            })),
            feedCards: (json.moments ?? []).map((m: Record<string, unknown>) => ({
              head: {
                fallbackText: user.displayName?.[0] ?? "?",
                avatarUrl: user.avatarUrl ?? undefined,
                name: user.displayName,
                handle: `@${user.userSlug}`,
                userSlug: user.userSlug,
                kind: (FEED_KIND_MAP[m.kind as string] ?? "发布") as FeedKind,
                timeAgo: timeAgo(m.createdAt as string),
                source: (m.source as string) ?? undefined,
              },
              text: (m.body as string) ?? "",
              quote: (m.quoteText as string) ?? undefined,
              actions: {
                views: (m.viewCount as number) ?? 0,
                likes: (m.likeCount as number) ?? 0,
                comments: (m.commentCount as number) ?? 0,
                reposts: (m.repostCount as number) ?? 0,
                bookmarks: (m.bookmarkCount as number) ?? 0,
              },
            } satisfies FeedCardData)),
            collections: (json.collections ?? []).map((c: Record<string, unknown>) => ({
              id: c.id as string,
              name: c.name as string,
              itemCount: (c.itemCount as number) ?? 0,
            })),
          }
          setData(profileData)
        }
      } catch (err) {
        console.error("[Profile] Failed to fetch:", err)
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchProfile()
    return () => { cancelled = true }
  }, [effectiveSession?.userId])

  // 未登录
  if (!effectiveSession?.userId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold"><T tKey="auth.signInRequired" fallback="需要登录" /></h2>
          <p className="text-muted-foreground"><T tKey="auth.signInRequiredDescription" fallback="请登录以访问此功能" /></p>
        </div>
        <Link
          href={`/login?redirect=${encodeURIComponent("/profile")}`}
          className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 font-bold hover:opacity-90 transition-opacity"
        >
          <LogIn className="size-4" />
          <T tKey="auth.signIn" fallback="登录" />
        </Link>
      </div>
    )
  }

  // 加载中
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-muted-foreground"><T tKey="common.loading" fallback="加载中..." /></div>
      </div>
    )
  }

  // 加载失败
  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <EmptyState tKey="common.error" fallback="加载失败，请稍后重试" />
      </div>
    )
  }

  const { user, pageCards, feedCards, collections } = data
  const profile: ProfileHeroData = {
    fallbackText: user.displayName?.[0] ?? "?",
    avatarUrl: user.avatarUrl ?? undefined,
    name: user.displayName,
    handle: `@${user.userSlug}`,
    userSlug: user.userSlug,
    tagline: user.bio ?? "",
    stats: {
      followers: user.followersCount,
      pages: data.pageCards.length,
    },
  }

  return (
    <div className="grid gap-4">
      <ProfileHero data={profile} currentUserSlug={user.userSlug} />
      <VibenTabs defaultValue="页面">
        <VibenTabsList>
          {PROFILE_TABS.map((tab) => (
            <VibenTabsTrigger key={tab} value={tab}>{tab}</VibenTabsTrigger>
          ))}
        </VibenTabsList>

        <VibenTabsContent value="页面" className="mt-3">
          <SectionHead title="公开页面" />
          {pageCards.length === 0 ? (
            <EmptyState tKey="community.noPages" fallback="暂无公开页面" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {pageCards.map((item, i) => (
                <PageCard key={i} data={item.card} variant="default" href={item.href} />
              ))}
            </div>
          )}
        </VibenTabsContent>

        <VibenTabsContent value="动态" className="mt-3">
          {feedCards.length === 0 ? (
            <EmptyState tKey="community.noMoments" fallback="暂无动态" />
          ) : (
            <div className="grid gap-2">
              {feedCards.map((feed, i) => (
                <FeedCard key={i} data={feed} variant="rich" />
              ))}
            </div>
          )}
        </VibenTabsContent>

        <VibenTabsContent value="合集" className="mt-3">
          <SectionHead title="合集" />
          {collections.length === 0 ? (
            <EmptyState tKey="community.collectionsSoon" fallback="暂无合集" />
          ) : (
            <div className="grid gap-2">
              {collections.map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-[10px] border border-border p-3">
                  <div className="font-bold text-sm flex-1">{c.name}</div>
                  <div className="text-[13px] text-muted-foreground">{c.itemCount} 项</div>
                </div>
              ))}
            </div>
          )}
        </VibenTabsContent>

        <VibenTabsContent value="关于" className="mt-3">
          <div className="max-w-[760px] text-sm text-muted-foreground leading-relaxed space-y-3">
            {user.bio ? (
              <p>{user.bio}</p>
            ) : (
              <p><T tKey="community.noDescription" fallback="还没有填写简介。" /></p>
            )}
          </div>
        </VibenTabsContent>
      </VibenTabs>
    </div>
  )
}
