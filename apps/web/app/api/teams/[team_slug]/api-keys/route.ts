import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { db, apiKeys, users, teamMembers } from '@/lib/db'
import { requireAuth, AuthError } from '@/lib/auth/middleware'
import { CreateApiKeyBody } from '@/lib/validations/user'
import { generateId } from '@/lib/utils'
import { eq, and } from 'drizzle-orm'
import bcrypt from 'bcrypt'
import { ZodError } from 'zod'

async function requireTeamOwner(request: NextRequest, teamSlug: string) {
  const session = await requireAuth(request)
  const team = await db.query.users.findFirst({
    where: and(eq(users.userSlug, teamSlug), eq(users.type, 'team')),
    columns: { id: true },
  })
  if (!team) throw new AuthError('Team not found', 404)
  const membership = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, session.userId)),
    columns: { role: true },
  })
  if (!membership || membership.role !== 'owner') {
    throw new AuthError('Only team owners can manage API keys', 403)
  }
  return { session, teamId: team.id }
}

/**
 * 列出团队的 API Keys
 * @description 返回团队的所有 API Key 元信息（不含完整密钥）。需团队 Owner 权限。
 * @response 200:ApiKeysListResponse:API Key 元信息列表
 * @responseSet auth
 * @response 401:ErrorResponse:未登录
 * @response 403:ErrorResponse:非团队 Owner
 * @auth bearer
 * @tag Teams
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ team_slug: string }> }
) {
  try {
    const { team_slug } = await params
    const { teamId } = await requireTeamOwner(request, team_slug)

    const keys = await db.query.apiKeys.findMany({
      where: eq(apiKeys.userId, teamId),
      columns: {
        id: true, name: true, keyPrefix: true, scopes: true,
        expiresAt: true, lastUsedAt: true, createdAt: true,
      },
      orderBy: (apiKeys, { desc }) => [desc(apiKeys.createdAt)],
    })

    return NextResponse.json({ keys })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('List team API keys error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * 创建团队 API Key
 * @description 为团队生成一个新的 API Key（格式 bmcp_XXXXXXXX_YYYYYYYYYYYYYYYYYYYYYYYY）。完整密钥仅在创建时返回一次。需团队 Owner 权限。
 * @body CreateApiKeyBody
 * @response 201:ApiKeyCreateResponse:API Key 创建成功
 * @responseSet auth
 * @auth bearer
 * @tag Teams
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ team_slug: string }> }
) {
  try {
    const { team_slug } = await params
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
      throw new AuthError('Only team owners can create API keys', 403)
    }

    const body = await request.json()
    const { name, scopes, expiresIn } = CreateApiKeyBody.parse(body)

    const prefix = `bmcp_${generateId().slice(0, 8)}`
    const secret = generateId().replace(/-/g, '') + generateId().replace(/-/g, '')
    const fullKey = `${prefix}_${secret.slice(0, 24)}`
    const keyHash = await bcrypt.hash(fullKey, 12)
    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000)
      : null

    const keyId = generateId()
    const createdAt = new Date()
    await db.insert(apiKeys).values({
      id: keyId, userId: team.id, name,
      keyHash, keyPrefix: prefix, scopes, expiresAt, createdAt,
    })

    return NextResponse.json({
      key: fullKey,
      apiKey: {
        id: keyId, name, keyPrefix: prefix, scopes, expiresAt,
        lastUsedAt: null, createdAt: createdAt.toISOString(),
      },
      warning: 'Save this key now. You will not be able to see it again.',
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Create team API key error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
