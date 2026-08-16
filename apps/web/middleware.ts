import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAccessToken, ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/auth/token';

/**
 * 轻量自动刷新 middleware（选项 A）：
 * 1. access token 有效 → 本地验签（微秒级，不查库）→ 透传。
 * 2. 缺失/过期 → 读 refresh token → 调 /api/auth/refresh（此时才查库，15 分钟/用户一次）
 *    → 转写 Set-Cookie 到响应 → 透传。
 *
 * 注意：middleware 跑 Edge runtime，`process.env.ACCESS_TOKEN_SECRET` 必须在此文件内
 * 直接引用才会被构建期内联，故显式读取后传给 verifyAccessToken。
 */
export async function middleware(request: NextRequest) {
  const secret = process.env.ACCESS_TOKEN_SECRET;
  if (!secret) return NextResponse.next();

  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  if (accessToken) {
    const payload = await verifyAccessToken(accessToken, secret);
    if (payload) return NextResponse.next();
  }

  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return NextResponse.next();

  // 调自己的 refresh 端点（Node runtime 查库轮换），matcher 已排除 /api/auth 避免递归
  const refreshRes = await fetch(new URL('/api/auth/refresh', request.url), {
    method: 'POST',
    headers: { cookie: `${REFRESH_COOKIE}=${refreshToken}` },
  });

  if (!refreshRes.ok) {
    const res = NextResponse.next();
    res.cookies.delete(ACCESS_COOKIE);
    res.cookies.delete(REFRESH_COOKIE);
    return res;
  }

  // 解析新 access token，注入 header 供当前请求的 Server Component 读取
  let newAccessToken: string | null = null;
  try {
    const data = await refreshRes.json();
    newAccessToken = typeof data.accessToken === 'string' ? data.accessToken : null;
  } catch {
    // ignore — 拿不到 token 时退化为仅转写 cookie
  }

  const requestHeaders = new Headers(request.headers);
  if (newAccessToken) requestHeaders.set('x-access-token', newAccessToken);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  for (const cookie of refreshRes.headers.getSetCookie()) {
    res.headers.append('set-cookie', cookie);
  }
  return res;
}

export const config = {
  // 排除静态资源与所有 /api/auth/*（refresh/login/logout/callback），避免递归刷新
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
};
