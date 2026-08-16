import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import {
  signAccessToken,
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from './token';
import { resolveSessionFromAccessToken } from './session-service';
import type { Session } from './types';

const ACCESS_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: ACCESS_TOKEN_TTL_SECONDS,
};

// 修正：path 用 '/'（见 plan「Spec 修正」），否则 middleware 无法在页面请求时读到 refresh token 触发自动刷新。
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: REFRESH_TOKEN_TTL_SECONDS,
};

/** 登录成功后设置 access_token + refresh_token 两个 cookie，返回签发的 access token。 */
export async function setAuthCookies(
  claims: { userId: string; role: string; sessionId: string },
  refreshToken: string,
): Promise<string> {
  const accessToken = await signAccessToken(claims);
  const cookieStore = await cookies();
  cookieStore.set(ACCESS_COOKIE, accessToken, ACCESS_COOKIE_OPTIONS);
  cookieStore.set(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTIONS);
  return accessToken;
}

/** 清除两个 auth cookie（登出）。 */
export async function clearAuthCookies(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_COOKIE);
  cookieStore.delete(REFRESH_COOKIE);
}

async function _getSession(): Promise<Session | null> {
  // 优先读 middleware 在 refresh 后注入的 x-access-token header，
  // 使当前请求的 Server Component 也能读到新签发的 access token
  // （否则 middleware 把新 token 写在响应 cookie 上，当前请求的 RSC 读不到，会误判未登录）。
  const headersList = await headers();
  const headerToken = headersList.get('x-access-token');
  const cookieStore = await cookies();
  const token = headerToken ?? cookieStore.get(ACCESS_COOKIE)?.value;

  if (!token) {
    if (process.env.NODE_ENV === 'development') {
      console.debug('[Auth] No access token found');
    }
    return null;
  }

  return resolveSessionFromAccessToken(token);
}

/** React.cache() 确保同一请求内多次调用共享一份结果，避免 layout 和 page 各自独立查库。 */
export const getSession = cache(_getSession);
