export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { db, users } from '@/lib/db';
import { verifyPassword } from '@/lib/auth/password';
import { setAuthCookies } from '@/lib/auth/cookies';
import { createSession } from '@/lib/auth/session-service';
import { LoginBody } from '@/lib/validations/user';
import { eq } from 'drizzle-orm';
import { ZodError } from 'zod';

/**
 * 用户登录
 * @summary 用户登录
 * @description 使用邮箱和密码登录，验证凭据后设置 session cookie 并更新最后登录时间。返回 `{ success: true }`。登录失败时返回 401 统一错误信息以防止邮箱枚举攻击。
 * @body LoginBody
 * @response 200:SuccessResponse:登录成功
 * @response 400:ErrorResponse:输入无效
 * @response 401:ErrorResponse:凭据无效
 * @tag Auth
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = LoginBody.parse(body);

    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Update last login
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    // 签发双 token：access + refresh（refresh 哈希落库）
    const { sessionId, refreshToken } = await createSession(user.id, {
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    });
    await setAuthCookies({ userId: user.id, role: user.role, sessionId }, refreshToken);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
