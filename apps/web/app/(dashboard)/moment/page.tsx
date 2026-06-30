import { Composer } from "@/components/content/composer"
import { FeedCard } from "@/components/content/feed-card"
import { AuthorCard } from "@/components/content/author-card"
import { SectionHead } from "@/components/content/section-head"
import { VibenTabs, VibenTabsList, VibenTabsTrigger, VibenTabsContent } from "@/components/ui/viben-tabs"
import { listMoments } from "@/lib/services/community"
import { EmptyState, T } from "@/components/content/i18n-text"
import { db, users } from "@/lib/db"
import { desc, ne } from "drizzle-orm"
import { getSession } from "@/lib/auth/cookies"
import type { FeedCardData } from "@/components/content/feed-card"
import type { AuthorCardData } from "@/components/content/author-card"

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

const FEED_KIND_MAP: Record<string, "更新" | "发布" | "转发" | "评论" | "收藏" | "模板" | "数据" | "合集" | "论文" | "笔记"> = {
  post: "发布",
  page_update: "更新",
  repost: "转发",
  system: "更新",
}

const MOMENT_TABS = [
  { key: "最新", feedType: "latest" as const },
  { key: "关注", feedType: "following" as const },
  { key: "推荐", feedType: "recommended" as const },
]

export default async function MomentPage() {
  const session = await getSession()

  const [latestResult, followingResult, recommendedResult, topAuthors] = await Promise.all([
    listMoments({ feedType: "latest", session, limit: 10 }),
    session ? listMoments({ feedType: "following", session, limit: 10 }) : Promise.resolve(null),
    listMoments({ feedType: "recommended", session, limit: 10 }),
    session?.userId
      ? db.select().from(users).where(ne(users.id, session.userId)).orderBy(desc(users.followersCount)).limit(1)
      : db.select().from(users).orderBy(desc(users.followersCount)).limit(1),
  ])

  function mapFeedItems(items: typeof latestResult.items): FeedCardData[] {
    return items.map((item) => ({
      head: {
        fallbackText: item.author.display_name?.[0] ?? "?",
        avatarUrl: item.author.avatar_url ?? undefined,
        name: item.author.display_name,
        handle: `@${item.author.user_slug}`,
        userSlug: item.author.user_slug,
        kind: FEED_KIND_MAP[item.moment.kind] ?? "发布",
        timeAgo: timeAgo(item.moment.created_at),
        source: item.moment.source ?? undefined,
      },
      text: item.moment.body ?? "",
      quote: item.moment.quote_text ?? undefined,
      attachment: item.attachments?.[0] ? {
        cover: item.attachments[0].cover_url
          ? `url(${item.attachments[0].cover_url})`
          : gradientCover(item.attachments[0].title ?? ""),
        title: item.attachments[0].title ?? "",
        authorName: item.attachments[0].author_name_snapshot ?? "",
        timeAgo: "",
        stats: {
          views: item.attachments[0].view_count_snapshot ?? 0,
          comments: item.attachments[0].comment_count_snapshot ?? 0,
        },
      } : undefined,
      actions: {
        views: item.moment.view_count ?? 0,
        likes: item.moment.like_count,
        comments: item.moment.comment_count,
        reposts: item.moment.repost_count,
        bookmarks: item.moment.bookmark_count ?? 0,
        momentId: item.moment.id,
      },
    }))
  }

  const tabFeeds: Record<string, FeedCardData[]> = {
    "最新": mapFeedItems(latestResult.items),
    "关注": followingResult ? mapFeedItems(followingResult.items) : [],
    "推荐": mapFeedItems(recommendedResult.items),
  }

  const authorCards: AuthorCardData[] = topAuthors.map((u) => ({
    fallbackText: u.displayName?.[0] ?? "?",
    avatarUrl: u.avatarUrl ?? undefined,
    name: u.displayName,
    handle: `@${u.userSlug}`,
    userSlug: u.userSlug,
    description: u.bio ?? "",
    pageCount: u.pageCount ?? 0,
    followerCount: u.followersCount,
  }))

  return (
    <div className="grid gap-[14px]" style={{ gridTemplateColumns: "minmax(0, 1fr) 330px" }}>
      <div className="grid gap-3">
        <div className="rounded-[12px] border border-border bg-background shadow-sm p-2.5">
          <Composer userFallbackText={session?.username?.[0] ?? "你"} userAvatarUrl={session?.avatarUrl} />
        </div>
        <VibenTabs defaultValue="最新">
          <VibenTabsList>
            {MOMENT_TABS.map((tab) => (
              <VibenTabsTrigger key={tab.key} value={tab.key} disabled={tab.feedType === "following" && !session}>
                {tab.key}
              </VibenTabsTrigger>
            ))}
          </VibenTabsList>
          {MOMENT_TABS.map((tab) => (
            <VibenTabsContent key={tab.key} value={tab.key} className="mt-2">
              {tabFeeds[tab.key]?.length === 0 ? (
                tab.feedType === "following" ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    <T tKey="community.followMoreAuthorsToSeeMoments" fallback="关注更多作者以查看动态" />
                  </p>
                ) : (
                  <EmptyState tKey="community.noMoments" fallback="暂无动态" />
                )
              ) : (
                <div className="grid gap-2">
                  {tabFeeds[tab.key]?.map((feed, i) => (
                    <FeedCard key={i} data={feed} variant="rich" />
                  ))}
                </div>
              )}
            </VibenTabsContent>
          ))}
        </VibenTabs>
      </div>
      <aside className="grid gap-2 content-start">
        <SectionHead title={<T tKey="community.worthFollowing" fallback="值得关注" />} />
        {authorCards.map((author, i) => (
          <AuthorCard key={i} data={author} currentUserSlug={session?.userSlug} />
        ))}
      </aside>
    </div>
  )
}
