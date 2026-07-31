import { NextResponse } from 'next/server';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { ForgotPasswordBody } from '@/lib/validations/user';
import { storeResetToken } from '@/lib/auth/reset-tokens';
import { ZodError } from 'zod';

/**
 * 忘记密码
 * @summary 发送密码重置邮件
 * @description 根据邮箱地址发送密码重置令牌（开发环境打印至控制台）。为防止邮箱枚举攻击，无论邮箱是否存在均返回相同成功消息。令牌通过 `storeResetToken` 存储在服务端，有效期有限。
 * @body ForgotPasswordBody
 * @response 200:SuccessResponse:若邮箱存在已发送重置链接
 * @response 400:ErrorResponse:输入无效
 * @tag Auth
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = ForgotPasswordBody.parse(body);

    // Find user by email - always return success to prevent email enumeration
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
      columns: { id: true, email: true },
    });

    if (user) {
      const token = crypto.randomUUID();
      storeResetToken(token, email);
      // Simulate email sending - in production this would be sent via email
      console.log('=== PASSWORD RESET TOKEN ===');
      console.log(`Email: ${email}`);
      console.log(`Token: ${token}`);
      console.log(`Reset URL: /reset-password?token=${token}`);
      console.log('=============================');
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
