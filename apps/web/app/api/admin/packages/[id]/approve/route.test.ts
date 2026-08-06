/**
 * Tests for Admin Package Approve API
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

describe('POST /api/admin/packages/[id]/approve', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.getPackageType.mockResolvedValue('mcp');
    mocks.dbUpdateSetWhere.mockResolvedValue(undefined);
    mocks.dbInsertValues.mockResolvedValue(undefined);
  });

  // ======== Successful requests ========

  it('approves a package without note (empty body)', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/pkg-1/approve`, {
      method: 'POST', body: '',
    });
    const response = await POST(request, { params: params('pkg-1') });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.package.status).toBe('approved');
    expect(json.package.id).toBe('pkg-1');
  });

  it('approves a package without note (no body)', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/pkg-1/approve`, {
      method: 'POST',
    });
    const response = await POST(request, { params: params('pkg-1') });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it('approves a package with note', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/pkg-1/approve`, {
      method: 'POST',
      body: JSON.stringify({ note: 'Looks good!' }),
    });
    const response = await POST(request, { params: params('pkg-1') });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it('approves a skill package', async () => {
    mocks.getPackageType.mockResolvedValue('skill');
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/pkg-2/approve`, {
      method: 'POST', body: '',
    });
    const response = await POST(request, { params: params('pkg-2') });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
  });

  // ======== Creates moderation log ========

  it('creates moderation log with approve action', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/pkg-1/approve`, {
      method: 'POST',
      body: JSON.stringify({ note: 'Approved after review' }),
    });
    await POST(request, { params: params('pkg-1') });

    const insertCall = mocks.dbInsertValues.mock.calls[0]?.[0];
    expect(insertCall).toBeDefined();
    expect(insertCall.action).toBe('approve');
    expect(insertCall.entityType).toBe('mcp');
    expect(insertCall.entityId).toBe('pkg-1');
    expect(insertCall.adminId).toBe('admin-1');
    expect(insertCall.reason).toBe('Approved after review');
  });

  // ======== Permission ========

  it('returns 401 when not authenticated', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/pkg-1/approve`, {
      method: 'POST',
    });
    const response = await POST(request, { params: params('pkg-1') });
    const json = await response.json();
    expect(response.status).toBe(401);
    expect(json.error).toBe('Authentication required');
  });

  it('returns 403 when missing packages.approve permission', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Missing permission: packages.approve', 403));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/pkg-1/approve`, {
      method: 'POST',
    });
    const response = await POST(request, { params: params('pkg-1') });
    const json = await response.json();
    expect(response.status).toBe(403);
    expect(json.error).toBe('Missing permission: packages.approve');
  });

  // ======== Not found ========

  it('returns 404 when package not found', async () => {
    mocks.getPackageType.mockResolvedValue(null);
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/nonexistent/approve`, {
      method: 'POST', body: '',
    });
    const response = await POST(request, { params: params('nonexistent') });
    const json = await response.json();
    expect(response.status).toBe(404);
    expect(json.error).toBe('Package not found');
  });

  // ======== Validation ========

  it('returns 400 when note exceeds max length', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/pkg-1/approve`, {
      method: 'POST',
      body: JSON.stringify({ note: 'x'.repeat(1001) }),
    });
    const response = await POST(request, { params: params('pkg-1') });
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid request body');
  });

  // ======== Server error ========

  it('returns 500 on unexpected error', async () => {
    mocks.getPackageType.mockRejectedValue(new Error('DB crash'));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/pkg-1/approve`, {
      method: 'POST',
    });
    const response = await POST(request, { params: params('pkg-1') });
    const json = await response.json();
    expect(response.status).toBe(500);
    expect(json.error).toBe('Internal server error');
  });
});
