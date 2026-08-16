import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  findEditablePage: vi.fn(),
  findRecordsMany: vi.fn(),
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
      publishedPageRecords: {
        findMany: mocks.findRecordsMany,
      },
    },
  },
  publishedPageRecords: {
    uid: 'recordUid',
    userId: 'recordUserId',
    recordNumber: 'recordNumber',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...conditions) => ({ type: 'and', conditions })),
  desc: vi.fn((field) => ({ direction: 'desc', field })),
  eq: vi.fn((field, value) => ({ field, value })),
}));

import { POST } from './route';

function requestWithBody(body: unknown) {
  return new NextRequest('http://localhost/api/pages/publish-history', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/pages/publish-history', () => {
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
      id: 'published-1',
      uid: 'demo',
      userId: 'user-1',
      currentVersion: 2,
      authorSlug: 'alice',
    });
    mocks.findRecordsMany.mockResolvedValue([
      {
        id: 'record-2',
        recordNumber: 2,
        version: 2,
        action: 'publish',
        title: 'Demo v2',
        icon: null,
        description: 'Updated',
        createdAt: new Date('2026-06-22T07:00:00.000Z'),
      },
      {
        id: 'record-1',
        recordNumber: 1,
        version: 1,
        action: 'publish',
        title: 'Demo',
        icon: { type: 'lucide', value: 'file-text' },
        description: 'Initial',
        createdAt: new Date('2026-06-22T06:00:00.000Z'),
      },
    ]);
    mocks.execute.mockResolvedValue(undefined);
  });

  it('returns publish records with version URLs and current marker', async () => {
    const response = await POST(requestWithBody({ uid: 'demo' }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      page_uid: 'demo',
      current_version: 2,
      records: [
        {
          id: 'record-2',
          record_number: 2,
          version: 2,
          action: 'publish',
          title: 'Demo v2',
          icon: null,
          description: 'Updated',
          created_at: '2026-06-22T07:00:00.000Z',
          is_current: true,
          url: '/page/alice/demo/versions/2',
        },
        {
          id: 'record-1',
          record_number: 1,
          version: 1,
          action: 'publish',
          title: 'Demo',
          icon: { type: 'lucide', value: 'file-text' },
          description: 'Initial',
          created_at: '2026-06-22T06:00:00.000Z',
          is_current: false,
          url: '/page/alice/demo/versions/1',
        },
      ],
    });
    expect(mocks.findRecordsMany).toHaveBeenCalledWith({
      where: {
        type: 'and',
        conditions: [
          { field: 'recordUserId', value: 'user-1' },
          { field: 'recordUid', value: 'demo' },
        ],
      },
      orderBy: [{ direction: 'desc', field: 'recordNumber' }],
    });
  });

  it('returns 404 when the current user has not published the page', async () => {
    mocks.findEditablePage.mockResolvedValue(null);

    const response = await POST(requestWithBody({ uid: 'missing' }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Published page not found',
    });
    expect(mocks.findRecordsMany).not.toHaveBeenCalled();
  });
});
