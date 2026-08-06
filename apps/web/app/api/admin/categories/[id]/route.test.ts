/**
 * Tests for Admin Categories [id] API (GET/PATCH/DELETE by ID)
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
let _updateResult: any[] = [];

vi.mock('@/lib/auth', () => ({
  requirePermission: mocks.requirePermission,
  AuthError: mocks.AuthError,
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field: any, value: any) => ({ type: 'eq', field, value })),
}));

vi.mock('@/lib/db', () => {
  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => thenable(_selectResult)),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => thenable(_updateResult)),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
  };

  return { db, pageCategories: {}, publishedPages: {} };
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

describe('GET /api/admin/categories/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
  });

  it('returns a single category by ID', async () => {
    _selectResult = [{ id: 'cat-1', slug: 'tech', name: 'Technology', description: 'Desc', isActive: true, sortOrder: 0 }];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/categories/cat-1`);
    const response = await GET(request, { params: params('cat-1') });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.category.id).toBe('cat-1');
    expect(json.category.slug).toBe('tech');
    expect(json.category.name).toBe('Technology');
  });

  it('returns 404 when category not found', async () => {
    _selectResult = [];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/categories/nonexistent`);
    const response = await GET(request, { params: params('nonexistent') });
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe('Category not found');
  });

  it('returns 401 when permission denied', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/categories/cat-1`);
    const response = await GET(request, { params: params('cat-1') });
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Authentication required');
  });
});

describe('PATCH /api/admin/categories/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
  });

  it('updates a category name', async () => {
    _updateResult = [{ id: 'cat-1', slug: 'tech', name: 'Updated Name', description: null, isActive: true, sortOrder: 0 }];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/categories/cat-1`, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated Name' }),
    });
    const response = await PATCH(request, { params: params('cat-1') });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.category.name).toBe('Updated Name');
  });

  it('toggles is_active status', async () => {
    _updateResult = [{ id: 'cat-1', slug: 'tech', name: 'Technology', isActive: false, sortOrder: 0 }];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/categories/cat-1`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: false }),
    });
    const response = await PATCH(request, { params: params('cat-1') });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.category.isActive).toBe(false);
  });

  it('returns 404 when updating non-existent category', async () => {
    _updateResult = [];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/categories/nonexistent`, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Test' }),
    });
    const response = await PATCH(request, { params: params('nonexistent') });
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe('Category not found');
  });

  it('returns 400 for invalid request body', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/categories/cat-1`, {
      method: 'PATCH',
      body: JSON.stringify({ name: '' }),
    });
    const response = await PATCH(request, { params: params('cat-1') });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid request body');
  });

  it('returns 401 when permission denied', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Missing permission: categories.manage', 403));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/categories/cat-1`, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Test' }),
    });
    const response = await PATCH(request, { params: params('cat-1') });
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe('Missing permission: categories.manage');
  });
});

describe('DELETE /api/admin/categories/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
  });

  it('deletes a category with no referenced pages', async () => {
    _selectResult = []; // No referenced pages

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/categories/cat-1`, {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: params('cat-1') });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it('returns 409 when category has referenced pages', async () => {
    _selectResult = [{ id: 'page-1' }];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/categories/cat-1`, {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: params('cat-1') });
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.error).toContain('已发布页面');
  });

  it('returns 401 when permission denied', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/categories/cat-1`, {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: params('cat-1') });
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Authentication required');
  });
});
