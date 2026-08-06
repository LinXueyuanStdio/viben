/**
 * Tests for Admin Report [id] API (GET detail, PATCH resolve/dismiss)
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
  getSession: mocks.getSession,
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
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
  };
  return { db, reports: {}, users: {} };
});

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field: any, value: any) => ({ type: 'eq', field, value })),
}));

import { GET, PATCH } from './route';

const adminSession = {
  userId: 'admin-1', username: 'admin', userSlug: 'admin',
  email: 'admin@example.com', role: 'moderator', expiresAt: Date.now() + 3600,
};

function params(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

describe('GET /api/admin/reports/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.selectCallCount = 0;
    mocks.selectResults = [[{
      id: 'rep-1', entityType: 'mcp', entityId: 'pkg-1',
      reason: 'spam', description: 'Spam content', status: 'pending',
      resolution: null, createdAt: new Date().toISOString(), resolvedAt: null,
      reporterId: 'u1', reporterName: 'user1', resolvedBy: null,
    }]];
  });

  it('returns 200 with report details', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/reports/rep-1`);
    const response = await GET(request, { params: params('rep-1') });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.report.id).toBe('rep-1');
    expect(json.report.reporterName).toBe('user1');
  });

  it('returns 404 when report not found', async () => {
    mocks.selectResults = [[]];
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/reports/nonexistent`);
    const response = await GET(request, { params: params('nonexistent') });
    const json = await response.json();
    expect(response.status).toBe(404);
    expect(json.error).toBe('Report not found');
  });

  it('returns 401 when not authenticated', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/reports/rep-1`);
    const response = await GET(request, { params: params('rep-1') });
    const json = await response.json();
    expect(response.status).toBe(401);
  });
});

describe('PATCH /api/admin/reports/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.getSession.mockResolvedValue(adminSession);
    mocks.createModerationLog.mockResolvedValue(undefined);
  });

  it('resolves a report', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/reports/rep-1`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'resolve' }),
    });
    const response = await PATCH(request, { params: params('rep-1') });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mocks.createModerationLog).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'report',
      action: 'approve',
      reason: expect.stringContaining('resolve'),
    }));
  });

  it('dismisses a report', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/reports/rep-1`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'dismiss' }),
    });
    const response = await PATCH(request, { params: params('rep-1') });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mocks.createModerationLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'reject',
      reason: expect.stringContaining('dismiss'),
    }));
  });

  it('returns 400 for invalid action', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/reports/rep-1`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'invalid' }),
    });
    const response = await PATCH(request, { params: params('rep-1') });
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid request body');
  });

  it('returns 400 when action is missing', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/reports/rep-1`, {
      method: 'PATCH',
      body: JSON.stringify({}),
    });
    const response = await PATCH(request, { params: params('rep-1') });
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid request body');
  });

  it('returns 401 when not authenticated', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/reports/rep-1`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'resolve' }),
    });
    const response = await PATCH(request, { params: params('rep-1') });
    const json = await response.json();
    expect(response.status).toBe(401);
  });

  it('returns 403 when missing reports.resolve permission', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Missing permission: reports.resolve', 403));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/reports/rep-1`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'resolve' }),
    });
    const response = await PATCH(request, { params: params('rep-1') });
    const json = await response.json();
    expect(response.status).toBe(403);
  });
});
