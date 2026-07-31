/**
 * Change Password API
 *
 * POST /api/auth/change-password - Change current user's password
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth/middleware';
import { db, users } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { ChangePasswordBody } from '@/lib/validations/user';
import { eq } from 'drizzle-orm';
import { ZodError } from 'zod';

/**
 * 修改密码
 * @summary 修改密码
 * @description 验证当前密码后更新为新密码，需登录。验证流程：先从数据库获取当前用户的密码哈希，用 `verifyPassword` 验证当前密码正确性，通过后用 `hashPassword` 加密新密码并更新。session 通过 `requireAuth` 中间件获取，AuthError 时返回对应状态码。
 * @body ChangePasswordBody
 * @response 200:SuccessResponse:密码修改成功
 * @response 400:ErrorResponse:当前密码不正确或输入无效
 * @response 401:ErrorResponse:未登录
 * @responseSet auth
 * @auth bearer
 * @tag Auth
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();
    const { currentPassword, newPassword } = ChangePasswordBody.parse(body);

    // Fetch current user with password hash
    const [user] = await db
      .select({ id: users.id, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, session.userId));

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: 'Password authentication not available for this account' },
        { status: 400 }
      );
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      );
    }

    // Hash and update new password
    const newHash = await hashPassword(newPassword);
    await db
      .update(users)
      .set({ passwordHash: newHash })
      .where(eq(users.id, session.userId));

    return NextResponse.json({ success: true });
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
    console.error('Change password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
