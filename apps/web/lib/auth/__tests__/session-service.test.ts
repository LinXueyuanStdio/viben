/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const TEST_SECRET = 'test-access-token-secret-that-is-long-enough-for-hs256';

const mocks = vi.hoisted(() => ({
  insertValues: vi.fn(),
  findFirstResult: null as any,
  updateSet: vi.fn(),
  updateReturning: vi.fn(),
  usersFindFirstResult: null as any,
}));

vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn(() => ({ values: mocks.insertValues })),
    query: {
      authSessions: { findFirst: vi.fn(() => mocks.findFirstResult) },
      users: { findFirst: vi.fn(() => mocks.usersFindFirstResult) },
    },
    update: vi.fn(() => ({ set: mocks.updateSet })),
  },
  authSessions: {
    id: 'id',
    userId: 'userId',
    refreshTokenHash: 'refreshTokenHash',
    expiresAt: 'expiresAt',
    lastUsedAt: 'lastUsedAt',
    revokedAt: 'revokedAt',
    userAgent: 'userAgent',
    ip: 'ip',
  },
  users: {
    id: 'id',
    username: 'username',
    userSlug: 'userSlug',
    displayName: 'displayName',
    email: 'email',
    role: 'role',
    avatarUrl: 'avatarUrl',
  },
}));

import { createSession, rotateRefreshToken, resolveSessionFromAccessToken, revokeSession, revokeAllUserSessions, RefreshTokenError } from '../session-service';
import { signAccessToken, REFRESH_TOKEN_TTL_SECONDS } from '../token';
import { hashRefreshToken } from '../refresh-token';

describe('createSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insertValues.mockResolvedValue(undefined);
  });

  it('inserts a hashed refresh token and returns raw token + sessionId', async () => {
    const { sessionId, refreshToken } = await createSession('u-1', { userAgent: 'UA', ip: '1.2.3.4' });

    expect(sessionId).toBeTruthy();
    expect(refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const inserted = mocks.insertValues.mock.calls[0][0];
    expect(inserted.userId).toBe('u-1');
    expect(inserted.refreshTokenHash).toBe(hashRefreshToken(refreshToken));
    expect(inserted.refreshTokenHash).not.toBe(refreshToken);
    expect(inserted.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(inserted.userAgent).toBe('UA');
    expect(inserted.ip).toBe('1.2.3.4');
  });
});

describe('rotateRefreshToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateSet.mockReturnValue({
      where: vi.fn(() => ({ returning: mocks.updateReturning })),
    });
    mocks.updateReturning.mockResolvedValue([{ id: 's-1' }]);
  });

  it('rotates: returns new token and updates hash', async () => {
    mocks.findFirstResult = {
      id: 's-1',
      userId: 'u-1',
      refreshTokenHash: 'oldhash',
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: null,
      userAgent: null,
      ip: null,
    };

    const result = await rotateRefreshToken('oldrawtoken');

    expect(result.userId).toBe('u-1');
    expect(result.sessionId).toBe('s-1');
    expect(result.refreshToken).not.toBe('oldrawtoken');

    const updated = mocks.updateSet.mock.calls[0][0];
    expect(updated.refreshTokenHash).toBe(hashRefreshToken(result.refreshToken));
    expect(updated.lastUsedAt).toBeInstanceOf(Date);
  });

  it('throws when token unknown', async () => {
    mocks.findFirstResult = null;
    await expect(rotateRefreshToken('nope')).rejects.toThrow(RefreshTokenError);
  });

  it('throws when session already revoked (reuse detection)', async () => {
    mocks.findFirstResult = {
      id: 's-1',
      userId: 'u-1',
      refreshTokenHash: 'h',
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: new Date(),
    };

    await expect(rotateRefreshToken('reused')).rejects.toThrow(RefreshTokenError);
  });

  it('throws when expired', async () => {
    mocks.findFirstResult = {
      id: 's-1',
      userId: 'u-1',
      refreshTokenHash: 'h',
      expiresAt: new Date(Date.now() - 1000),
      revokedAt: null,
    };

    await expect(rotateRefreshToken('expired')).rejects.toThrow(RefreshTokenError);
  });
});

describe('resolveSessionFromAccessToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('verifies token and hydrates user from db', async () => {
    const token = await signAccessToken({ userId: 'u-1', role: 'developer', sessionId: 's-1' }, TEST_SECRET);
    mocks.usersFindFirstResult = {
      id: 'u-1',
      username: 'alice',
      userSlug: 'alice',
      displayName: 'Alice',
      email: 'a@b.c',
      role: 'developer',
      avatarUrl: null,
    };

    const session = await resolveSessionFromAccessToken(token, TEST_SECRET);

    expect(session).not.toBeNull();
    expect(session!.userId).toBe('u-1');
    expect(session!.email).toBe('a@b.c');
    expect(session!.username).toBe('alice');
    expect(session!.role).toBe('developer');
  });

  it('returns null when user not found', async () => {
    const token = await signAccessToken({ userId: 'gone', role: 'developer', sessionId: 's-1' }, TEST_SECRET);
    mocks.usersFindFirstResult = null;
    expect(await resolveSessionFromAccessToken(token, TEST_SECRET)).toBeNull();
  });

  it('returns null for invalid token', async () => {
    expect(await resolveSessionFromAccessToken('bad-token', TEST_SECRET)).toBeNull();
  });
});

describe('rotateRefreshToken security edges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateSet.mockReturnValue({
      where: vi.fn(() => ({ returning: mocks.updateReturning })),
    });
    mocks.updateReturning.mockResolvedValue([{ id: 's-1' }]);
  });

  it('revokes all user sessions when a revoked token is reused', async () => {
    mocks.findFirstResult = {
      id: 's-1',
      userId: 'u-1',
      refreshTokenHash: 'h',
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: new Date(),
    };

    await expect(rotateRefreshToken('reused')).rejects.toThrow(RefreshTokenError);

    // 复用检测触发吊销家族：updateSet 收到一次带 revokedAt 的调用
    const revokeCall = mocks.updateSet.mock.calls.find((c) => c[0] && 'revokedAt' in c[0]);
    expect(revokeCall).toBeTruthy();
  });

  it('revokes family when CAS rotation loses the race', async () => {
    mocks.findFirstResult = {
      id: 's-1',
      userId: 'u-1',
      refreshTokenHash: 'h',
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: null,
    };
    mocks.updateReturning.mockResolvedValue([]); // 竞争失败：0 行被轮换

    await expect(rotateRefreshToken('tok')).rejects.toThrow(RefreshTokenError);

    const revokeCall = mocks.updateSet.mock.calls.find((c) => c[0] && 'revokedAt' in c[0]);
    expect(revokeCall).toBeTruthy();
  });

  it('slides expiry: re-times expiresAt ~30 days out', async () => {
    mocks.findFirstResult = {
      id: 's-1',
      userId: 'u-1',
      refreshTokenHash: 'h',
      expiresAt: new Date(Date.now() + 1000), // 快过期
      revokedAt: null,
    };

    await rotateRefreshToken('tok');

    const updated = mocks.updateSet.mock.calls[0][0];
    expect(updated.expiresAt.getTime()).toBeGreaterThan(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000 - 5000);
  });
});

describe('revokeSession / revokeAllUserSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateSet.mockReturnValue({ where: vi.fn() });
  });

  it('revokeSession sets revokedAt', async () => {
    await revokeSession('s-1');
    expect(mocks.updateSet).toHaveBeenCalledWith(expect.objectContaining({ revokedAt: expect.any(Date) }));
  });

  it('revokeAllUserSessions sets revokedAt', async () => {
    await revokeAllUserSessions('u-1');
    expect(mocks.updateSet).toHaveBeenCalledWith(expect.objectContaining({ revokedAt: expect.any(Date) }));
  });
});
