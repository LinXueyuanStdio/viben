/**
 * Tests for Admin Package Reject API
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  getPackageType: vi.fn(),
  dbUpdateSetWhere: vi.fn(),
  dbInsertValues: vi.fn(),
  AuthError: class AuthError extends Error {
    constructor(message: string, public status = 401) { super(message); this.name = 'AuthError'; }
  },
}));

vi.mock('@/lib/auth', () => ({
  requirePermission: mocks.requirePermission,
  AuthError: mocks.AuthError,
}));

vi.mock('@/lib/admin', () => ({
  getPackageType: mocks.getPackageType,
  db: {
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: mocks.dbUpdateSetWhere })) })),
    insert: vi.fn(() => ({ values: mocks.dbInsertValues })),
  },
  mcpPackages: {},
  skillPackages: {},
  moderationLogs: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field: any, value: any) => ({ type: 'eq', field, value })),
}));

import { POST } from './route';

const adminSession = {
  userId: 'admin-1', username: 'admin', userSlug: 'admin',
  email: 'admin@example.com', role: 'super_admin', expiresAt: Date.now() + 3600,
};

function params(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

describe('POST /api/admin/packages/[id]/reject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.getPackageType.mockResolvedValue('mcp');
    mocks.dbUpdateSetWhere.mockResolvedValue(undefined);
    mocks.dbInsertValues.mockResolvedValue(undefined);
  });

  // ======== Successful requests ========

  it('rejects a package with a reason', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/pkg-1/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Not suitable for the marketplace' }),
    });
    const response = await POST(request, { params: params('pkg-1') });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.package.status).toBe('rejected');
    expect(json.package.rejectionReason).toBe('Not suitable for the marketplace');
  });

  it('rejects a skill package', async () => {
    mocks.getPackageType.mockResolvedValue('skill');
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/pkg-2/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Duplicate' }),
    });
    const response = await POST(request, { params: params('pkg-2') });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
  });

  // ======== Moderation log ========

  it('creates moderation log with reject action and reason', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/pkg-1/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Spam content' }),
    });
    await POST(request, { params: params('pkg-1') });

    const insertCall = mocks.dbInsertValues.mock.calls[0]?.[0];
    expect(insertCall).toBeDefined();
    expect(insertCall.action).toBe('reject');
    expect(insertCall.entityType).toBe('mcp');
    expect(insertCall.entityId).toBe('pkg-1');
    expect(insertCall.reason).toBe('Spam content');
  });

  // ======== Permission ========

  it('returns 401 when not authenticated', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/pkg-1/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Test' }),
    });
    const response = await POST(request, { params: params('pkg-1') });
    const json = await response.json();
    expect(response.status).toBe(401);
    expect(json.error).toBe('Authentication required');
  });

  it('returns 403 when missing packages.approve permission', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Missing permission: packages.approve', 403));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/pkg-1/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Test' }),
    });
    const response = await POST(request, { params: params('pkg-1') });
    const json = await response.json();
    expect(response.status).toBe(403);
    expect(json.error).toBe('Missing permission: packages.approve');
  });

  // ======== Not found ========

  it('returns 404 when package not found', async () => {
    mocks.getPackageType.mockResolvedValue(null);
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/nonexistent/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Test' }),
    });
    const response = await POST(request, { params: params('nonexistent') });
    const json = await response.json();
    expect(response.status).toBe(404);
    expect(json.error).toBe('Package not found');
  });

  // ======== Validation ========

  it('returns 400 when reason is missing', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/pkg-1/reject`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const response = await POST(request, { params: params('pkg-1') });
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid request body');
  });

  it('returns 400 when reason is empty string', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/pkg-1/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: '' }),
    });
    const response = await POST(request, { params: params('pkg-1') });
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid request body');
  });

  it('returns 400 when reason exceeds max length', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/pkg-1/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'x'.repeat(1001) }),
    });
    const response = await POST(request, { params: params('pkg-1') });
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid request body');
  });

  it('returns 400 for invalid JSON body', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/pkg-1/reject`, {
      method: 'POST',
      body: 'not-json',
    });
    const response = await POST(request, { params: params('pkg-1') });
    const json = await response.json();
    expect(response.status).toBe(500);
    expect(json.error).toBe('Internal server error');
  });

  // ======== Server error ========

  it('returns 500 on unexpected error', async () => {
    mocks.getPackageType.mockRejectedValue(new Error('DB crash'));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/pkg-1/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Test' }),
    });
    const response = await POST(request, { params: params('pkg-1') });
    const json = await response.json();
    expect(response.status).toBe(500);
    expect(json.error).toBe('Internal server error');
  });
});
