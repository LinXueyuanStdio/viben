import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth/cookies"
import { db, publishedPages, users, moments, collections } from "@/lib/db"
import { eq, desc, and, count } from "drizzle-orm"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getSession()
  if (!session?.userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let user
  try {
    user = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
    })
  } catch {
    return NextResponse.json({ error: "failed_to_fetch_user" }, { status: 500 })
  }

  if (!user) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 })
  }

  try {
    const [authorPages, authorMoments, userCollections] = await Promise.all([
      db.select().from(publishedPages)
        .where(and(
          eq(publishedPages.userId, user.id),
          eq(publishedPages.visibility, "public"),
          eq(publishedPages.moderationStatus, "approved")
        ))
        .orderBy(desc(publishedPages.lastPublishedAt))
        .limit(20),
      db.select().from(moments)
        .where(and(
          eq(moments.authorUserId, user.id),
          eq(moments.visibility, "public"),
          eq(moments.isDeleted, false)
        ))
        .orderBy(desc(moments.createdAt))
        .limit(10),
      db.select().from(collections)
        .where(eq(collections.ownerId, user.id))
        .orderBy(desc(collections.updatedAt))
        .limit(10),
    ])

    return NextResponse.json({
      user: {
        displayName: user.displayName,
        userSlug: user.userSlug,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        followersCount: user.followersCount,
      },
      pages: authorPages,
      moments: authorMoments,
      collections: userCollections,
    })
  } catch (error) {
    console.error("[API /profile] Failed to fetch profile data:", error)
    return NextResponse.json({ error: "failed_to_fetch_data" }, { status: 500 })
  }
}
