import { Composer } from "@/components/content/composer"
import { FeedList } from "@/components/content/feed-list"
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
import type { Metadata } from "next"
import { mapRichMomentToFeedCard } from "@/lib/services/moment-mapper"

export const metadata: Metadata = {
  title: "动态 - Viben",
  description: "发现来自 Viben 社区的创作、动态与分享。",
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/moment`,
  },
  openGraph: {
    title: "动态 - Viben",
    description: "发现来自 Viben 社区的创作、动态与分享。",
    url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/moment`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "动态 - Viben",
    description: "发现来自 Viben 社区的创作、动态与分享。",
  },
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
      ? db.select({ id: users.id, userSlug: users.userSlug, displayName: users.displayName, avatarUrl: users.avatarUrl, bio: users.bio, pageCount: users.pageCount, followersCount: users.followersCount }).from(users).where(ne(users.id, session.userId)).orderBy(desc(users.followersCount)).limit(5)
      : db.select({ id: users.id, userSlug: users.userSlug, displayName: users.displayName, avatarUrl: users.avatarUrl, bio: users.bio, pageCount: users.pageCount, followersCount: users.followersCount }).from(users).orderBy(desc(users.followersCount)).limit(5),
  ])

  const tabFeeds: Record<string, FeedCardData[]> = {
    "最新": latestResult.items.map((item) => mapRichMomentToFeedCard(item)),
    "关注": followingResult ? followingResult.items.map((item) => mapRichMomentToFeedCard(item)) : [],
    "推荐": recommendedResult.items.map((item) => mapRichMomentToFeedCard(item)),
  }

  const tabPagination: Record<string, { hasMore: boolean; cursor: string | null }> = {
    "最新": { hasMore: latestResult.has_more ?? false, cursor: latestResult.next_cursor },
    "关注": followingResult ? { hasMore: followingResult.has_more ?? false, cursor: followingResult.next_cursor } : { hasMore: false, cursor: null },
    "推荐": { hasMore: recommendedResult.has_more ?? false, cursor: recommendedResult.next_cursor },
  }

  // Show "关注" tab only when user is logged in
  const visibleTabs = session
    ? MOMENT_TABS
    : MOMENT_TABS.filter((tab) => tab.feedType !== "following")

  const authorCards: AuthorCardData[] = topAuthors.map((u) => ({
    fallbackText: u.displayName ?? u.userSlug,
    avatarUrl: u.avatarUrl ?? undefined,
    name: u.displayName,
    handle: `@${u.userSlug}`,
    userSlug: u.userSlug,
    description: u.bio ?? "",
    pageCount: u.pageCount ?? 0,
    followerCount: u.followersCount,
  }))

  return (
    <>
      <div className="grid gap-[14px] grid-cols-1 md:grid-cols-[1fr_240px] lg:grid-cols-[1fr_280px] xl:grid-cols-[1fr_330px]">
      <div className="grid gap-3">
        <div className="rounded-[12px] border border-border bg-background shadow-sm p-2.5">
          <Composer userFallbackText={session?.username?.[0] ?? "你"} userAvatarUrl={session?.avatarUrl} />
        </div>
        <VibenTabs defaultValue="最新">
          <VibenTabsList>
            {visibleTabs.map((tab) => (
              <VibenTabsTrigger key={tab.key} value={tab.key} disabled={tab.feedType === "following" && !session}>
                {tab.key}
              </VibenTabsTrigger>
            ))}
          </VibenTabsList>
          {MOMENT_TABS.map((tab) => {
            const followingEmpty = (
              <p className="py-8 text-center text-sm text-muted-foreground">
                <T tKey="community.followMoreAuthorsToSeeMoments" fallback="关注更多作者以查看动态" />
              </p>
            )
            const defaultEmpty = <EmptyState tKey="community.noMoments" fallback="暂无动态" />
            return (
              <VibenTabsContent key={tab.key} value={tab.key} className="mt-2">
                <FeedList
                  initialItems={tabFeeds[tab.key] ?? []}
                  initialHasMore={tabPagination[tab.key]?.hasMore ?? false}
                  initialCursor={tabPagination[tab.key]?.cursor ?? null}
                  feedType={tab.feedType}
                  emptyMessage={tab.feedType === "following" ? followingEmpty : defaultEmpty}
                  session={session ? { username: session.username, userSlug: session.userSlug, avatarUrl: session.avatarUrl } : null}
                />
              </VibenTabsContent>
            )
          })}
        </VibenTabs>
      </div>
      <aside className="grid gap-2 content-start">
        <SectionHead title={<T tKey="community.worthFollowing" fallback="值得关注" />} />
        {authorCards.map((author, i) => (
          <AuthorCard key={i} data={author} currentUserSlug={session?.userSlug} />
        ))}
      </aside>
    </div>
    </>
  )
}
