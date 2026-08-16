import { NextResponse } from 'next/server';
import { db, users } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { setAuthCookies } from '@/lib/auth/cookies';
import { createSession } from '@/lib/auth/session-service';
import { generateId } from '@/lib/utils';
import { normalizeUserSlug } from '@/lib/utils/user-slug';
import { RegisterBody } from '@/lib/validations/user';
import { ZodError } from 'zod';

/**
 * 用户注册
 * @summary 用户注册
 * @description 创建新账号，校验邮箱和用户名唯一性，成功后自动设置 session cookie 并登录。返回 `{ success: true, userId }`。使用 Zod 验证输入，验证失败返回 400 及详细错误字段。
 * @body RegisterBody
 * @response 200:SuccessResponse:注册成功
 * @response 400:ErrorResponse:邮箱或用户名已被占用或输入无效
 * @tag Auth
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, username, password, displayName } = RegisterBody.parse(body);

    // Check if user exists
    const existing = await db.query.users.findFirst({
      where: (u, { or, eq }) => or(eq(u.email, email), eq(u.username, username)),
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Email or username already taken' },
        { status: 400 }
      );
    }

    // Create user
    const userId = generateId();
    const passwordHash = await hashPassword(password);

    await db.insert(users).values({
      id: userId,
      email,
      username,
      userSlug: normalizeUserSlug(username, userId),
      displayName,
      passwordHash,
      role: 'developer',
    });

    // 签发双 token：access + refresh（refresh 哈希落库）
    const { sessionId, refreshToken } = await createSession(userId, {
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    });
    await setAuthCookies({ userId, role: 'developer', sessionId }, refreshToken);

    return NextResponse.json({ success: true, userId });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
