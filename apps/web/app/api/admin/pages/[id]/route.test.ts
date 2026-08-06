/**
 * Tests for Admin Pages [id] API (GET detail, PATCH moderate, DELETE)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  getSession: vi.fn(),
  createModerationLog: vi.fn(),
  selectResults: [] as any[][],
  selectCallCount: 0,
  AuthError: class AuthError extends Error {
    constructor(message: string, public status = 401) { super(message); this.name = 'AuthError'; }
  },
}));

vi.mock('@/lib/auth', () => ({
  requirePermission: mocks.requirePermission,
  AuthError: mocks.AuthError,
  getSession: mocks.getSession,
}));

vi.mock('@/lib/admin/logs', () => ({
  createModerationLog: mocks.createModerationLog,
}));

function thenable(value: any) {
  const obj: any = {
    then(onFulfilled: any, onRejected?: any) {
      return Promise.resolve(value).then(onFulfilled, onRejected);
    },
  };
  for (const m of ['from', 'where', 'orderBy', 'limit', 'offset', 'leftJoin', 'returning', 'values', 'set']) {
    obj[m] = () => obj;
  }
  return obj;
}

function createSelectChain() {
  mocks.selectCallCount++;
  const result = mocks.selectResults[mocks.selectCallCount - 1] ?? [];
  return { from: vi.fn(() => thenable(result)) };
}

vi.mock('@/lib/db', () => {
  const db = {
    select: vi.fn(createSelectChain),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
  };

  return { db, publishedPages: {}, users: {}, pageSubscriptions: {}, pageUpdateEvents: {} };
});

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field: any, value: any) => ({ type: 'eq', field, value })),
  count: vi.fn(() => ({ type: 'count' })),
  desc: vi.fn((field: any) => ({ type: 'desc', field })),
}));

import { GET, PATCH, DELETE } from './route';

const adminSession = {
  userId: 'admin-1', username: 'admin', userSlug: 'admin',
  email: 'admin@example.com', role: 'moderator', expiresAt: Date.now() + 3600,
};

function params(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

describe('GET /api/admin/pages/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.selectCallCount = 0;
    mocks.selectResults = [
      [{ id: 'page-1', title: 'Test Page', moderationStatus: 'pending', authorUsername: 'user1', html: '<p>content</p>' }],
      [{ value: 5 }],
      [{ version: 1, eventType: 'update', createdAt: new Date().toISOString() }],
    ];
  });

  it('returns 200 with page details and updateEvents', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/pages/page-1`);
    const response = await GET(request, { params: params('page-1') });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.page).toBeDefined();
    expect(json.page.id).toBe('page-1');
    expect(json.subscriberCount).toBe(5);
    expect(json.updateEvents).toBeDefined();
  });

  it('returns 404 when page not found', async () => {
    mocks.selectResults = [[]];
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/pages/nonexistent`);
    const response = await GET(request, { params: params('nonexistent') });
    const json = await response.json();
    expect(response.status).toBe(404);
    expect(json.error).toBe('Page not found');
  });

  it('returns 401 when not authenticated', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/pages/page-1`);
    const response = await GET(request, { params: params('page-1') });
    const json = await response.json();
    expect(response.status).toBe(401);
  });

  it('returns 403 when missing permission', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Missing permission: pages.review', 403));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/pages/page-1`);
    const response = await GET(request, { params: params('page-1') });
    const json = await response.json();
    expect(response.status).toBe(403);
  });
});

describe('PATCH /api/admin/pages/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.getSession.mockResolvedValue(adminSession);
    mocks.createModerationLog.mockResolvedValue(undefined);
  });

  it('approves a page', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/pages/page-1`, {
      method: 'PATCH',
      body: JSON.stringify({ moderation_status: 'approved' }),
    });
    const response = await PATCH(request, { params: params('page-1') });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it('rejects a page with rejection_reason', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/pages/page-1`, {
      method: 'PATCH',
      body: JSON.stringify({ moderation_status: 'rejected', rejection_reason: 'Inappropriate content' }),
    });
    const response = await PATCH(request, { params: params('page-1') });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mocks.createModerationLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'reject',
      entityType: 'published_page',
      reason: 'Inappropriate content',
    }));
  });

  it('hides a page', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/pages/page-1`, {
      method: 'PATCH',
      body: JSON.stringify({ moderation_status: 'hidden' }),
    });
    const response = await PATCH(request, { params: params('page-1') });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mocks.createModerationLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'hide',
    }));
  });

  it('reopens a page (sets to pending, no moderation log for reopen)', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/pages/page-1`, {
      method: 'PATCH',
      body: JSON.stringify({ moderation_status: 'pending' }),
    });
    const response = await PATCH(request, { params: params('page-1') });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    // Pending/reopen should NOT create a moderation log
    expect(mocks.createModerationLog).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid moderation_status', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/pages/page-1`, {
      method: 'PATCH',
      body: JSON.stringify({ moderation_status: 'invalid' }),
    });
    const response = await PATCH(request, { params: params('page-1') });
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid request body');
  });

  it('returns 400 when rejection_reason exceeds max length', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/pages/page-1`, {
      method: 'PATCH',
      body: JSON.stringify({ moderation_status: 'rejected', rejection_reason: 'x'.repeat(501) }),
    });
    const response = await PATCH(request, { params: params('page-1') });
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid request body');
  });

  it('returns 401 when not authenticated', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/pages/page-1`, {
      method: 'PATCH',
      body: JSON.stringify({ moderation_status: 'approved' }),
    });
    const response = await PATCH(request, { params: params('page-1') });
    const json = await response.json();
    expect(response.status).toBe(401);
  });
});

describe('DELETE /api/admin/pages/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.createModerationLog.mockResolvedValue(undefined);
    mocks.selectCallCount = 0;
    mocks.selectResults = [[{ id: 'page-1', title: 'Test Page' }]];
  });

  it('deletes a page and creates moderation log', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/pages/page-1`, { method: 'DELETE' });
    const response = await DELETE(request, { params: params('page-1') });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mocks.createModerationLog).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'published_page',
      action: 'delete',
    }));
  });

  it('returns 404 when page not found', async () => {
    mocks.selectResults = [[]];
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/pages/nonexistent`, { method: 'DELETE' });
    const response = await DELETE(request, { params: params('nonexistent') });
    const json = await response.json();
    expect(response.status).toBe(404);
    expect(json.error).toBe('Page not found');
  });

  it('returns 401 when not authenticated', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/pages/page-1`, { method: 'DELETE' });
    const response = await DELETE(request, { params: params('page-1') });
    const json = await response.json();
    expect(response.status).toBe(401);
  });
});
