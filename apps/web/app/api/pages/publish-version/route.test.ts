import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  findEditablePage: vi.fn(),
  findVersion: vi.fn(),
  execute: vi.fn(),
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/auth/middleware', () => ({
  AuthError: class AuthError extends Error {
    constructor(message: string, public status = 401) {
      super(message);
      this.name = 'AuthError';
    }
  },
  requireAuth: mocks.requireAuth,
}));

vi.mock('@/lib/db/published-pages', () => ({
  ensurePublishedPagesTable: mocks.execute,
}));

vi.mock('@/lib/db/page-auth', () => ({
  findEditablePage: mocks.findEditablePage,
}));

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      publishedPageVersions: {
        findFirst: mocks.findVersion,
      },
    },
  },
  publishedPageVersions: {
    uid: 'versionUid',
    userId: 'versionUserId',
    version: 'version',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...conditions) => ({ type: 'and', conditions })),
  eq: vi.fn((field, value) => ({ field, value })),
}));

import { POST } from './route';

function requestWithBody(body: unknown) {
  return new NextRequest('http://localhost/api/pages/publish-version', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/pages/publish-version', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue({
      userId: 'user-1',
      username: 'alice',
      userSlug: 'alice',
      email: 'alice@example.com',
      role: 'developer',
      expiresAt: Date.now() + 3600000,
    });
    mocks.findEditablePage.mockResolvedValue({
      id: 'page-1',
      uid: 'demo',
      userId: 'user-1',
    });
    mocks.findVersion.mockResolvedValue({
      id: 'version-2',
      uid: 'demo',
      userId: 'user-1',
      version: 2,
      title: 'Demo v2',
      icon: null,
      description: 'Updated',
      html: '<html><body>v2</body></html>',
      createdAt: new Date('2026-06-22T07:00:00.000Z'),
    });
    mocks.execute.mockResolvedValue(undefined);
  });

  it('returns the requested version html snapshot', async () => {
    const response = await POST(requestWithBody({ uid: 'demo', version: 2 }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      page_uid: 'demo',
      version: 2,
      title: 'Demo v2',
      icon: null,
      description: 'Updated',
      html: '<html><body>v2</body></html>',
      created_at: '2026-06-22T07:00:00.000Z',
      url: '/page/alice/demo/versions/2',
    });
  });

  it('returns 404 when the version does not exist for the current user', async () => {
    mocks.findVersion.mockResolvedValue(null);

    const response = await POST(requestWithBody({ uid: 'demo', version: 99 }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Published page version not found',
    });
  });
});
