import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db, users } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/auth/middleware';
import { UpdateProfileBody } from '@/lib/validations/user';
import { hasGitHubRepoConnection } from '@/lib/github/repo-connection';
import { eq } from 'drizzle-orm';
import { ZodError } from 'zod';

/**
 * 获取当前用户资料
 * @description 返回已登录用户的完整资料信息，包括邮箱、用户名、显示名称、头像、简介、网站、GitHub 用户名、角色、邮箱验证状态及注册时间等字段。需有效的 bearer token 或 session cookie。
 * @response 200:UserResponse:当前用户完整资料（含 email、role 等敏感字段）
 * @response 404:ErrorResponse:用户不存在
 * @responseSet auth
 * @response 401:ErrorResponse:未登录或 token 无效
 * @auth bearer
 * @tag Users
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);

    const [user, hasGitHub] = await Promise.all([
      db.query.users.findFirst({
        where: eq(users.id, session.userId),
        columns: {
          id: true,
          email: true,
          username: true,
          userSlug: true,
          displayName: true,
          avatarUrl: true,
          bio: true,
          websiteUrl: true,
          githubUsername: true,
          role: true,
          plan: true,
          emailVerified: true,
          createdAt: true,
        },
      }),
      hasGitHubRepoConnection(session.userId),
    ]);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user, hasGitHub });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * 更新当前用户资料
 * @description 部分更新用户资料字段（displayName、bio、websiteUrl、avatarUrl），所有字段均为可选，未提供的字段保持不变。空字符串将被转为 null。若未提供任何有效字段则返回 400。需登录。
 * @body UpdateProfileBody
 * @response 200:UserResponse:更新后的用户完整资料
 * @response 400:ErrorResponse:无有效字段可更新或输入验证失败
 * @response 500:ErrorResponse:服务器内部错误
 * @responseSet auth
 * @response 401:ErrorResponse:未登录或 token 无效
 * @auth bearer
 * @tag Users
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();
    const data = UpdateProfileBody.parse(body);

    // Filter out undefined values
    const updateData: Record<string, unknown> = {};
    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.bio !== undefined) updateData.bio = data.bio || null;
    if (data.websiteUrl !== undefined) updateData.websiteUrl = data.websiteUrl || null;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl || null;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, session.userId));

    const updatedUser = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
      columns: {
        id: true,
        email: true,
        username: true,
        userSlug: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        websiteUrl: true,
        githubUsername: true,
        role: true,
        plan: true,
      },
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Update user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
