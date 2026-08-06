/**
 * Tests for Admin Notifications list API
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
  isNull: vi.fn((field: any) => ({ type: 'isNull', field })),
  isNotNull: vi.fn((field: any) => ({ type: 'isNotNull', field })),
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

  return { db, notifications: {}, users: {} };
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

describe('GET /api/admin/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _selectResult = [];
    _countResult = [];
    mocks.requirePermission.mockResolvedValue(adminSession);
  });

  it('returns paginated notifications list', async () => {
    _countResult = [{ count: 2 }];
    _selectResult = [
      { id: 'notif-1', type: 'comment', title: 'New comment', body: 'Someone commented on your page', readAt: null, createdAt: new Date('2025-01-15T10:00:00Z'), recipientId: 'user-1', recipientName: 'Alice', actorName: 'Bob', pageUid: 'page-uid-1', pageAuthorSlug: 'bob' },
      { id: 'notif-2', type: 'like', title: 'New like', body: 'Someone liked your page', readAt: new Date('2025-01-14T10:00:00Z'), createdAt: new Date('2025-01-14T10:00:00Z'), recipientId: 'user-2', recipientName: 'Charlie', actorName: 'Alice', pageUid: null, pageAuthorSlug: null },
    ];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/notifications?page=1&limit=20`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.notifications).toHaveLength(2);
    expect(json.notifications[0].id).toBe('notif-1');
    expect(json.notifications[0].type).toBe('comment');
    expect(json.notifications[1].readAt).toBeDefined();
    expect(json.pagination.total).toBe(2);
  });

  it('filters by type', async () => {
    _countResult = [{ count: 1 }];
    _selectResult = [{ id: 'notif-1', type: 'comment', title: 'New comment', body: 'Someone commented', readAt: null, createdAt: new Date('2025-01-15T10:00:00Z'), recipientId: 'user-1', recipientName: 'Alice', actorName: 'Bob', pageUid: 'page-uid-1', pageAuthorSlug: 'bob' }];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/notifications?type=comment`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.notifications).toHaveLength(1);
    expect(json.notifications[0].type).toBe('comment');
  });

  it('filters by read_status=read', async () => {
    _countResult = [{ count: 1 }];
    _selectResult = [{ id: 'notif-2', type: 'like', title: 'New like', body: 'Someone liked your page', readAt: new Date('2025-01-14T10:00:00Z'), createdAt: new Date('2025-01-14T10:00:00Z'), recipientId: 'user-2', recipientName: 'Charlie', actorName: 'Alice', pageUid: null, pageAuthorSlug: null }];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/notifications?read_status=read`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.notifications).toHaveLength(1);
    expect(json.notifications[0].readAt).toBeDefined();
  });

  it('filters by read_status=unread', async () => {
    _countResult = [{ count: 1 }];
    _selectResult = [{ id: 'notif-1', type: 'comment', title: 'New comment', body: 'Someone commented', readAt: null, createdAt: new Date('2025-01-15T10:00:00Z'), recipientId: 'user-1', recipientName: 'Alice', actorName: 'Bob', pageUid: 'page-uid-1', pageAuthorSlug: 'bob' }];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/notifications?read_status=unread`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.notifications).toHaveLength(1);
    expect(json.notifications[0].readAt).toBeNull();
  });

  it('returns 401 when not authenticated', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/notifications`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Authentication required');
  });

  it('returns 403 when missing permission', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Missing permission: users.view', 403));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/notifications`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe('Missing permission: users.view');
  });

  it('returns 400 for invalid read_status value', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/notifications?read_status=invalid`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
  });

  it('returns 400 when page is less than 1', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/notifications?page=0`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
  });

  it('returns 400 when limit exceeds 50', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/notifications?limit=51`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
  });

  it('returns 200 with empty notifications array and zero pagination', async () => {
    _countResult = [{ count: 0 }];
    _selectResult = [];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/notifications`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.notifications).toEqual([]);
    expect(json.pagination.total).toBe(0);
    expect(json.pagination.totalPages).toBe(0);
  });
});
