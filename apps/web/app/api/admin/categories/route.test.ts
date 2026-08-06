/**
 * Tests for Admin Categories list/create API
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
  asc: vi.fn((field: any) => ({ type: 'asc', field })),
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

  return { db, pageCategories: {}, publishedPages: {} };
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

describe('GET /api/admin/categories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _selectResult = [];
    _countResult = [];
    mocks.requirePermission.mockResolvedValue(adminSession);
  });

  it('returns paginated categories list', async () => {
    _countResult = [{ count: 2 }];
    _selectResult = [
      { id: 'cat-1', slug: 'tech', name: 'Technology', description: 'Tech stuff', isActive: true, sortOrder: 0 },
      { id: 'cat-2', slug: 'design', name: 'Design', description: null, isActive: true, sortOrder: 1 },
    ];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/categories?page=1&limit=10`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.categories).toHaveLength(2);
    expect(json.pagination.total).toBe(2);
    expect(json.pagination.page).toBe(1);
    expect(json.pagination.limit).toBe(10);
  });

  it('filters by status=active', async () => {
    _countResult = [{ count: 1 }];
    _selectResult = [{ id: 'cat-1', slug: 'tech', name: 'Technology', isActive: true, sortOrder: 0 }];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/categories?status=active`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.categories).toHaveLength(1);
    expect(json.pagination.total).toBe(1);
  });

  it('filters by status=inactive', async () => {
    _countResult = [{ count: 0 }];
    _selectResult = [];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/categories?status=inactive`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.pagination.total).toBe(0);
  });

  it('filters by search query (ilike name/slug)', async () => {
    _countResult = [{ count: 1 }];
    _selectResult = [{ id: 'cat-1', slug: 'tech', name: 'Technology', isActive: true, sortOrder: 0 }];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/categories?search=tech`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.categories).toHaveLength(1);
  });

  it('returns 401 when permission denied', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/categories`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Authentication required');
  });

  it('returns 403 when missing permission', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Missing permission: categories.manage', 403));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/categories`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe('Missing permission: categories.manage');
  });

  it('returns 400 for invalid query parameters', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/categories?status=invalid`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
  });

  it('returns 400 for page less than 1', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/categories?page=0`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
  });

  it('returns 400 for limit exceeding 50', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/categories?limit=100`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
  });
});

describe('POST /api/admin/categories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _insertResult = [{ id: 'new-cat', slug: 'new-category', name: 'New Category', description: null, isActive: true, sortOrder: 0 }];
    mocks.requirePermission.mockResolvedValue(adminSession);
  });

  it('creates a new category', async () => {
    _selectResult = []; // No duplicate

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/categories`, {
      method: 'POST',
      body: JSON.stringify({
        slug: 'new-category',
        name: 'New Category',
        description: 'A new test category',
        sort_order: 0,
        is_active: true,
      }),
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.category.id).toBe('new-cat');
    expect(json.category.slug).toBe('new-category');
    expect(json.category.name).toBe('New Category');
  });

  it('returns 409 for duplicate slug', async () => {
    _selectResult = [{ id: 'existing' }];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/categories`, {
      method: 'POST',
      body: JSON.stringify({ slug: 'existing-slug', name: 'Duplicate' }),
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.error).toContain('已存在');
  });

  it('returns 401 when permission denied', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/categories`, {
      method: 'POST',
      body: JSON.stringify({ slug: 'test', name: 'Test' }),
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Authentication required');
  });

  it('returns 400 for missing required fields', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/categories`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid request body');
  });

  it('returns 400 for empty slug', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/categories`, {
      method: 'POST',
      body: JSON.stringify({ slug: '', name: 'Test' }),
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid request body');
  });
});
