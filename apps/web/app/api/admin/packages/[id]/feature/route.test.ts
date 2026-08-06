/**
 * Tests for Admin Package Feature API
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  getPackageType: vi.fn(),
  getPackageStatus: vi.fn(),
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
  getPackageStatus: mocks.getPackageStatus,
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

describe('POST /api/admin/packages/[id]/feature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.getPackageType.mockResolvedValue('mcp');
    mocks.getPackageStatus.mockResolvedValue('approved');
    mocks.dbUpdateSetWhere.mockResolvedValue(undefined);
    mocks.dbInsertValues.mockResolvedValue(undefined);
  });

  // ======== Feature ========

  it('features an approved package', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/pkg-1/feature`, {
      method: 'POST',
      body: JSON.stringify({ featured: true }),
    });
    const response = await POST(request, { params: params('pkg-1') });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.package.status).toBe('featured');
  });

  it('creates moderation log with feature action', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/pkg-1/feature`, {
      method: 'POST',
      body: JSON.stringify({ featured: true }),
    });
    await POST(request, { params: params('pkg-1') });

    const insertCall = mocks.dbInsertValues.mock.calls[0]?.[0];
    expect(insertCall).toBeDefined();
    expect(insertCall.action).toBe('feature');
    expect(insertCall.adminId).toBe('admin-1');
  });

  it('returns success when already featured', async () => {
    mocks.getPackageStatus.mockResolvedValue('featured');
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/pkg-1/feature`, {
      method: 'POST',
      body: JSON.stringify({ featured: true }),
    });
    const response = await POST(request, { params: params('pkg-1') });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.package.status).toBe('featured');
  });

  // ======== Unfeature ========

  it('unfeatures a featured package', async () => {
    mocks.getPackageStatus.mockResolvedValue('featured');
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/pkg-1/feature`, {
      method: 'POST',
      body: JSON.stringify({ featured: false }),
    });
    const response = await POST(request, { params: params('pkg-1') });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.package.status).toBe('approved');
  });

  it('creates moderation log with unfeature action', async () => {
    mocks.getPackageStatus.mockResolvedValue('featured');
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/pkg-1/feature`, {
      method: 'POST',
      body: JSON.stringify({ featured: false }),
    });
    await POST(request, { params: params('pkg-1') });

    const insertCall = mocks.dbInsertValues.mock.calls[0]?.[0];
    expect(insertCall).toBeDefined();
    expect(insertCall.action).toBe('unfeature');
  });

  it('returns success when unfeaturing non-featured package', async () => {
    mocks.getPackageStatus.mockResolvedValue('approved');
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/pkg-1/feature`, {
      method: 'POST',
      body: JSON.stringify({ featured: false }),
    });
    const response = await POST(request, { params: params('pkg-1') });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
  });

  // ======== Business validation ========

  it('returns 400 when featuring a non-approved package', async () => {
    mocks.getPackageStatus.mockResolvedValue('pending');
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/pkg-1/feature`, {
      method: 'POST',
      body: JSON.stringify({ featured: true }),
    });
    const response = await POST(request, { params: params('pkg-1') });
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe('Package must be approved before it can be featured');
  });

  it('returns 400 when featuring a rejected package', async () => {
    mocks.getPackageStatus.mockResolvedValue('rejected');
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/pkg-1/feature`, {
      method: 'POST',
      body: JSON.stringify({ featured: true }),
    });
    const response = await POST(request, { params: params('pkg-1') });
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe('Package must be approved before it can be featured');
  });

  // ======== Validation ========

  it('returns 400 when featured field is missing', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/pkg-1/feature`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const response = await POST(request, { params: params('pkg-1') });
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid request body');
  });

  it('returns 400 for non-boolean featured value', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/pkg-1/feature`, {
      method: 'POST',
      body: JSON.stringify({ featured: 'yes' }),
    });
    const response = await POST(request, { params: params('pkg-1') });
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid request body');
  });

  // ======== Permission ========

  it('returns 401 when not authenticated', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/pkg-1/feature`, {
      method: 'POST',
      body: JSON.stringify({ featured: true }),
    });
    const response = await POST(request, { params: params('pkg-1') });
    const json = await response.json();
    expect(response.status).toBe(401);
    expect(json.error).toBe('Authentication required');
  });

  it('returns 403 when missing packages.feature permission', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Missing permission: packages.feature', 403));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/pkg-1/feature`, {
      method: 'POST',
      body: JSON.stringify({ featured: true }),
    });
    const response = await POST(request, { params: params('pkg-1') });
    const json = await response.json();
    expect(response.status).toBe(403);
    expect(json.error).toBe('Missing permission: packages.feature');
  });

  // ======== Not found ========

  it('returns 404 when package not found', async () => {
    mocks.getPackageType.mockResolvedValue(null);
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/nonexistent/feature`, {
      method: 'POST',
      body: JSON.stringify({ featured: true }),
    });
    const response = await POST(request, { params: params('nonexistent') });
    const json = await response.json();
    expect(response.status).toBe(404);
    expect(json.error).toBe('Package not found');
  });

  // ======== Server error ========

  it('returns 500 on unexpected error', async () => {
    mocks.getPackageType.mockRejectedValue(new Error('DB crash'));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/pkg-1/feature`, {
      method: 'POST',
      body: JSON.stringify({ featured: true }),
    });
    const response = await POST(request, { params: params('pkg-1') });
    const json = await response.json();
    expect(response.status).toBe(500);
    expect(json.error).toBe('Internal server error');
  });
});
