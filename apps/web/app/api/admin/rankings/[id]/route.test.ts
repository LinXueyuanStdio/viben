/**
 * Tests for Admin Rankings [id] API (GET detail, DELETE snapshot)
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

vi.mock('@/lib/auth', () => ({
  requirePermission: mocks.requirePermission,
  AuthError: mocks.AuthError,
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field: any, value: any) => ({ type: 'eq', field, value })),
  asc: vi.fn((field: any) => ({ type: 'asc', field })),
}));

vi.mock('@/lib/db', () => {
  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => thenable(_selectResult)),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => thenable(undefined)),
    })),
  };

  return { db, rankingSnapshots: {}, rankingItems: {} };
});

import { GET, DELETE } from './route';

const supportSession = {
  userId: 'staff-1',
  username: 'staff',
  userSlug: 'staff',
  email: 'staff@example.com',
  role: 'support',
  expiresAt: Date.now() + 3600000,
};

const moderatorSession = {
  userId: 'mod-1',
  username: 'mod',
  userSlug: 'mod',
  email: 'mod@example.com',
  role: 'moderator',
  expiresAt: Date.now() + 3600000,
};

function params(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

describe('GET /api/admin/rankings/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(supportSession);
  });

  it('returns snapshot detail with items', async () => {
    _selectResult = [{ id: 'snap-1', rankingKey: 'published_page_7d', entityType: 'published_page', timeWindow: '7d', status: 'ready', itemCount: 2, createdAt: new Date() }];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/rankings/snap-1`);
    const response = await GET(request, { params: params('snap-1') });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.snapshot.id).toBe('snap-1');
    expect(json.snapshot.status).toBe('ready');
    expect(json.items).toBeDefined();
  });

  it('returns 404 when snapshot not found', async () => {
    _selectResult = [];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/rankings/nonexistent`);
    const response = await GET(request, { params: params('nonexistent') });
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe('Snapshot not found');
  });

  it('returns 401 when authentication required', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/rankings/snap-1`);
    const response = await GET(request, { params: params('snap-1') });
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Authentication required');
  });

  it('returns 403 when missing permission', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Missing permission: rankings.view', 403));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/rankings/snap-1`);
    const response = await GET(request, { params: params('snap-1') });
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe('Missing permission: rankings.view');
  });
});

describe('DELETE /api/admin/rankings/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(moderatorSession);
  });

  it('deletes a ranking snapshot', async () => {
    _selectResult = [{ id: 'snap-1' }];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/rankings/snap-1`, {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: params('snap-1') });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.message).toBe('Snapshot deleted');
  });

  it('returns 404 when snapshot not found for DELETE', async () => {
    _selectResult = [];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/rankings/nonexistent`, {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: params('nonexistent') });
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe('Snapshot not found');
  });

  it('returns 403 when missing rankings.manage permission', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Missing permission: rankings.manage', 403));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/rankings/snap-1`, {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: params('snap-1') });
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe('Missing permission: rankings.manage');
  });
});
