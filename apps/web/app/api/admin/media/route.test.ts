/**
 * Tests for Admin Media list API
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  AuthError: class AuthError extends Error {
    constructor(message: string, public status = 401) { super(message); this.name = 'AuthError'; }
  },
}));

function thenable(value: any) {
  const obj: any = {
    then(onFulfilled: any, onRejected?: any) {
      return Promise.resolve(value).then(onFulfilled, onRejected);
    },
  };
  for (const m of ['from', 'where', 'orderBy', 'limit', 'offset', 'leftJoin']) {
    obj[m] = () => obj;
  }
  return obj;
}

let _countResult: any[] = [];
let _selectResult: any[] = [];

vi.mock('@/lib/auth', () => ({
  requirePermission: mocks.requirePermission,
  AuthError: mocks.AuthError,
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field: any, value: any) => ({ type: 'eq', field, value })),
  desc: vi.fn((field: any) => ({ type: 'desc', field })),
  count: vi.fn(() => ({ type: 'count' })),
  and: vi.fn((...conditions: any[]) => ({ type: 'and', conditions })),
}));

vi.mock('@/lib/db', () => {
  const db = {
    select: vi.fn((...args: any[]) => {
      const isCount = args[0]?.count?.type === 'count';
      return {
        from: vi.fn(() => ({
          leftJoin: vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn(() => ({
                limit: vi.fn(() => ({
                  offset: vi.fn(() => thenable(isCount ? _countResult : _selectResult)),
                })),
              })),
            })),
          })),
          where: vi.fn(() => thenable(isCount ? _countResult : _selectResult)),
        })),
      };
    }),
  };

  return { db, mediaAssets: {}, users: {} };
});

import { GET } from './route';

const adminSession = {
  userId: 'admin-1',
  username: 'admin',
  userSlug: 'admin',
  email: 'admin@example.com',
  role: 'moderator',
  expiresAt: Date.now() + 3600000,
};

describe('GET /api/admin/media', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _selectResult = [];
    _countResult = [];
    mocks.requirePermission.mockResolvedValue(adminSession);
  });

  it('returns paginated media assets list', async () => {
    _countResult = [{ count: 2 }];
    _selectResult = [
      {
        id: 'asset-1', kind: 'image', source: 'object_storage', url: 'https://example.com/img1.png',
        thumbnailUrl: null, mimeType: 'image/png', width: 800, height: 600, sizeBytes: 102400,
        altText: 'test image', metadata: null, createdAt: new Date('2025-01-15T10:00:00Z'),
        ownerUserId: 'user-1', ownerUsername: 'alice', ownerDisplayName: 'Alice', ownerAvatarUrl: null,
      },
      {
        id: 'asset-2', kind: 'video', source: 'external_url', url: 'https://example.com/video1.mp4',
        thumbnailUrl: 'https://example.com/thumb.jpg', mimeType: 'video/mp4', width: 1920, height: 1080,
        sizeBytes: 5120000, altText: null, metadata: null, createdAt: new Date('2025-01-14T10:00:00Z'),
        ownerUserId: null, ownerUsername: null, ownerDisplayName: null, ownerAvatarUrl: null,
      },
    ];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/media?page=1&limit=20`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.assets).toHaveLength(2);
    expect(json.assets[0].id).toBe('asset-1');
    expect(json.assets[0].kind).toBe('image');
    expect(json.assets[0].owner).toEqual({ id: 'user-1', username: 'alice', displayName: 'Alice', avatarUrl: null });
    expect(json.assets[1].owner).toBeNull();
    expect(json.pagination.total).toBe(2);
    expect(json.pagination.totalPages).toBe(1);
  });

  it('filters by kind', async () => {
    _countResult = [{ count: 1 }];
    _selectResult = [{ id: 'asset-1', kind: 'image', source: 'generated', url: 'https://example.com/img.png', thumbnailUrl: null, mimeType: 'image/png', width: 400, height: 300, sizeBytes: 51200, altText: null, metadata: null, createdAt: new Date('2025-01-15T10:00:00Z'), ownerUserId: null, ownerUsername: null, ownerDisplayName: null, ownerAvatarUrl: null }];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/media?kind=image`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.assets).toHaveLength(1);
    expect(json.assets[0].kind).toBe('image');
  });

  it('filters by source', async () => {
    _countResult = [{ count: 1 }];
    _selectResult = [{ id: 'asset-1', kind: 'document', source: 'object_storage', url: 'https://example.com/doc.pdf', thumbnailUrl: null, mimeType: 'application/pdf', width: null, height: null, sizeBytes: 204800, altText: null, metadata: null, createdAt: new Date('2025-01-15T10:00:00Z'), ownerUserId: null, ownerUsername: null, ownerDisplayName: null, ownerAvatarUrl: null }];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/media?source=object_storage`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.assets).toHaveLength(1);
    expect(json.assets[0].source).toBe('object_storage');
  });

  it('filters by mime_type', async () => {
    _countResult = [{ count: 1 }];
    _selectResult = [{ id: 'asset-1', kind: 'image', source: 'generated', url: 'https://example.com/img.png', thumbnailUrl: null, mimeType: 'image/svg+xml', width: 100, height: 100, sizeBytes: 2048, altText: null, metadata: null, createdAt: new Date('2025-01-15T10:00:00Z'), ownerUserId: null, ownerUsername: null, ownerDisplayName: null, ownerAvatarUrl: null }];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/media?mime_type=image%2Fsvg%2Bxml`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.assets).toHaveLength(1);
  });

  it('returns 401 when not authenticated', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/media`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Authentication required');
  });

  it('returns 403 when missing permission', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Missing permission: content.moderate', 403));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/media`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe('Missing permission: content.moderate');
  });

  it('returns 400 for invalid source value', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/media?source=invalid`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
  });

  it('returns 400 when page is less than 1', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/media?page=0`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
  });

  it('returns 400 when limit exceeds 100', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/media?limit=101`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
  });

  it('returns 200 with empty list and zero pagination', async () => {
    _countResult = [{ count: 0 }];
    _selectResult = [];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/media`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.assets).toEqual([]);
    expect(json.pagination.total).toBe(0);
    expect(json.pagination.totalPages).toBe(0);
  });
});
