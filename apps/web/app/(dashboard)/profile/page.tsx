import { Suspense } from "react"
import { ProfileHero } from "@/components/content/profile-hero"
import { ProfilePages } from "@/components/profile/profile-pages-section"
import { ProfileMoments } from "@/components/profile/profile-moments-section"
import { ProfileCollections } from "@/components/profile/profile-collections-section"
import { VibenTabs, VibenTabsList, VibenTabsTrigger, VibenTabsContent } from "@/components/ui/viben-tabs"
import { SectionHead } from "@/components/content/section-head"
import { db, publishedPages, users } from "@/lib/db"
import { eq, and, count } from "drizzle-orm"
import { getSession } from "@/lib/auth/cookies"
import { CardsSkeleton, FeedSkeleton } from "@/components/shared/skeletons"
import { EmptyState, T } from "@/components/content/i18n-text"
import Link from "next/link"
import { LogIn } from "lucide-react"
import type { ProfileHeroData } from "@/components/content/profile-hero"

export const dynamic = "force-dynamic"

const PROFILE_TABS = ["页面", "动态", "合集", "关于"]

export default async function ProfilePage() {
  const session = await getSession()

  // 未登录时展示友好提示（不执行 redirect，避免 session 丢失体验）
  if (!session?.userId) {
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

  let user
  try {
    user = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
    })
  } catch {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <EmptyState tKey="common.error" fallback="加载失败，请稍后重试" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <EmptyState tKey="common.error" fallback="用户数据未找到" />
      </div>
    )
  }

  // 页面计数用于 Hero stats（轻量查询，直接获取）
  let pageCount = 0
  try {
    const result = await db.select({ count: count() }).from(publishedPages)
      .where(and(
        eq(publishedPages.userId, user.id),
        eq(publishedPages.visibility, "public"),
        eq(publishedPages.moderationStatus, "approved")
      ))
    pageCount = result[0]?.count ?? 0
  } catch (error) {
    console.error("[Profile] Failed to fetch page count:", error)
  }

  const profile: ProfileHeroData = {
    fallbackText: user.displayName?.[0] ?? "?",
    avatarUrl: user.avatarUrl ?? undefined,
    name: user.displayName,
    handle: `@${user.userSlug}`,
    userSlug: user.userSlug,
    tagline: user.bio ?? "",
    stats: {
      followers: user.followersCount,
      pages: pageCount,
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
          <Suspense fallback={<CardsSkeleton count={6} />}>
            <ProfilePages
              userId={user.id}
              userSlug={user.userSlug}
              displayName={user.displayName}
              avatarUrl={user.avatarUrl}
            />
          </Suspense>
        </VibenTabsContent>

        <VibenTabsContent value="动态" className="mt-3">
          <Suspense fallback={<FeedSkeleton count={3} />}>
            <ProfileMoments
              userId={user.id}
              userSlug={user.userSlug}
              displayName={user.displayName}
              avatarUrl={user.avatarUrl}
            />
          </Suspense>
        </VibenTabsContent>

        <VibenTabsContent value="合集" className="mt-3">
          <SectionHead title="创建的合集" />
          <Suspense fallback={<CardsSkeleton count={3} />}>
            <ProfileCollections
              userId={user.id}
              username={user.username}
              userSlug={user.userSlug}
              displayName={user.displayName}
              avatarUrl={user.avatarUrl}
            />
          </Suspense>
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
