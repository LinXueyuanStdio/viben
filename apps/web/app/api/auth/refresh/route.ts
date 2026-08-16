import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { rotateRefreshToken, RefreshTokenError } from '@/lib/auth/session-service';
import { setAuthCookies } from '@/lib/auth/cookies';
import { REFRESH_COOKIE } from '@/lib/auth/token';
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit';

/**
 * 刷新会话：校验 refresh token → 轮换 → 签发新 access token + refresh token。
 * @summary 刷新会话
 * @tag Auth
 * @response 200:SuccessResponse:刷新成功
 * @response 401:ErrorResponse:refresh token 无效或过期
 * @response 429:ErrorResponse:请求过于频繁
 */
export async function POST(request: NextRequest) {
  // 按 IP 限流
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown';
  const limited = await checkRateLimit({
    key: rateLimitKey(['refresh', ip]),
    limit: 60,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const cookieStore = await cookies();
  const rawToken = cookieStore.get(REFRESH_COOKIE)?.value;

  if (!rawToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const userAgent = request.headers.get('user-agent');
    const { userId, sessionId, refreshToken } = await rotateRefreshToken(rawToken, {
      userAgent,
      ip,
    });

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { role: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = await setAuthCookies({ userId, role: user.role, sessionId }, refreshToken);

    return NextResponse.json({ success: true, accessToken });
  } catch (error) {
    if (error instanceof RefreshTokenError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[Auth] refresh error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
