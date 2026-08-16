/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mocks = vi.hoisted(() => ({
  verifyAccessToken: vi.fn(),
  fetchRefresh: vi.fn(),
}));

vi.mock('@/lib/auth/token', () => ({
  verifyAccessToken: mocks.verifyAccessToken,
  ACCESS_COOKIE: 'access_token',
  REFRESH_COOKIE: 'refresh_token',
}));

vi.stubGlobal('fetch', mocks.fetchRefresh);

import { middleware } from './middleware';

function makeRequest(cookie?: string): NextRequest {
  return new NextRequest('http://localhost:3000/assistant', {
    headers: cookie ? { cookie } : undefined,
  });
}

describe('middleware (auto-refresh, option A)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ACCESS_TOKEN_SECRET = 'test-secret';
  });

  afterEach(() => {
    delete process.env.ACCESS_TOKEN_SECRET;
  });

  it('passes through when ACCESS_TOKEN_SECRET is unset', async () => {
    delete process.env.ACCESS_TOKEN_SECRET;

    await middleware(makeRequest('access_token=x'));

    expect(mocks.verifyAccessToken).not.toHaveBeenCalled();
    expect(mocks.fetchRefresh).not.toHaveBeenCalled();
  });

  it('passes through without calling refresh when access token is valid', async () => {
    mocks.verifyAccessToken.mockResolvedValue({ userId: 'u-1', role: 'developer', sessionId: 's-1' });

    await middleware(makeRequest('access_token=valid'));

    expect(mocks.verifyAccessToken).toHaveBeenCalledWith('valid', 'test-secret');
    expect(mocks.fetchRefresh).not.toHaveBeenCalled();
  });

  it('passes through when access token expired and no refresh token present', async () => {
    mocks.verifyAccessToken.mockResolvedValue(null);

    await middleware(makeRequest('access_token=expired'));

    expect(mocks.fetchRefresh).not.toHaveBeenCalled();
  });

  it('refreshes and forwards Set-Cookie when access expired but refresh valid', async () => {
    mocks.verifyAccessToken.mockResolvedValue(null);
    const headers = new Headers();
    headers.append('set-cookie', 'access_token=newtoken; Path=/');
    headers.append('set-cookie', 'refresh_token=newrefresh; Path=/');
    mocks.fetchRefresh.mockResolvedValue(
      new Response(JSON.stringify({ success: true, accessToken: 'newtoken' }), {
        status: 200,
        headers,
      }),
    );

    const res = await middleware(makeRequest('access_token=expired; refresh_token=rt'));

    expect(mocks.fetchRefresh).toHaveBeenCalledTimes(1);
    const setCookies = res.headers.getSetCookie();
    expect(setCookies.some((c) => c.startsWith('access_token=newtoken'))).toBe(true);
    expect(setCookies.some((c) => c.startsWith('refresh_token=newrefresh'))).toBe(true);
  });

  it('injects the refreshed access token into the current request header', async () => {
    const nextSpy = vi.spyOn(NextResponse, 'next');
    try {
      mocks.verifyAccessToken.mockResolvedValue(null);
      const headers = new Headers();
      headers.append('set-cookie', 'access_token=newtoken; Path=/');
      mocks.fetchRefresh.mockResolvedValue(
        new Response(JSON.stringify({ success: true, accessToken: 'newtoken' }), {
          status: 200,
          headers,
        }),
      );

      await middleware(makeRequest('access_token=expired; refresh_token=rt'));

      // 新 token 注入到 request header（NextResponse.next 的第一个参数），供当前请求 RSC 读取
      const headerCall = nextSpy.mock.calls.find((c) => c[0]?.request?.headers);
      expect(headerCall?.[0]?.request?.headers?.get?.('x-access-token')).toBe('newtoken');
    } finally {
      nextSpy.mockRestore();
    }
  });

  it('clears both cookies when refresh fails', async () => {
    mocks.verifyAccessToken.mockResolvedValue(null);
    mocks.fetchRefresh.mockResolvedValue(new Response(null, { status: 401 }));

    const res = await middleware(makeRequest('access_token=expired; refresh_token=rt'));

    expect(mocks.fetchRefresh).toHaveBeenCalledTimes(1);
    const setCookies = res.headers.getSetCookie();
    expect(setCookies.some((c) => c.startsWith('access_token='))).toBe(true);
    expect(setCookies.some((c) => c.startsWith('refresh_token='))).toBe(true);
  });
});
