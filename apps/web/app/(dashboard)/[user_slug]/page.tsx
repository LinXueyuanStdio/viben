import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { PageCard } from "@/components/content/page-card"
import { FeedCard } from "@/components/content/feed-card"
import { ProfileTabs } from "@/components/profile/profile-tabs"
import { ActivityHeatmapLoader } from "@/components/profile/activity-heatmap-loader"
import { SectionHead } from "@/components/content/section-head"
import { db, users, moments, momentAttachments, userFollows, bookmarks, publishedPages, mcpPackages, skillPackages } from "@/lib/db"
import { count, desc, eq, and, inArray } from "drizzle-orm"
import { getSession } from "@/lib/auth/cookies"
import { notFound } from "next/navigation"
import { getCachedProfileData } from "@/lib/services/community"
import type { CachedProfileData } from "@/lib/services/community"
import { EmptyState, T } from "@/components/content/i18n-text"
import { FollowButton } from "@/components/content/follow-button"
import Link from "next/link"
import { Settings } from "lucide-react"
import type { PageCardData } from "@/components/content/page-card"
import type { FeedCardData } from "@/components/content/feed-card"
import type { Metadata } from "next"
import { mapMomentRowToFeedCard, timeAgo, type MomentAttachmentData } from "@/lib/services/moment-mapper"
import { ProfilePagesList } from "@/components/profile/profile-pages-list"
import { ProfileMcpList } from "@/components/profile/profile-mcp-list"
import { ProfileSkillsList } from "@/components/profile/profile-skills-list"
import { ProfileLikesMerged } from "@/components/profile/profile-likes-merged"
import { ProfilePinnedSection } from "@/components/profile/profile-pinned-section"
import { ProfileMomentsInfinite } from "@/components/profile/profile-moments-infinite"
import type { ProfileContentItemData } from "@/components/profile/profile-content-item"

/** Minimal shared shape between full publishedPages row and joined query results */
interface PageRow {
  id?: string
  uid: string
  title: string
  description: string | null
  coverUrl: string | null
  lastPublishedAt: Date | string | null
  viewCount: number
  likeCount: number
  commentCount: number
  bookmarkCount: number
  authorDisplayName: string | null
  authorAvatarUrl: string | null
  authorSlug: string
  visibility?: string | null
}

/** Convert a visibility value to a human-readable label */
function visibilityToLabel(v?: string | null): string | undefined {
  if (!v || v === "public") return "公开"
  if (v === "private" || v === "unlisted") return "私有"
  return undefined
}

function mapPageToCard(
  p: PageRow,
  fallbackDisplayName: string,
  fallbackAvatarUrl: string | null | undefined,
): { card: PageCardData; href: string } {
  const authorDisplayName = p.authorDisplayName ?? fallbackDisplayName ?? p.authorSlug
  return {
    card: {
      coverUrl: p.coverUrl,
      title: p.title,
      description: p.description ?? undefined,
      author: {
        name: authorDisplayName,
        avatarUrl: p.authorAvatarUrl ?? fallbackAvatarUrl ?? undefined,
      },
      timeAgo: timeAgo(p.lastPublishedAt),
      stats: {
        views: p.viewCount,
        likes: p.likeCount,
        comments: p.commentCount,
        bookmarks: p.bookmarkCount,
      },
    } satisfies PageCardData,
    href: `/${encodeURIComponent(p.authorSlug)}/${encodeURIComponent(p.uid)}?tab=read`,
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ user_slug: string }>
}): Promise<Metadata> {
  const { user_slug: slug } = await params
  const user = await db.query.users.findFirst({
    where: eq(users.userSlug, slug),
    columns: {
      displayName: true,
      userSlug: true,
      bio: true,
      avatarUrl: true,
    },
  })

  if (!user) return { title: "未找到" }

  const displayName = user.displayName ?? user.userSlug
  const description = user.bio ?? `${displayName} 在 Viben 上的个人主页`

  return {
    title: `${displayName} (@${user.userSlug})`,
    description,
    openGraph: {
      title: `${displayName} (@${user.userSlug})`,
      description,
      type: "profile" as const,
      ...(user.avatarUrl
        ? { images: [{ url: user.avatarUrl, width: 256, height: 256 }] }
        : {}),
    },
    twitter: {
      card: "summary" as const,
      title: `${displayName} (@${user.userSlug})`,
      description,
      ...(user.avatarUrl ? { images: [user.avatarUrl] } : {}),
    },
  }
}

export default async function UserSlugPage({
  params,
  searchParams,
}: {
  params: Promise<{ user_slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { user_slug: slug } = await params
  const sp = await searchParams
  const session = await getSession()

  // Visibility filters from search params
  const pagesVisibility = typeof sp.visibility === "string" ? sp.visibility : "all"
  const mcpVisibility = typeof sp.mcp_visibility === "string" ? sp.mcp_visibility : "all"
  const skillVisibility = typeof sp.skill_visibility === "string" ? sp.skill_visibility : "all"

  // 缓存命中：用户信息 + 公开页面/合集/MCP/Skill/置顶数据
  const cached = await getCachedProfileData(slug)
  if (!cached) notFound()

  const { user } = cached
  const isOwnProfile = session?.userId === user.id
  const displayName = user.displayName ?? "?"
  const avatarUrl = user.avatarUrl

  // Session 相关数据保持实时查询
  let isFollowing = false
  let followingCount = 0
  let bookmarkedMcpsRaw: Array<{ entityId: string; createdAt: Date }> = []
  let bookmarkedSkillsRaw: Array<{ entityId: string; createdAt: Date }> = []

  const [
    followResult,
    followingCountResult,
    authorMoments,
    bookmarkedMcps,
    bookmarkedSkills,
    initialMomentsCursorRow,
  ] = await Promise.all([
    session && !isOwnProfile
      ? db.query.userFollows.findFirst({
          where: and(
            eq(userFollows.followerUserId, session.userId),
            eq(userFollows.followeeUserId, user.id),
          ),
        })
      : Promise.resolve(null),
    db.select({ count: count() }).from(userFollows)
      .where(eq(userFollows.followerUserId, user.id)),
    db.select().from(moments)
      .where(and(
        eq(moments.authorUserId, user.id),
        eq(moments.visibility, "public"),
        eq(moments.isDeleted, false),
      ))
      .orderBy(desc(moments.createdAt))
      .limit(10),
    db.select({ entityId: bookmarks.entityId, createdAt: bookmarks.createdAt }).from(bookmarks)
      .where(and(eq(bookmarks.userId, user.id), eq(bookmarks.entityType, "mcp")))
      .orderBy(desc(bookmarks.createdAt)).limit(50),
    db.select({ entityId: bookmarks.entityId, createdAt: bookmarks.createdAt }).from(bookmarks)
      .where(and(eq(bookmarks.userId, user.id), eq(bookmarks.entityType, "skill")))
      .orderBy(desc(bookmarks.createdAt)).limit(50),
    db.select({ createdAt: moments.createdAt }).from(moments)
      .where(and(
        eq(moments.authorUserId, user.id),
        eq(moments.visibility, "public"),
        eq(moments.isDeleted, false),
      ))
      .orderBy(desc(moments.createdAt))
      .limit(11),
  ])

  isFollowing = !!followResult
  followingCount = followingCountResult[0]?.count ?? 0
  bookmarkedMcpsRaw = bookmarkedMcps
  bookmarkedSkillsRaw = bookmarkedSkills

  // 从缓存解构数据
  const {
    authorPages,
    pageCount: pageCountValue,
    createdCollections,
    likedPageRows,
    bookmarkedPageRows,
    pinnedPageRows,
    profileReadmePage: readmePageArr,
    authorMcps,
    authorSkills,
    mcpCount: mcpCountValue,
    skillCount: skillCountValue,
    pinnedRows,
  } = cached
  const pageCount = pageCountValue
  const mcpTotal = mcpCountValue
  const skillTotal = skillCountValue
  const readmePage = readmePageArr

  // Fetch attachments for author moments (for cover images)
  let attachmentsMap = new Map<string, MomentAttachmentData[]>()
  if (authorMoments.length > 0) {
    const momentIds = authorMoments.map((m) => m.id)
    const attachmentRows = await db.select({
      momentId: momentAttachments.momentId,
      coverUrl: momentAttachments.coverUrlSnapshot,
      title: momentAttachments.titleSnapshot,
      authorName: momentAttachments.authorNameSnapshot,
      viewCount: momentAttachments.viewCountSnapshot,
      commentCount: momentAttachments.commentCountSnapshot,
    })
      .from(momentAttachments)
      .where(inArray(momentAttachments.momentId, momentIds))
      .orderBy(momentAttachments.sortOrder)

    for (const a of attachmentRows) {
      const list = attachmentsMap.get(a.momentId) ?? []
      list.push({
        cover_url: a.coverUrl,
        title: a.title,
        author_name: a.authorName,
        view_count: a.viewCount,
        comment_count: a.commentCount,
      })
      attachmentsMap.set(a.momentId, list)
    }
  }

  // Fetch full MCP/Skill package details for bookmarked items
  let bookmarkedMcpData: Array<{
    id: string; type: "mcp"; name: string; slug: string; version: string;
    description: string | null; transport?: string;
    author: { username: string; avatarUrl: string | null } | null;
    favoritedAt: Date;
  }> = []
  let bookmarkedSkillData: Array<{
    id: string; type: "skill"; name: string; slug: string; version: string;
    description: string | null; skillType?: string;
    author: { username: string; avatarUrl: string | null } | null;
    favoritedAt: Date;
  }> = []

  if (bookmarkedMcpsRaw.length > 0) {
    const mcpIds = bookmarkedMcpsRaw.map((b) => b.entityId)
    const mcpDetails = await db.query.mcpPackages.findMany({
      where: inArray(mcpPackages.id, mcpIds),
      with: { author: { columns: { username: true, userSlug: true, avatarUrl: true } } },
    })
    const mcpMap = new Map(mcpDetails.map((m) => [m.id, m]))
    // Preserve bookmark order
    for (const bm of bookmarkedMcpsRaw) {
      const pkg = mcpMap.get(bm.entityId)
      if (pkg) {
        bookmarkedMcpData.push({
          id: pkg.id, type: "mcp", name: pkg.name, slug: pkg.slug,
          version: pkg.version, description: pkg.description,
          transport: pkg.transport ?? undefined,
          author: pkg.author,
          favoritedAt: bm.createdAt,
        })
      }
    }
  }

  if (bookmarkedSkillsRaw.length > 0) {
    const skillIds = bookmarkedSkillsRaw.map((b) => b.entityId)
    const skillDetails = await db.query.skillPackages.findMany({
      where: inArray(skillPackages.id, skillIds),
      with: { author: { columns: { username: true, userSlug: true, avatarUrl: true } } },
    })
    const skillMap = new Map(skillDetails.map((s) => [s.id, s]))
    for (const bs of bookmarkedSkillsRaw) {
      const pkg = skillMap.get(bs.entityId)
      if (pkg) {
        bookmarkedSkillData.push({
          id: pkg.id, type: "skill", name: pkg.name, slug: pkg.slug,
          version: pkg.version, description: pkg.description,
          skillType: pkg.skillType ?? undefined,
          author: pkg.author,
          favoritedAt: bs.createdAt,
        })
      }
    }
  }

  const pageCards = authorPages.map((p) => mapPageToCard(p, displayName, avatarUrl))
  const pinnedCards = pinnedPageRows.map((p) => mapPageToCard(p, displayName, avatarUrl))

  // Pinned items 详情查询 (动态数据，不缓存)
  const pageColumns = {
    id: publishedPages.id, uid: publishedPages.uid, title: publishedPages.title,
    description: publishedPages.description, coverUrl: publishedPages.coverUrl,
    lastPublishedAt: publishedPages.lastPublishedAt, viewCount: publishedPages.viewCount,
    likeCount: publishedPages.likeCount, commentCount: publishedPages.commentCount,
    bookmarkCount: publishedPages.bookmarkCount, authorDisplayName: publishedPages.authorDisplayName,
    authorAvatarUrl: publishedPages.authorAvatarUrl, authorSlug: publishedPages.authorSlug,
    visibility: publishedPages.visibility,
  }

  // Map pages to ProfileContentItemData for new list components
  function mapPageToContentItem(p: PageRow, fallbackName: string, fallbackAvatar: string | null | undefined): ProfileContentItemData & { pageUid: string } {
    const authorDisplayName = p.authorDisplayName ?? fallbackName ?? p.authorSlug
    return {
      coverUrl: p.coverUrl,
      title: p.title,
      description: p.description ?? undefined,
      author: {
        name: authorDisplayName,
        avatarUrl: p.authorAvatarUrl ?? fallbackAvatar ?? undefined,
      },
      timeAgo: timeAgo(p.lastPublishedAt),
      stats: { views: p.viewCount, likes: p.likeCount, comments: p.commentCount },
      visibilityLabel: visibilityToLabel(p.visibility),
      pageUid: p.uid,
    }
  }

  const pageContentItems = authorPages.map((p) => mapPageToContentItem(p, displayName, avatarUrl))
  const likedContentItems = likedPageRows.map((p) => mapPageToContentItem(p, displayName, avatarUrl))
  const bookmarkedContentItems = bookmarkedPageRows.map((p) => mapPageToContentItem(p, displayName, avatarUrl))

  // Map MCP/Skill packages to ProfileContentItemData
  const mcpContentItems = authorMcps.map((m) => ({
    coverUrl: null as string | null,
    title: m.name,
    description: m.description ?? undefined,
    author: { name: displayName, avatarUrl: avatarUrl ?? undefined },
    timeAgo: timeAgo(m.createdAt),
    stats: { downloads: m.downloadsCount },
    badges: [`v${m.version}`, m.transport?.toUpperCase()].filter(Boolean),
    visibilityLabel: visibilityToLabel(m.visibility),
    id: m.id,
  }))

  const skillContentItems = authorSkills.map((s) => ({
    coverUrl: null as string | null,
    title: s.name,
    description: s.description ?? undefined,
    author: { name: displayName, avatarUrl: avatarUrl ?? undefined },
    timeAgo: timeAgo(s.createdAt),
    stats: { downloads: s.downloadsCount },
    badges: [`v${s.version}`, s.skillType].filter(Boolean),
    visibilityLabel: visibilityToLabel(s.visibility),
    id: s.id,
  }))

  const feedCards: FeedCardData[] = authorMoments.map((m) =>
    mapMomentRowToFeedCard(m, {
      displayName: user.displayName,
      userSlug: user.userSlug,
      avatarUrl: user.avatarUrl,
    }, {
      attachments: attachmentsMap.get(m.id),
    }),
  )

  // Build pinned items with full entity data
  const pinnedItems: Array<{
    id: string; entity_type: "page" | "mcp" | "skill"; entity_id: string; position: number;
    data: ProfileContentItemData & { pageUid?: string }
  }> = []

  if (pinnedRows.length > 0) {
    const pageIds = pinnedRows.filter((p) => p.entityType === "page").map((p) => p.entityId)
    const mcpIds = pinnedRows.filter((p) => p.entityType === "mcp").map((p) => p.entityId)
    const skillIds = pinnedRows.filter((p) => p.entityType === "skill").map((p) => p.entityId)

    // Fetch page details
    const pageDetails = pageIds.length > 0
      ? await db.select(pageColumns).from(publishedPages)
          .where(and(inArray(publishedPages.id, pageIds), eq(publishedPages.moderationStatus, "approved")))
      : []
    const pageMap = new Map(pageDetails.map((p) => [p.id, p]))

    // Fetch MCP details
    const mcpDetails = mcpIds.length > 0
      ? await db.select().from(mcpPackages).where(inArray(mcpPackages.id, mcpIds))
      : []
    const mcpMap = new Map(mcpDetails.map((m) => [m.id, m]))

    // Fetch Skill details
    const skillDetails = skillIds.length > 0
      ? await db.select().from(skillPackages).where(inArray(skillPackages.id, skillIds))
      : []
    const skillMap = new Map(skillDetails.map((s) => [s.id, s]))

    for (const pin of pinnedRows) {
      if (pin.entityType === "page") {
        const p = pageMap.get(pin.entityId)
        if (p) {
          pinnedItems.push({
            id: pin.id, entity_type: "page", entity_id: pin.entityId, position: pin.position,
            data: { ...mapPageToContentItem(p, displayName, avatarUrl), pageUid: p.uid },
          })
        }
      } else if (pin.entityType === "mcp") {
        const m = mcpMap.get(pin.entityId)
        if (m) {
          pinnedItems.push({
            id: pin.id, entity_type: "mcp", entity_id: pin.entityId, position: pin.position,
            data: {
              coverUrl: null, title: m.name, description: m.description ?? undefined,
              author: { name: displayName, avatarUrl: avatarUrl ?? undefined },
              timeAgo: timeAgo(m.createdAt),
              stats: { downloads: m.downloadsCount },
              badges: [`v${m.version}`, m.transport?.toUpperCase()].filter(Boolean),
              visibilityLabel: visibilityToLabel(m.visibility),
            },
          })
        }
      } else if (pin.entityType === "skill") {
        const s = skillMap.get(pin.entityId)
        if (s) {
          pinnedItems.push({
            id: pin.id, entity_type: "skill", entity_id: pin.entityId, position: pin.position,
            data: {
              coverUrl: null, title: s.name, description: s.description ?? undefined,
              author: { name: displayName, avatarUrl: avatarUrl ?? undefined },
              timeAgo: timeAgo(s.createdAt),
              stats: { downloads: s.downloadsCount },
              badges: [`v${s.version}`, s.skillType].filter(Boolean),
              visibilityLabel: visibilityToLabel(s.visibility),
            },
          })
        }
      }
    }
  }

  // Initial moments cursor
  const initialMomentsHasMore = initialMomentsCursorRow.length > 10
  const initialMomentsCursor = initialMomentsHasMore
    ? initialMomentsCursorRow[9]?.createdAt.toISOString() ?? null
    : null

  const collectionListData = createdCollections.map((c) => ({
    id: c.id,
    name: c.name,
    itemCount: c.itemCount,
  }))

  const pageTotal = pageCount

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
        {/* Left sidebar — shared across all tabs */}
        <div className="space-y-3 px-3">
              {/* Avatar + identity */}
              <div className="flex flex-col items-center gap-2">
                {avatarUrl && (
                  <Avatar className="w-full h-auto aspect-square rounded-full">
                    <AvatarImage src={avatarUrl} alt={displayName} />
                    <AvatarFallback className="text-3xl font-semibold text-muted-foreground">
                      {displayName[0] ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className="text-center">
                  <h1 className="text-2xl font-bold tracking-tight leading-tight">
                    {user.displayName}
                  </h1>
                  <p className="text-[15px] text-muted-foreground font-light">
                    @{user.userSlug}
                  </p>
                </div>
              </div>

              {/* Bio */}
              {user.bio ? (
                <p className="text-sm text-muted-foreground leading-relaxed">{user.bio}</p>
              ) : isOwnProfile ? (
                <p className="text-sm text-muted-foreground/60 italic leading-relaxed">
                  <T tKey="profile.addBio" fallback="添加简介，向大家介绍自己…" />
                </p>
              ) : null}

              {/* Website */}
              {user.websiteUrl && (
                <a
                  href={user.websiteUrl.startsWith("http") ? user.websiteUrl : `https://${user.websiteUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 w-fit text-[13px] text-muted-foreground hover:text-foreground transition-colors font-medium"
                >
                  <svg className="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                  {user.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                </a>
              )}

              {/* Stats */}
              <div className="flex items-center gap-3">
                <Link href={`/${encodeURIComponent(user.userSlug)}/followers`} className="flex items-baseline gap-1 hover:underline">
                  <span className="text-base font-bold tabular-nums">{user.followersCount}</span>
                  <span className="text-[13px] text-muted-foreground">关注者</span>
                </Link>
                <span className="text-muted-foreground/30">·</span>
                <Link href={`/${encodeURIComponent(user.userSlug)}/following`} className="flex items-baseline gap-1 hover:underline">
                  <span className="text-base font-bold tabular-nums">{followingCountResult[0]?.count ?? 0}</span>
                  <span className="text-[13px] text-muted-foreground">正在关注</span>
                </Link>
                <span className="text-muted-foreground/30">·</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-base font-bold tabular-nums">{pageCount}</span>
                  <span className="text-[13px] text-muted-foreground">页面</span>
                </div>
              </div>

              {/* Follow button (shown when viewing someone else's profile) */}
              {!isOwnProfile && session && (
                <FollowButton
                  userSlug={user.userSlug}
                  currentUserSlug={session.userSlug}
                  initialFollowing={isFollowing}
                  className="w-full"
                />
              )}

              {/* Edit profile */}
              {isOwnProfile && (
                <Link
                  href="/settings"
                  className="inline-flex items-center justify-center w-full gap-1.5 rounded-lg border border-border/60 bg-card px-4 py-2 text-[13px] font-medium text-muted-foreground hover:bg-surface-secondary hover:text-foreground hover:border-border transition-all"
                >
                  <Settings className="size-3.5" />
                  <T tKey="profile.editProfile" fallback="编辑资料" />
                </Link>
              )}
        </div>

        {/* Right area — tabs */}
        <div className="min-w-0">
          <ProfileTabs
            overview={
              <div className="space-y-4 min-w-0">
                {/* Profile README */}
              {readmePage && (
                <section>
                  <iframe
                    title="Profile README"
                    srcDoc={readmePage.html}
                    sandbox="allow-scripts allow-same-origin"
                    className="w-full border-0"
                    style={{ height: Math.min(500, (readmePage.html.length / 50) + 100) + 'px' }}
                  />
                </section>
              )}

              {/* Pinned items (unified: pages + MCP + skills) */}
              <ProfilePinnedSection
                pinnedItems={pinnedItems}
                isOwnProfile={isOwnProfile}
                userSlug={user.userSlug}
              />

              {/* Activity heatmap (lazy-loaded) */}
              <section>
                <SectionHead title="活动" />
                <ActivityHeatmapLoader userSlug={user.userSlug} />
              </section>

              {/* Recent moments (infinite scroll) */}
              <ProfileMomentsInfinite
                userSlug={user.userSlug}
                displayName={user.displayName}
                avatarUrl={user.avatarUrl}
                initialMoments={authorMoments.slice(0, 10)}
                initialAttachments={attachmentsMap}
                initialCursor={initialMomentsCursor}
                session={session ? { username: session.username, userSlug: session.userSlug, avatarUrl: session.avatarUrl } : null}
              />

              {!readmePage && pinnedItems.length === 0 && feedCards.length === 0 && (
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                  <p>暂无内容</p>
                </div>
              )}
              </div>
            }
            pages={
          <ProfilePagesList
            pages={pageContentItems}
            total={pageTotal}
            userSlug={user.userSlug}
          />
        }
        likes={
          <ProfileLikesMerged
            likedPages={likedContentItems}
            bookmarkedPages={bookmarkedContentItems}
            bookmarkedMcps={bookmarkedMcpData}
            bookmarkedSkills={bookmarkedSkillData}
            collections={collectionListData}
            userSlug={user.userSlug}
            isOwnProfile={isOwnProfile}
          />
        }
        mcp={
          <ProfileMcpList
            mcps={mcpContentItems}
            total={mcpTotal}
          />
        }
        skills={
          <ProfileSkillsList
            skills={skillContentItems}
            total={skillTotal}
          />
        }
        pageCount={pageTotal}
        likeCount={likedContentItems.length}
        mcpCount={mcpTotal}
        skillCount={skillTotal}
      />
        </div>
      </div>
    </div>
  )
}
