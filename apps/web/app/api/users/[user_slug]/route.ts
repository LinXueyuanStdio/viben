import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db, users, mcpPackages, skillPackages } from '@/lib/db';
import { eq, count } from 'drizzle-orm';

/**
 * 获取用户公开资料
 * @description 根据 user_slug 获取用户的公开信息，包括用户名、显示名称、头像、简介、网站、GitHub 用户名、角色、注册时间，以及 stats 对象（含 mcpPackages 和 skillPackages 发布数量统计）。公开接口，无需登录。
 * @pathParams UserSlugParams
 * @response 200:UserProfileResponse:用户公开资料及包数量统计
 * @response 404:ErrorResponse:指定 user_slug 的用户不存在
 * @response 500:ErrorResponse:查询失败
 * @tag Users
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ user_slug: string }> }
) {
  try {
    const { user_slug } = await params;

    const user = await db.query.users.findFirst({
      where: eq(users.userSlug, user_slug),
      columns: {
        id: true,
        username: true,
        userSlug: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        websiteUrl: true,
        githubUsername: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get package counts
    const [mcpCount] = await db
      .select({ count: count() })
      .from(mcpPackages)
      .where(eq(mcpPackages.authorId, user.id));

    const [skillCount] = await db
      .select({ count: count() })
      .from(skillPackages)
      .where(eq(skillPackages.authorId, user.id));

    return NextResponse.json({
      user: {
        ...user,
        stats: {
          mcpPackages: mcpCount?.count ?? 0,
          skillPackages: skillCount?.count ?? 0,
        },
      },
    });
  } catch (error) {
    console.error('Get public profile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
