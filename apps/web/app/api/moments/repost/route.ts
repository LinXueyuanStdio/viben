import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { db, moments, momentAttachments } from '@/lib/db'
import { requireAuth, AuthError } from '@/lib/auth/middleware'
import { and, eq, sql } from 'drizzle-orm'
import { MomentRepostBody } from '@/lib/validations/moments'

/**
 * 转发动态
 * @summary 转发动态到自己的时间线
 * @description 转发指定动态到自己的时间线，原动态转发数 +1。不能转发自己的动态（返回 400），原动态不存在或已删除返回 404。新动态类型为 repost（kind=repost），同时创建附件引用原动态。需登录
 * @body MomentRepostBody
 * @response 200:MomentRepostResponse:转发成功，返回 success 和新动态 ID
 * @response 400:ErrorResponse:moment_id 为空或转发自己的动态
 * @response 401:ErrorResponse:未登录
 * @response 404:ErrorResponse:原动态不存在或已删除
 * @responseSet auth
 * @auth bearer
 * @tag Moments
 */
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
