/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookiesGet: vi.fn(),
  clearAuthCookies: vi.fn().mockResolvedValue(undefined),
  revokeSession: vi.fn().mockResolvedValue(undefined),
  verifyAccessToken: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: mocks.cookiesGet })),
}));

vi.mock('@/lib/auth/cookies', () => ({
  clearAuthCookies: mocks.clearAuthCookies,
}));

vi.mock('@/lib/auth/session-service', () => ({
  revokeSession: mocks.revokeSession,
}));

vi.mock('@/lib/auth/token', () => ({
  verifyAccessToken: mocks.verifyAccessToken,
  ACCESS_COOKIE: 'access_token',
}));

import { POST, GET } from './route';

const payload = { userId: 'u-1', role: 'developer', sessionId: 's-1', iat: 0, exp: 0 };

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookiesGet.mockReturnValue({ value: 'valid-token' });
    mocks.verifyAccessToken.mockResolvedValue(payload);
  });

  it('revokes the session and clears cookies', async () => {
    const res = await POST();
    expect(res.status).toBe(200);

    expect(mocks.verifyAccessToken).toHaveBeenCalledWith('valid-token');
    expect(mocks.revokeSession).toHaveBeenCalledWith('s-1');
    expect(mocks.clearAuthCookies).toHaveBeenCalled();
  });

  it('clears cookies even without an access token', async () => {
    mocks.cookiesGet.mockReturnValue(undefined);

    const res = await POST();
    expect(res.status).toBe(200);

    expect(mocks.verifyAccessToken).not.toHaveBeenCalled();
    expect(mocks.revokeSession).not.toHaveBeenCalled();
    expect(mocks.clearAuthCookies).toHaveBeenCalled();
  });
});

describe('GET /api/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookiesGet.mockReturnValue({ value: 'valid-token' });
    mocks.verifyAccessToken.mockResolvedValue(payload);
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  });

  it('revokes and redirects to home', async () => {
    const res = await GET();
    expect(res.status).toBe(307);
    expect(mocks.revokeSession).toHaveBeenCalledWith('s-1');
    expect(mocks.clearAuthCookies).toHaveBeenCalled();
  });
});
