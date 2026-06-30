import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  findPublishedPage: vi.fn(),
  findLatestVersion: vi.fn(),
  findLatestRecord: vi.fn(),
  insertValues: vi.fn(),
  onConflictDoUpdate: vi.fn(),
  onConflictDoNothing: vi.fn(),
  transaction: vi.fn(),
  execute: vi.fn(),
  findMediaAsset: vi.fn(),
  requireAuth: vi.fn(),
  recordPageUpdateAndNotify: vi.fn(),
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

vi.mock('@/lib/services/community', () => ({
  recordPageUpdateAndNotify: mocks.recordPageUpdateAndNotify,
}));

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      publishedPages: {
        findFirst: mocks.findPublishedPage,
      },
      publishedPageVersions: {
        findFirst: mocks.findLatestVersion,
      },
      publishedPageRecords: {
        findFirst: mocks.findLatestRecord,
      },
      mediaAssets: {
        findFirst: mocks.findMediaAsset,
      },
    },
    insert: vi.fn(() => ({
      values: mocks.insertValues,
    })),
    transaction: mocks.transaction,
  },
  publishedPages: {
    uid: 'uid',
    userId: 'userId',
    id: 'id',
    title: 'title',
    icon: 'icon',
    description: 'description',
    html: 'html',
    currentVersion: 'currentVersion',
    updatedAt: 'updatedAt',
  },
  publishedPageVersions: {
    publishedPageId: 'publishedPageId',
    uid: 'versionUid',
    userId: 'versionUserId',
    version: 'version',
    title: 'versionTitle',
    icon: 'versionIcon',
    description: 'versionDescription',
    html: 'versionHtml',
  },
  publishedPageRecords: {
    publishedPageId: 'recordPublishedPageId',
    uid: 'recordUid',
    userId: 'recordUserId',
    recordNumber: 'recordNumber',
    version: 'recordVersion',
    action: 'recordAction',
    title: 'recordTitle',
    icon: 'recordIcon',
    description: 'recordDescription',
  },
  pageUpdateEvents: {
    publishedPageId: 'eventPublishedPageId',
    userId: 'eventUserId',
    userSlug: 'eventUserSlug',
    pageId: 'eventPageId',
    version: 'eventVersion',
    eventType: 'eventType',
    importance: 'eventImportance',
    title: 'eventTitle',
    description: 'eventDescription',
    visibility: 'eventVisibility',
  },
  mediaAssets: {
    id: 'assetId',
    ownerUserId: 'assetOwnerUserId',
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
  return new NextRequest('http://localhost/api/pages/publish', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/pages/publish', () => {
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
    mocks.findPublishedPage.mockResolvedValue({
      id: 'published-1',
      uid: 'demo',
      userId: 'user-1',
    });
    mocks.findLatestVersion.mockResolvedValue(null);
    mocks.findLatestRecord.mockResolvedValue(null);
    mocks.insertValues.mockReturnValue({
      onConflictDoUpdate: mocks.onConflictDoUpdate,
      onConflictDoNothing: mocks.onConflictDoNothing,
    });
    mocks.onConflictDoUpdate.mockResolvedValue(undefined);
    mocks.onConflictDoNothing.mockResolvedValue(undefined);
    mocks.findMediaAsset.mockResolvedValue({
      id: 'asset-1',
      ownerUserId: 'user-1',
    });
    mocks.recordPageUpdateAndNotify.mockResolvedValue(undefined);
    mocks.transaction.mockImplementation(async (callback) => callback({
      query: {
        publishedPages: {
          findFirst: mocks.findPublishedPage,
        },
        publishedPageVersions: {
          findFirst: mocks.findLatestVersion,
        },
        publishedPageRecords: {
          findFirst: mocks.findLatestRecord,
        },
        mediaAssets: {
          findFirst: mocks.findMediaAsset,
        },
      },
      insert: vi.fn(() => ({
        values: mocks.insertValues,
      })),
      execute: mocks.execute,
    }));
    mocks.execute.mockResolvedValue(undefined);
  });

  it('creates a published page with icon and description', async () => {
    const response = await POST(requestWithBody({
      uid: 'demo',
      title: 'Demo',
      icon: { type: 'lucide', value: 'file-text' },
      description: 'Demo page',
      html: '<!doctype html><html><body>Demo</body></html>',
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      page_uid: 'demo',
      url: '/page/alice/demo',
      read_url: '/alice/demo?tab=read',
      updated: true,
    });
    expect(mocks.insertValues).toHaveBeenCalledWith({
      uid: 'demo',
      userId: 'user-1',
      title: 'Demo',
      icon: { type: 'lucide', value: 'file-text' },
      description: 'Demo page',
      html: '<!doctype html><html><body>Demo</body></html>',
      currentVersion: 1,
      categoryId: null,
      coverAssetId: null,
      tags: [],
      visibility: 'public',
      moderationStatus: 'approved',
      publishedAt: { type: 'sql', sql: 'now()' },
      lastPublishedAt: { type: 'sql', sql: 'now()' },
      versionCount: 1,
    });
    expect(mocks.onConflictDoUpdate).toHaveBeenCalledWith({
      target: ['userId', 'uid'],
      set: {
        title: 'Demo',
        icon: { type: 'lucide', value: 'file-text' },
        description: 'Demo page',
        html: '<!doctype html><html><body>Demo</body></html>',
        currentVersion: 1,
        categoryId: null,
        coverAssetId: null,
        tags: [],
        visibility: 'public',
        moderationStatus: 'approved',
        lastPublishedAt: { type: 'sql', sql: 'now()' },
        versionCount: 1,
        updatedAt: { type: 'sql', sql: 'now()' },
      },
    });
    expect(mocks.insertValues).toHaveBeenCalledWith({
      publishedPageId: 'published-1',
      uid: 'demo',
      userId: 'user-1',
      version: 1,
      title: 'Demo',
      icon: { type: 'lucide', value: 'file-text' },
      description: 'Demo page',
      html: '<!doctype html><html><body>Demo</body></html>',
      categoryId: null,
      coverAssetId: null,
      tags: [],
      visibility: 'public',
      moderationStatus: 'approved',
      publishedAt: expect.any(Date),
    });
    expect(mocks.insertValues).toHaveBeenCalledWith({
      publishedPageId: 'published-1',
      uid: 'demo',
      userId: 'user-1',
      recordNumber: 1,
      version: 1,
      action: 'publish',
      title: 'Demo',
      icon: { type: 'lucide', value: 'file-text' },
      description: 'Demo page',
    });
    expect(mocks.recordPageUpdateAndNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.any(Object),
        insert: expect.any(Function),
      }),
      {
        publishedPageId: 'published-1',
        userId: 'user-1',
        userSlug: 'alice',
        pageId: 'demo',
        version: 1,
        eventType: 'published',
        importance: 'normal',
        title: 'Demo',
        description: 'Demo page',
        visibility: 'public',
      }
    );
    expect(mocks.insertValues).not.toHaveBeenCalledWith({
      publishedPageId: 'published-1',
      userId: 'user-1',
      userSlug: 'alice',
      pageId: 'demo',
      version: 1,
      eventType: 'published',
      importance: 'normal',
      title: 'Demo',
      description: 'Demo page',
      visibility: 'public',
    });
    expect(mocks.execute).toHaveBeenCalled();
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });

  it('upserts an existing page owned by the current user', async () => {
    mocks.findPublishedPage.mockResolvedValue({
      id: 'published-1',
      uid: 'demo',
      userId: 'user-1',
    });
    mocks.findLatestVersion.mockResolvedValue({
      version: 3,
    });
    mocks.findLatestRecord.mockResolvedValue({
      recordNumber: 8,
    });

    const response = await POST(requestWithBody({
      uid: 'demo',
      title: 'Demo v2',
      description: 'Updated',
      html: '<html><body>Updated</body></html>',
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      page_uid: 'demo',
      url: '/page/alice/demo',
      read_url: '/alice/demo?tab=read',
      updated: true,
    });
    expect(mocks.onConflictDoUpdate).toHaveBeenCalledWith({
      target: ['userId', 'uid'],
      set: {
        title: 'Demo v2',
        icon: null,
        description: 'Updated',
        html: '<html><body>Updated</body></html>',
        currentVersion: 4,
        categoryId: null,
        coverAssetId: null,
        tags: [],
        visibility: 'public',
        moderationStatus: 'approved',
        lastPublishedAt: { type: 'sql', sql: 'now()' },
        versionCount: 4,
        updatedAt: { type: 'sql', sql: 'now()' },
      },
    });
    expect(mocks.insertValues).toHaveBeenCalledWith({
      publishedPageId: 'published-1',
      uid: 'demo',
      userId: 'user-1',
      version: 4,
      title: 'Demo v2',
      icon: null,
      description: 'Updated',
      html: '<html><body>Updated</body></html>',
      categoryId: null,
      coverAssetId: null,
      tags: [],
      visibility: 'public',
      moderationStatus: 'approved',
      publishedAt: expect.any(Date),
    });
    expect(mocks.insertValues).toHaveBeenCalledWith({
      publishedPageId: 'published-1',
      uid: 'demo',
      userId: 'user-1',
      recordNumber: 9,
      version: 4,
      action: 'publish',
      title: 'Demo v2',
      icon: null,
      description: 'Updated',
    });
  });

  it('allows different users to publish the same page uid', async () => {
    mocks.findPublishedPage.mockResolvedValue({
      id: 'published-2',
      uid: 'demo',
      userId: 'user-2',
    });
    mocks.findLatestVersion.mockResolvedValue(null);
    mocks.requireAuth.mockResolvedValue({
      userId: 'user-2',
      username: 'bob',
      userSlug: 'bob_builder',
      email: 'bob@example.com',
      role: 'developer',
      expiresAt: Date.now() + 3600000,
    });

    const response = await POST(requestWithBody({
      uid: 'demo',
      title: 'Bob Demo',
      html: '<html><body>Bob Demo</body></html>',
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      page_uid: 'demo',
      url: '/page/bob_builder/demo',
      read_url: '/bob_builder/demo?tab=read',
      updated: true,
    });
    expect(mocks.insertValues).toHaveBeenCalledWith({
      uid: 'demo',
      userId: 'user-2',
      title: 'Bob Demo',
      icon: null,
      description: null,
      html: '<html><body>Bob Demo</body></html>',
      currentVersion: 1,
      categoryId: null,
      coverAssetId: null,
      tags: [],
      visibility: 'public',
      moderationStatus: 'approved',
      publishedAt: { type: 'sql', sql: 'now()' },
      lastPublishedAt: { type: 'sql', sql: 'now()' },
      versionCount: 1,
    });
  });

  it('rejects an invalid icon payload', async () => {
    const response = await POST(requestWithBody({
      uid: 'demo',
      title: 'Demo',
      icon: 'file-text',
      html: '<html><body>Demo</body></html>',
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'icon must be an object with string type and value',
    });
  });

  it('rejects a cover asset that does not belong to the publisher', async () => {
    mocks.findMediaAsset.mockResolvedValue(null);

    const response = await POST(requestWithBody({
      uid: 'demo',
      title: 'Demo',
      html: '<html><body>Demo</body></html>',
      cover_asset_id: 'asset-from-another-user',
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'cover_asset_id is invalid or not owned by the current user',
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('returns database error details for unexpected publish failures', async () => {
    mocks.onConflictDoUpdate.mockRejectedValue(
      new Error('duplicate key value violates unique constraint "published_pages_user_id_uid_idx"')
    );

    const response = await POST(requestWithBody({
      uid: 'demo',
      title: 'Demo',
      html: '<html><body>Demo</body></html>',
    }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to publish page',
      details:
        'duplicate key value violates unique constraint "published_pages_user_id_uid_idx"',
    });
  });
});
