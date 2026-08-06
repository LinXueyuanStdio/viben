/**
 * Tests for Admin Topics list/create API
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
  for (const m of ['from', 'where', 'orderBy', 'limit', 'offset', 'returning', 'values', 'set']) {
    obj[m] = () => obj;
  }
  return obj;
}

let _selectResult: any[] = [];
let _countResult: any[] = [];
let _insertResult: any[] = [];

vi.mock('@/lib/auth', () => ({
  requirePermission: mocks.requirePermission,
  AuthError: mocks.AuthError,
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field: any, value: any) => ({ type: 'eq', field, value })),
  and: vi.fn((...conditions: any[]) => ({ type: 'and', conditions })),
  or: vi.fn((...conditions: any[]) => ({ type: 'or', conditions })),
  ilike: vi.fn((field: any, pattern: any) => ({ type: 'ilike', field, pattern })),
  count: vi.fn(() => ({ type: 'count' })),
  desc: vi.fn((field: any) => ({ type: 'desc', field })),
}));

vi.mock('@/lib/db', () => {
  const db = {
    select: vi.fn((...args: any[]) => {
      const isCount = args[0]?.count?.type === 'count';
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => thenable(isCount ? _countResult : _selectResult)),
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => ({
              offset: vi.fn(() => thenable(_selectResult)),
            })),
          })),
        })),
      };
    }),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => thenable(_insertResult)),
      })),
    })),
  };

  return { db, momentTopics: {} };
});

import { GET, POST } from './route';

const adminSession = {
  userId: 'admin-1',
  username: 'admin',
  userSlug: 'admin',
  email: 'admin@example.com',
  role: 'moderator',
  expiresAt: Date.now() + 3600000,
};

describe('GET /api/admin/topics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _selectResult = [];
    _countResult = [];
    mocks.requirePermission.mockResolvedValue(adminSession);
  });

  it('returns paginated topics list', async () => {
    _countResult = [{ count: 2 }];
    _selectResult = [
      { id: 'topic-1', slug: 'ai', displayName: 'AI', description: null, isFeatured: false, isBlocked: false, momentCount: 10 },
      { id: 'topic-2', slug: 'web', displayName: 'Web Dev', description: null, isFeatured: true, isBlocked: false, momentCount: 5 },
    ];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/topics?page=1&limit=20`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.topics).toHaveLength(2);
    expect(json.pagination.total).toBe(2);
  });

  it('filters by filter=featured', async () => {
    _countResult = [{ count: 1 }];
    _selectResult = [{ id: 'topic-2', slug: 'web', displayName: 'Web Dev', isFeatured: true, isBlocked: false, momentCount: 5 }];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/topics?filter=featured`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.topics).toHaveLength(1);
  });

  it('filters by filter=blocked', async () => {
    _countResult = [{ count: 0 }];
    _selectResult = [];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/topics?filter=blocked`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.pagination.total).toBe(0);
  });

  it('filters by search query', async () => {
    _countResult = [{ count: 1 }];
    _selectResult = [{ id: 'topic-1', slug: 'ai', displayName: 'AI', isFeatured: false, isBlocked: false, momentCount: 10 }];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/topics?search=ai`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.topics).toHaveLength(1);
  });

  it('returns 401 when not authenticated', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/topics`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Authentication required');
  });

  it('returns 403 when missing permission', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Missing permission: topics.manage', 403));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/topics`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe('Missing permission: topics.manage');
  });

  it('returns 400 for invalid filter value', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/topics?filter=invalid`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
  });
});

describe('POST /api/admin/topics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
  });

  it('creates a new topic', async () => {
    _selectResult = []; // No duplicate
    _insertResult = [{ id: 'new-topic', slug: 'new-topic', displayName: 'New Topic', description: null, isFeatured: false, isBlocked: false }];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/topics`, {
      method: 'POST',
      body: JSON.stringify({ slug: 'new-topic', display_name: 'New Topic', description: 'A test topic' }),
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.topic.id).toBe('new-topic');
    expect(json.topic.slug).toBe('new-topic');
  });

  it('creates a featured topic', async () => {
    _selectResult = [];
    _insertResult = [{ id: 'featured-topic', slug: 'featured', displayName: 'Featured Topic', isFeatured: true, isBlocked: false }];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/topics`, {
      method: 'POST',
      body: JSON.stringify({ slug: 'featured', display_name: 'Featured Topic', is_featured: true }),
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.topic.isFeatured).toBe(true);
  });

  it('returns 409 for duplicate slug', async () => {
    _selectResult = [{ id: 'existing' }];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/topics`, {
      method: 'POST',
      body: JSON.stringify({ slug: 'duplicate', display_name: 'Duplicate' }),
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.error).toContain('已存在');
  });

  it('returns 400 for missing required fields', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/topics`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid request body');
  });

  it('returns 401 when permission denied', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/topics`, {
      method: 'POST',
      body: JSON.stringify({ slug: 'test', display_name: 'Test' }),
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Authentication required');
  });
});
