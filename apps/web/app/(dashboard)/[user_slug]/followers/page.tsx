import { db, users, userFollows } from "@/lib/db"
import { eq, desc } from "drizzle-orm"
import { getSession } from "@/lib/auth/cookies"
import { notFound } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { FollowButton } from "@/components/content/follow-button"
import Link from "next/link"

interface PageProps {
  params: Promise<{ user_slug: string }>
}

export default async function FollowersPage({ params }: PageProps) {
  const { user_slug: slug } = await params
  const session = await getSession()

  const user = await db.query.users.findFirst({
    where: eq(users.userSlug, slug),
    columns: { id: true, userSlug: true, displayName: true },
  })
  if (!user) notFound()

  // Query this user's followers (limit 50)
  const followerRows = await db
    .select({
      follower: {
        id: users.id,
        userSlug: users.userSlug,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        bio: users.bio,
        followersCount: users.followersCount,
      },
    })
    .from(userFollows)
    .innerJoin(users, eq(users.id, userFollows.followerUserId))
    .where(eq(userFollows.followeeUserId, user.id))
    .orderBy(desc(userFollows.createdAt))
    .limit(50)

  // Check which followers the current user is also following
  let followingSet = new Set<string>()
  if (session) {
    const myFollows = await db.query.userFollows.findMany({
      where: eq(userFollows.followerUserId, session.userId),
      columns: { followeeUserId: true },
    })
    followingSet = new Set(myFollows.map((f) => f.followeeUserId))
  }

  const displayName = user.displayName ?? user.userSlug

  return (
    <div className="max-w-2xl mx-auto pt-2">
      <h1 className="text-xl font-bold mb-1">{displayName} 的粉丝</h1>
      <p className="text-sm text-muted-foreground mb-6">{followerRows.length} 位用户</p>

      {followerRows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">暂无粉丝</p>
      ) : (
        <div className="space-y-2">
          {followerRows.map(({ follower }) => (
            <div
              key={follower.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 transition-colors"
            >
              <Link href={`/${encodeURIComponent(follower.userSlug)}`}>
                <Avatar className="size-10 shrink-0">
                  <AvatarImage src={follower.avatarUrl ?? undefined} />
                  <AvatarFallback>{(follower.displayName ?? follower.userSlug)[0] ?? "?"}</AvatarFallback>
                </Avatar>
              </Link>
              <div className="flex-1 min-w-0">
                <Link
                  href={`/${encodeURIComponent(follower.userSlug)}`}
                  className="font-medium text-sm hover:underline"
                >
                  {follower.displayName ?? follower.userSlug}
                </Link>
                <p className="text-xs text-muted-foreground">@{follower.userSlug}</p>
                {follower.bio && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{follower.bio}</p>
                )}
              </div>
              <FollowButton
                userSlug={follower.userSlug}
                currentUserSlug={session?.userSlug}
                initialFollowing={followingSet.has(follower.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
