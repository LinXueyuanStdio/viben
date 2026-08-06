import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { db, apiKeys, users, teamMembers } from '@/lib/db'
import { requireAuth, AuthError } from '@/lib/auth/middleware'
import { eq, and } from 'drizzle-orm'

/**
 * 删除团队 API Key
 * @description 撤销（删除）指定的团队 API Key。需团队 Owner 权限。
 * @response 200:SuccessResponse:删除成功
 * @responseSet auth
 * @response 401:ErrorResponse:未登录
 * @response 403:ErrorResponse:非团队 Owner
 * @response 404:ErrorResponse:API Key 不存在
 * @auth bearer
 * @tag Teams
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ team_slug: string; id: string }> }
) {
  try {
    const { team_slug, id } = await params
    const session = await requireAuth(request)

    const team = await db.query.users.findFirst({
      where: and(eq(users.userSlug, team_slug), eq(users.type, 'team')),
      columns: { id: true },
    })
    if (!team) throw new AuthError('Team not found', 404)

    const membership = await db.query.teamMembers.findFirst({
      where: and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, session.userId)),
      columns: { role: true },
    })
    if (!membership || membership.role !== 'owner') {
      throw new AuthError('Only team owners can revoke API keys', 403)
    }

    const key = await db.query.apiKeys.findFirst({
      where: and(eq(apiKeys.id, id), eq(apiKeys.userId, team.id)),
      columns: { id: true },
    })
    if (!key) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 })
    }

    await db.delete(apiKeys).where(and(eq(apiKeys.id, id), eq(apiKeys.userId, team.id)))

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Delete team API key error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
