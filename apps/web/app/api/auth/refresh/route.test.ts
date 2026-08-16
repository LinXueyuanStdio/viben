/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  rotateRefreshToken: vi.fn(),
  setAuthCookies: vi.fn().mockResolvedValue(undefined),
  checkRateLimit: vi.fn().mockResolvedValue(null),
  cookiesGet: vi.fn(),
  usersFindFirstResult: { role: 'developer' },
}));

vi.mock('@/lib/auth/session-service', () => ({
  rotateRefreshToken: mocks.rotateRefreshToken,
  RefreshTokenError: class extends Error {
    constructor(public status = 401) {
      super('Invalid refresh token');
    }
  },
}));

vi.mock('@/lib/auth/cookies', () => ({
  setAuthCookies: mocks.setAuthCookies,
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: mocks.checkRateLimit,
  rateLimitKey: vi.fn((parts: (number | string | null | undefined)[]) => parts.join(':')),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: mocks.cookiesGet })),
}));

// refresh 端点查 users 表取 role 用于重签 access token
vi.mock('@/lib/db', () => ({
  db: { query: { users: { findFirst: vi.fn(() => mocks.usersFindFirstResult) } } },
  users: { id: 'id', role: 'role' },
}));

import { POST } from './route';
import { RefreshTokenError } from '@/lib/auth/session-service';

function createRequest(): Request {
  return new Request('http://localhost:3000/api/auth/refresh', {
    method: 'POST',
    headers: { 'x-forwarded-for': '1.2.3.4', 'user-agent': 'UA' },
  });
}

describe('POST /api/auth/refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setAuthCookies.mockResolvedValue(undefined);
    mocks.checkRateLimit.mockResolvedValue(null);
    mocks.rotateRefreshToken.mockResolvedValue({ userId: 'u-1', sessionId: 's-1', refreshToken: 'newtoken' });
    mocks.cookiesGet.mockReturnValue({ value: 'oldtoken' });
    mocks.usersFindFirstResult = { role: 'developer' };
  });

  it('rotates and sets new cookies', async () => {
    const res = await POST(createRequest());
    expect(res.status).toBe(200);

    expect(mocks.rotateRefreshToken).toHaveBeenCalledWith('oldtoken', expect.objectContaining({ ip: '1.2.3.4', userAgent: 'UA' }));
    expect(mocks.setAuthCookies).toHaveBeenCalledWith({ userId: 'u-1', role: 'developer', sessionId: 's-1' }, 'newtoken');
  });

  it('returns 401 when refresh cookie missing', async () => {
    mocks.cookiesGet.mockReturnValue(undefined);
    const res = await POST(createRequest());
    expect(res.status).toBe(401);
    expect(mocks.rotateRefreshToken).not.toHaveBeenCalled();
  });

  it('returns 401 when rotateRefreshToken throws RefreshTokenError', async () => {
    mocks.rotateRefreshToken.mockRejectedValue(new RefreshTokenError());
    const res = await POST(createRequest());
    expect(res.status).toBe(401);
    expect(mocks.setAuthCookies).not.toHaveBeenCalled();
  });

  it('returns 401 when user no longer exists', async () => {
    mocks.rotateRefreshToken.mockResolvedValue({ userId: 'gone', sessionId: 's-1', refreshToken: 'newtoken' });
    mocks.usersFindFirstResult = null;
    const res = await POST(createRequest());
    expect(res.status).toBe(401);
    expect(mocks.setAuthCookies).not.toHaveBeenCalled();
  });

  it('returns 429 when rate limited', async () => {
    mocks.checkRateLimit.mockResolvedValue(Response.json({ error: 'Too many requests' }, { status: 429 }));
    const res = await POST(createRequest());
    expect(res.status).toBe(429);
    expect(mocks.rotateRefreshToken).not.toHaveBeenCalled();
  });
});
