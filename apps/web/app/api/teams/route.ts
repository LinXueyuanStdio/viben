import { NextResponse } from 'next/server';
import { db, users, teamMembers } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { eq } from 'drizzle-orm';

/**
 * 获取当前用户所属的团队列表
 * @summary 获取团队列表
 * @description 返回当前登录用户所属的所有团队，包含团队基本信息及用户在各团队中的角色。
 * @response 200:{ teams: Array<{ teamId, teamSlug, teamName, teamAvatarUrl, role, joinedAt }> }:团队列表
 * @response 401:ErrorResponse:未登录
 * @tag Teams
 */
export async function GET() {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const memberships = await db
    .select({
      teamId: teamMembers.teamId,
      teamSlug: users.userSlug,
      teamName: users.displayName,
      teamAvatarUrl: users.avatarUrl,
      role: teamMembers.role,
      joinedAt: teamMembers.joinedAt,
    })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.teamId, users.id))
    .where(eq(teamMembers.userId, session.userId))
    .orderBy(teamMembers.joinedAt);

  return NextResponse.json({ teams: memberships });
}

/**
 * 创建新团队
 * @summary 创建团队
 * @description 创建新团队，自动将创建者设为 owner。slug 必须全局唯一。
 * @body { name: string, slug: string }
 * @response 200:{ success: true, team_slug: string, team_id: string }:创建成功
 * @response 400:ErrorResponse:缺少 name 或 slug
 * @response 401:ErrorResponse:未登录
 * @response 409:ErrorResponse:slug 已被占用
 * @tag Teams
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { name, slug } = body;

  if (!name || !slug) {
    return NextResponse.json({ error: 'name and slug are required' }, { status: 400 });
  }

  // 校验 slug 唯一性
  const existing = await db.query.users.findFirst({
    where: eq(users.userSlug, slug),
    columns: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: `The name '${slug}' is already taken.` },
      { status: 409 }
    );
  }

  const teamId = crypto.randomUUID();

  // 创建 team user 记录
  await db.insert(users).values({
    id: teamId,
    email: session.email,
    username: slug,
    userSlug: slug,
    displayName: name,
    type: 'team',
    role: 'user',
    emailVerified: true,
  });

  // 加创建者为 owner
  await db.insert(teamMembers).values({
    teamId,
    userId: session.userId,
    role: 'owner',
  });

  return NextResponse.json({
    success: true,
    team_slug: slug,
    team_id: teamId,
  });
}
