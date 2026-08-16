import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { clearAuthCookies } from '@/lib/auth/cookies';
import { revokeSession } from '@/lib/auth/session-service';
import { verifyAccessToken, ACCESS_COOKIE } from '@/lib/auth/token';

async function revokeCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE)?.value;
  if (token) {
    const payload = await verifyAccessToken(token);
    if (payload) await revokeSession(payload.sessionId);
  }
}

/**
 * 执行登出
 * @summary 执行登出
 * @description 吊销当前会话（软删除 auth_sessions 记录）并清除 access/refresh cookie，返回成功状态，适用于 API 调用端（如桌面应用、移动端）的登出操作
 * @response 200:SuccessResponse:登出成功
 * @tag Auth
 */
export async function POST() {
  await revokeCurrentSession();
  await clearAuthCookies();
  return NextResponse.json({ success: true });
}

/**
 * 获取登出状态
 * @description 吊销当前会话并清除 cookie，重定向到首页，适用于浏览器端通过链接访问的登出操作
 * @ignore
 */
export async function GET() {
  await revokeCurrentSession();
  await clearAuthCookies();
  return NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
}
