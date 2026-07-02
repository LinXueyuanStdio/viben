import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { db, moments, momentAttachments } from '@/lib/db'
import { requireAuth, AuthError } from '@/lib/auth/middleware'
import { and, eq, sql } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request)
    const body = await request.json()
    const { moment_id } = body

    if (typeof moment_id !== 'string' || !moment_id.trim()) {
      return NextResponse.json({ error: 'moment_id is required' }, { status: 400 })
    }

    // Find the original moment
    const original = await db.query.moments.findFirst({
      where: and(eq(moments.id, moment_id), eq(moments.isDeleted, false)),
    })
    if (!original) {
      return NextResponse.json({ error: 'Moment not found' }, { status: 404 })
    }

    // Don't allow reposting your own moment
    if (original.authorUserId === session.userId) {
      return NextResponse.json({ error: 'Cannot repost your own moment' }, { status: 400 })
    }

    // Create repost moment
    const repostId = crypto.randomUUID()
    const [repost] = await db.insert(moments).values({
      id: repostId,
      uid: crypto.randomUUID().slice(0, 12),
      authorUserId: session.userId,
      kind: 'repost',
      body: null,
      visibility: 'public',
      repostOfMomentId: original.id,
    }).returning()

    // Create attachment referencing the original moment
    await db.insert(momentAttachments).values({
      momentId: repost.id,
      attachmentType: 'published_page' as never,
      attachmentId: original.id,
      titleSnapshot: original.body?.slice(0, 200) ?? '',
      authorNameSnapshot: '',
      sortOrder: 0,
    })

    // Increment repost count on original
    await db.update(moments)
      .set({ repostCount: sql`${moments.repostCount} + 1` })
      .where(eq(moments.id, original.id))

    return NextResponse.json({ success: true, moment_id: repost.id })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[repost] Error:', error)
    return NextResponse.json({ error: 'Failed to repost' }, { status: 500 })
  }
}
