import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decryptSession, encryptSession } from '@/lib/auth/jwe';

const COOKIE_NAME = 'session';
// 与 lib/auth/cookies.ts 的 maxAge 保持一致
const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60;
// 剩余寿命 < 阈值才续期，避免每次请求都写 Set-Cookie
const RENEW_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * 滑动会话：活跃用户的 session cookie 在剩余寿命不足阈值时自动续期，
 * 与前端 localStorage 缓存的「活跃永不过期」语义对齐，避免 7 天绝对过期
 * 导致的「前端显示已登录、后端已登出」。
 *
 * 注意：middleware 默认跑在 Edge runtime，`process.env.X` 只在 middleware
 * 文件内直接引用时才会被构建期内联。因此这里显式读取 JWE_SECRET 并传给
 * jwe 函数——jwe 内部读取 process.env 在 Edge 下取不到值。
 */
export async function middleware(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.next();

  const secret = process.env.JWE_SECRET;
  if (!secret) return NextResponse.next();

  const session = await decryptSession(token, secret);
  if (!session) return NextResponse.next();

  const remaining = session.expiresAt - Date.now();
  if (remaining >= RENEW_THRESHOLD_MS) return NextResponse.next();

  const { expiresAt: _expiresAt, ...sessionData } = session;
  const newToken = await encryptSession(sessionData, secret);

  const response = NextResponse.next();
  response.cookies.set(COOKIE_NAME, newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_DURATION_SECONDS,
  });
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
