/**
 * Tests for Admin Shares [id] API (GET/PATCH/DELETE)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createModerationLog: vi.fn(),
  AuthError: class AuthError extends Error {
    constructor(message: string, public status = 401) { super(message); this.name = 'AuthError'; }
  },
}));

vi.mock('@/lib/auth', () => ({
  requirePermission: mocks.requirePermission,
  AuthError: mocks.AuthError,
}));

vi.mock('@/lib/admin/logs', () => ({
  createModerationLog: mocks.createModerationLog,
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field: any, value: any) => ({ type: 'eq', field, value })),
}));

let _findFirstResult: any = null;
let _selectResult: any[] = [];

vi.mock('@/lib/db', () => {
  function thenable(value: any) {
    const obj: any = {
      then(onFulfilled: any, onRejected?: any) {
        return Promise.resolve(value).then(onFulfilled, onRejected);
      },
    };
    for (const m of ['from', 'where', 'orderBy', 'limit', 'offset', 'leftJoin', 'returning', 'values', 'fieldConfiguration']) {
      obj[m] = () => obj;
    }
    return obj;
  }

  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        leftJoin: vi.fn(() => ({
          where: vi.fn(() => thenable(_selectResult)),
        })),
      })),
    })),
    query: {
      shareLinks: {
        findFirst: vi.fn(() => Promise.resolve(_findFirstResult)),
      },
    },
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
  };

  return { db, shareLinks: {}, users: {} };
});

import { GET, PATCH, DELETE } from './route';

const adminSession = {
  userId: 'admin-1',
  username: 'admin',
  userSlug: 'admin',
  email: 'admin@example.com',
  role: 'moderator',
  expiresAt: Date.now() + 3600000,
};

function params(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

describe('GET /api/admin/shares/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
  });

  it('returns share link detail', async () => {
    _selectResult = [{
      id: 'share-1', uid: 'abc123', entityType: 'published_page', entityId: 'page-1',
      visibilitySnapshot: { privacy: 'public' }, channel: 'copy_link',
      targetUrl: 'https://example.com/share/abc123', htmlDirectUrl: 'https://example.com/page',
      expiresAt: new Date('3026-01-15T00:00:00Z'), revokedAt: null,
      openCount: 10, uniqueOpenCount: 5,
      createdAt: new Date('2025-01-15T10:00:00Z'), updatedAt: new Date('2025-01-15T10:00:00Z'),
      createdByUserId: 'user-1', createdByUsername: 'alice', createdByDisplayName: 'Alice',
    }];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/shares/share-1`);
    const response = await GET(request, { params: params('share-1') });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.id).toBe('share-1');
    expect(json.uid).toBe('abc123');
    expect(json.htmlDirectUrl).toBe('https://example.com/page');
    expect(json.expiresAt).toBeDefined();
    expect(json.status).toBe('active');
    expect(json.createdBy).toEqual({ userId: 'user-1', username: 'alice', displayName: 'Alice' });
  });

  it('returns status=expired for past expiry date', async () => {
    _selectResult = [{
      id: 'share-2', uid: 'def456', entityType: 'published_page', entityId: 'page-2',
      visibilitySnapshot: null, channel: 'copy_link',
      targetUrl: 'https://example.com/share/def456', htmlDirectUrl: 'https://example.com/page2',
      expiresAt: new Date('2020-01-01T00:00:00Z'), revokedAt: null,
      openCount: 1, uniqueOpenCount: 1,
      createdAt: new Date('2019-01-01T00:00:00Z'), updatedAt: new Date('2019-01-01T00:00:00Z'),
      createdByUserId: null, createdByUsername: null, createdByDisplayName: null,
    }];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/shares/share-2`);
    const response = await GET(request, { params: params('share-2') });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.status).toBe('expired');
  });

  it('returns status=revoked for revoked share', async () => {
    _selectResult = [{
      id: 'share-3', uid: 'ghi789', entityType: 'published_page', entityId: 'page-3',
      visibilitySnapshot: null, channel: 'copy_link',
      targetUrl: 'https://example.com/share/ghi789', htmlDirectUrl: 'https://example.com/page3',
      expiresAt: null, revokedAt: new Date('2025-06-01T00:00:00Z'),
      openCount: 0, uniqueOpenCount: 0,
      createdAt: new Date('2025-01-01T00:00:00Z'), updatedAt: new Date('2025-06-01T00:00:00Z'),
      createdByUserId: 'user-1', createdByUsername: 'alice', createdByDisplayName: 'Alice',
    }];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/shares/share-3`);
    const response = await GET(request, { params: params('share-3') });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.status).toBe('revoked');
  });

  it('returns 404 when share not found', async () => {
    _selectResult = [];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/shares/nonexistent`);
    const response = await GET(request, { params: params('nonexistent') });
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe('Share link not found');
  });

  it('returns 401 when not authenticated', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/shares/share-1`);
    const response = await GET(request, { params: params('share-1') });
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Authentication required');
  });
});

describe('PATCH /api/admin/shares/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.createModerationLog.mockResolvedValue('log-1');
    _findFirstResult = {
      id: 'share-1',
      uid: 'abc123',
      entityType: 'published_page',
      entityId: 'page-1',
      revokedAt: null,
    };
  });

  it('revokes a share link and creates moderation log', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/shares/share-1`, {
      method: 'PATCH',
    });
    const response = await PATCH(request, { params: params('share-1') });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.revokedAt).toBeDefined();
    expect(mocks.createModerationLog).toHaveBeenCalledWith({
      adminId: 'admin-1',
      entityType: 'share',
      entityId: 'share-1',
      action: 'revoke',
      reason: 'Share link revoked by admin',
    });
  });

  it('returns 404 when share not found', async () => {
    _findFirstResult = undefined;

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/shares/nonexistent`, {
      method: 'PATCH',
    });
    const response = await PATCH(request, { params: params('nonexistent') });
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe('Share link not found');
    expect(mocks.createModerationLog).not.toHaveBeenCalled();
  });

  it('returns 409 when share already revoked', async () => {
    _findFirstResult = {
      id: 'share-1',
      uid: 'abc123',
      entityType: 'published_page',
      entityId: 'page-1',
      revokedAt: new Date('2025-06-01T00:00:00Z'),
    };

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/shares/share-1`, {
      method: 'PATCH',
    });
    const response = await PATCH(request, { params: params('share-1') });
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.error).toBe('Share link already revoked');
    expect(mocks.createModerationLog).not.toHaveBeenCalled();
  });

  it('returns 401 when not authenticated', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/shares/share-1`, {
      method: 'PATCH',
    });
    const response = await PATCH(request, { params: params('share-1') });
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Authentication required');
    expect(mocks.createModerationLog).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/admin/shares/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.createModerationLog.mockResolvedValue('log-1');
    _findFirstResult = {
      id: 'share-1',
      uid: 'abc123',
      entityType: 'published_page',
      entityId: 'page-1',
    };
  });

  it('hard deletes a share link and creates moderation log', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/shares/share-1`, {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: params('share-1') });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mocks.createModerationLog).toHaveBeenCalledWith({
      adminId: 'admin-1',
      entityType: 'share',
      entityId: 'share-1',
      action: 'delete',
      reason: 'Share link permanently deleted by admin',
    });
  });

  it('returns 404 when share not found', async () => {
    _findFirstResult = undefined;

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/shares/nonexistent`, {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: params('nonexistent') });
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe('Share link not found');
    expect(mocks.createModerationLog).not.toHaveBeenCalled();
  });

  it('returns 401 when not authenticated', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/shares/share-1`, {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: params('share-1') });
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Authentication required');
    expect(mocks.createModerationLog).not.toHaveBeenCalled();
  });

  it('returns 403 when missing permission', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Missing permission: content.delete', 403));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/shares/share-1`, {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: params('share-1') });
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe('Missing permission: content.delete');
    expect(mocks.createModerationLog).not.toHaveBeenCalled();
  });
});
