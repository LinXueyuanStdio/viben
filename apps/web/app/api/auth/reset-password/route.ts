import { NextResponse } from 'next/server';
import { db, users } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { eq } from 'drizzle-orm';
import { ResetPasswordBody } from '@/lib/validations/user';
import { consumeResetToken } from '@/lib/auth/reset-tokens';
import { ZodError } from 'zod';

/**
 * 重置密码
 * @summary 重置密码
 * @description 使用通过邮件收到的重置令牌设置新密码。令牌通过 `consumeResetToken` 验证并一次性消费，使用后立即失效。密码需满足最小长度 8 位要求，通过 Zod 验证。
 * @body ResetPasswordBody
 * @response 200:SuccessResponse:密码重置成功
 * @response 400:ErrorResponse:令牌无效、已过期或输入无效
 * @tag Auth
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, password } = ResetPasswordBody.parse(body);

    // Validate token and get email
    const email = consumeResetToken(token);
    if (!email) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    // Find user
    const [user] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, email));

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 400 }
      );
    }

    // Hash and update password
    const passwordHash = await hashPassword(password);
    await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, user.id));

    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully.',
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
