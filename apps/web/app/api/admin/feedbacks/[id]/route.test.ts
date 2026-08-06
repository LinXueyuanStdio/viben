/**
 * Tests for Admin Feedback [id] API (GET detail, DELETE)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createModerationLog: vi.fn(),
  selectResults: [] as any[][],
  selectCallCount: 0,
  queryFindFirstResult: null as any,
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
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
    query: {
      feedbacks: {
        findFirst: vi.fn(() => Promise.resolve(mocks.queryFindFirstResult)),
      },
    },
  };
  return { db, feedbacks: {}, users: {} };
});

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field: any, value: any) => ({ type: 'eq', field, value })),
}));

import { GET, DELETE } from './route';

const adminSession = {
  userId: 'admin-1', username: 'admin', userSlug: 'admin',
  email: 'admin@example.com', role: 'moderator', expiresAt: Date.now() + 3600,
};

function params(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

const mockFeedback = {
  id: 'fb-1', pageId: 'page-1', category: 'bug', rating: 3,
  content: 'Found a critical bug in the UI',
  reporterId: 'u1', reporterName: 'user1', reporterDisplayName: 'User One',
  createdAt: new Date().toISOString(),
};

describe('GET /api/admin/feedbacks/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.selectCallCount = 0;
    mocks.selectResults = [[mockFeedback]];
  });

  it('returns 200 with feedback detail', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/feedbacks/fb-1`);
    const response = await GET(request, { params: params('fb-1') });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.feedback.id).toBe('fb-1');
    expect(json.feedback.category).toBe('bug');
    expect(json.feedback.reporterName).toBe('user1');
  });

  it('returns 404 when feedback not found', async () => {
    mocks.selectResults = [[]];
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/feedbacks/nonexistent`);
    const response = await GET(request, { params: params('nonexistent') });
    const json = await response.json();
    expect(response.status).toBe(404);
    expect(json.error).toBe('Feedback not found');
  });

  it('returns 401 when not authenticated', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/feedbacks/fb-1`);
    const response = await GET(request, { params: params('fb-1') });
    const json = await response.json();
    expect(response.status).toBe(401);
  });
});

describe('DELETE /api/admin/feedbacks/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.createModerationLog.mockResolvedValue(undefined);
    mocks.queryFindFirstResult = mockFeedback;
  });

  it('deletes a feedback and creates moderation log', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/feedbacks/fb-1`, { method: 'DELETE' });
    const response = await DELETE(request, { params: params('fb-1') });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mocks.createModerationLog).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'feedback',
      action: 'delete',
      reason: expect.stringContaining('Found a critical bug'),
    }));
  });

  it('returns 404 when feedback not found', async () => {
    mocks.queryFindFirstResult = null;
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/feedbacks/nonexistent`, { method: 'DELETE' });
    const response = await DELETE(request, { params: params('nonexistent') });
    const json = await response.json();
    expect(response.status).toBe(404);
    expect(json.error).toBe('Feedback not found');
  });

  it('returns 401 when not authenticated', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/feedbacks/fb-1`, { method: 'DELETE' });
    const response = await DELETE(request, { params: params('fb-1') });
    const json = await response.json();
    expect(response.status).toBe(401);
  });

  it('returns 403 when missing feedbacks.resolve permission', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Missing permission: feedbacks.resolve', 403));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/feedbacks/fb-1`, { method: 'DELETE' });
    const response = await DELETE(request, { params: params('fb-1') });
    const json = await response.json();
    expect(response.status).toBe(403);
  });
});
