/**
 * Tests for Admin Operations Revisions API
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
let _insertResult: any[] = [];

vi.mock('@/lib/auth', () => ({
  requirePermission: mocks.requirePermission,
  AuthError: mocks.AuthError,
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field: any, value: any) => ({ type: 'eq', field, value })),
  and: vi.fn((...conditions: any[]) => ({ type: 'and', conditions })),
  desc: vi.fn((field: any) => ({ type: 'desc', field })),
  asc: vi.fn((field: any) => ({ type: 'asc', field })),
}));

vi.mock('@/lib/db', () => {
  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => thenable(_selectResult)),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => thenable(_insertResult)),
      })),
    })),
  };

  return { db, operationRevisions: {}, operationSlots: {}, operationItems: {} };
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

describe('GET /api/admin/operations/revisions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _selectResult = [];
    mocks.requirePermission.mockResolvedValue(adminSession);
  });

  it('lists revisions with surface and locale params', async () => {
    _selectResult = [
      { id: 'rev-1', uid: 'rev_home_default_1_xxx', surface: 'home', locale: 'default', revisionNumber: 2, status: 'published', publishedAt: new Date(), publishedBy: 'admin-1', createdBy: 'admin-1', createdAt: new Date() },
      { id: 'rev-2', uid: 'rev_home_default_0_yyy', surface: 'home', locale: 'default', revisionNumber: 1, status: 'draft', publishedAt: null, publishedBy: null, createdBy: 'admin-1', createdAt: new Date() },
    ];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/operations/revisions?surface=home&locale=default`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.revisions).toHaveLength(2);
    expect(json.revisions[0].revisionNumber).toBe(2);
    expect(json.revisions[1].revisionNumber).toBe(1);
  });

  it('returns 400 when surface param is missing', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/operations/revisions?locale=default`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain('surface');
  });

  it('returns 400 when locale param is missing', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/operations/revisions?surface=home`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain('locale');
  });

  it('returns 400 when both params are missing', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/operations/revisions`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain('surface');
  });

  it('returns 401 when permission denied', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/operations/revisions?surface=home&locale=default`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Authentication required');
  });

  it('returns empty list when no revisions exist', async () => {
    _selectResult = [];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/operations/revisions?surface=home&locale=default`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.revisions).toHaveLength(0);
  });
});

describe('POST /api/admin/operations/revisions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _selectResult = [];
    mocks.requirePermission.mockResolvedValue(adminSession);
  });

  it('creates a new revision', async () => {
    _selectResult = [];
    _insertResult = [{
      id: 'new-rev',
      uid: 'rev_home_default_1_abc12345',
      surface: 'home',
      locale: 'default',
      revisionNumber: 1,
      status: 'draft',
      snapshot: { slots: [] },
    }];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/operations/revisions`, {
      method: 'POST',
      body: JSON.stringify({ surface: 'home', locale: 'default' }),
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.revision.id).toBe('new-rev');
    expect(json.revision.surface).toBe('home');
    expect(json.revision.locale).toBe('default');
    expect(json.revision.status).toBe('draft');
  });

  it('returns 400 for missing surface', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/operations/revisions`, {
      method: 'POST',
      body: JSON.stringify({ locale: 'default' }),
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid request body');
  });

  it('returns 400 for empty surface', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/operations/revisions`, {
      method: 'POST',
      body: JSON.stringify({ surface: '', locale: 'default' }),
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid request body');
  });

  it('returns 401 when permission denied', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/operations/revisions`, {
      method: 'POST',
      body: JSON.stringify({ surface: 'home', locale: 'default' }),
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Authentication required');
  });

  it('returns 403 when missing permission', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Missing permission: operations.manage', 403));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/operations/revisions`, {
      method: 'POST',
      body: JSON.stringify({ surface: 'home', locale: 'default' }),
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe('Missing permission: operations.manage');
  });
});
