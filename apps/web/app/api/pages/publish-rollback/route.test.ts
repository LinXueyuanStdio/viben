import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  findEditablePage: vi.fn(),
  findVersion: vi.fn(),
  findLatestRecord: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
  insertValues: vi.fn(),
  transaction: vi.fn(),
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
      publishedPageRecords: {
        findFirst: mocks.findLatestRecord,
      },
    },
    update: vi.fn(() => ({
      set: mocks.updateSet,
    })),
    insert: vi.fn(() => ({
      values: mocks.insertValues,
    })),
    transaction: mocks.transaction,
  },
  publishedPages: {
    uid: 'uid',
    userId: 'userId',
    title: 'title',
    icon: 'icon',
    description: 'description',
    html: 'html',
    currentVersion: 'currentVersion',
    updatedAt: 'updatedAt',
  },
  publishedPageVersions: {
    uid: 'versionUid',
    userId: 'versionUserId',
    version: 'version',
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
  sql: vi.fn((strings) => ({ type: 'sql', sql: strings.raw.join('?') })),
}));

import { POST } from './route';

function requestWithBody(body: unknown) {
  return new NextRequest('http://localhost/api/pages/publish-rollback', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/pages/publish-rollback', () => {
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
      currentVersion: 3,
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
    });
    mocks.findLatestRecord.mockResolvedValue({ recordNumber: 5 });
    mocks.updateSet.mockReturnValue({ where: mocks.updateWhere });
    mocks.updateWhere.mockResolvedValue(undefined);
    mocks.insertValues.mockResolvedValue(undefined);
    mocks.execute.mockResolvedValue(undefined);
  });

  it('updates the current published page to an old version and appends a rollback record', async () => {
    const response = await POST(requestWithBody({ uid: 'demo', version: 2 }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      page_uid: 'demo',
      version: 2,
      url: '/page/alice/demo',
    });
    expect(mocks.updateSet).toHaveBeenCalledWith({
      title: 'Demo v2',
      icon: null,
      description: 'Updated',
      html: '<html><body>v2</body></html>',
      currentVersion: 2,
      updatedAt: { type: 'sql', sql: 'now()' },
    });
    expect(mocks.insertValues).toHaveBeenCalledWith({
      publishedPageId: 'published-1',
      uid: 'demo',
      userId: 'user-1',
      recordNumber: 6,
      version: 2,
      action: 'rollback',
      title: 'Demo v2',
      icon: null,
      description: 'Updated',
    });
  });

  it('rejects rollback when the selected version is already current', async () => {
    mocks.findEditablePage.mockResolvedValue({
      id: 'published-1',
      uid: 'demo',
      userId: 'user-1',
      currentVersion: 2,
    });

    const response = await POST(requestWithBody({ uid: 'demo', version: 2 }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Selected version is already current',
    });
    expect(mocks.updateSet).not.toHaveBeenCalled();
    expect(mocks.insertValues).not.toHaveBeenCalled();
  });
});
