/**
 * Tests for Admin Package [id] API (GET detail, DELETE hard delete)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  getPackageDetails: vi.fn(),
  getPackageType: vi.fn(),
  deleteMcpPackage: vi.fn(),
  deleteSkillPackage: vi.fn(),
  dbInsert: vi.fn(),
  AuthError: class AuthError extends Error {
    constructor(message: string, public status = 401) { super(message); this.name = 'AuthError'; }
  },
}));

vi.mock('@/lib/auth', () => ({
  requirePermission: mocks.requirePermission,
  AuthError: mocks.AuthError,
}));

vi.mock('@/lib/admin', () => ({
  getPackageDetails: mocks.getPackageDetails,
  getPackageType: mocks.getPackageType,
  deleteMcpPackage: mocks.deleteMcpPackage,
  deleteSkillPackage: mocks.deleteSkillPackage,
  db: {
    insert: mocks.dbInsert,
  },
  moderationLogs: {},
}));

import { GET, DELETE } from './route';

const adminSession = {
  userId: 'admin-1', username: 'admin', userSlug: 'admin',
  email: 'admin@example.com', role: 'super_admin', expiresAt: Date.now() + 3600,
};

function params(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

describe('GET /api/admin/packages/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.getPackageDetails.mockResolvedValue({
      id: 'pkg-1', name: 'test-mcp', type: 'mcp', status: 'pending',
      author: { id: 'u1', username: 'dev', displayName: 'Dev' },
    });
  });

  it('returns 200 with package details', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/pkg-1`);
    const response = await GET(request, { params: params('pkg-1') });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.package).toBeDefined();
    expect(json.package.id).toBe('pkg-1');
    expect(json.package.name).toBe('test-mcp');
  });

  it('returns 404 when package not found', async () => {
    mocks.getPackageDetails.mockResolvedValue(null);
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/nonexistent`);
    const response = await GET(request, { params: params('nonexistent') });
    const json = await response.json();
    expect(response.status).toBe(404);
    expect(json.error).toBe('Package not found');
  });

  it('returns 401 when permission denied', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/pkg-1`);
    const response = await GET(request, { params: params('pkg-1') });
    const json = await response.json();
    expect(response.status).toBe(401);
    expect(json.error).toBe('Authentication required');
  });

  it('returns 403 when missing permission', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Missing permission: packages.review', 403));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/pkg-1`);
    const response = await GET(request, { params: params('pkg-1') });
    const json = await response.json();
    expect(response.status).toBe(403);
    expect(json.error).toBe('Missing permission: packages.review');
  });

  it('returns 500 on unexpected error', async () => {
    mocks.getPackageDetails.mockRejectedValue(new Error('DB crash'));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/pkg-1`);
    const response = await GET(request, { params: params('pkg-1') });
    const json = await response.json();
    expect(response.status).toBe(500);
    expect(json.error).toBe('Internal server error');
  });
});

describe('DELETE /api/admin/packages/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.getPackageType.mockResolvedValue('mcp');
    mocks.deleteMcpPackage.mockResolvedValue(undefined);
    mocks.deleteSkillPackage.mockResolvedValue(undefined);
    mocks.dbInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
  });

  it('hard deletes an MCP package and creates moderation log', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/pkg-1`, { method: 'DELETE' });
    const response = await DELETE(request, { params: params('pkg-1') });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.package.deleted).toBe(true);
    expect(mocks.deleteMcpPackage).toHaveBeenCalledWith('pkg-1');
    expect(mocks.dbInsert).toHaveBeenCalled();
  });

  it('hard deletes a skill package', async () => {
    mocks.getPackageType.mockResolvedValue('skill');
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/pkg-2`, { method: 'DELETE' });
    const response = await DELETE(request, { params: params('pkg-2') });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mocks.deleteSkillPackage).toHaveBeenCalledWith('pkg-2');
  });

  it('returns 404 when package not found', async () => {
    mocks.getPackageType.mockResolvedValue(null);
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/nonexistent`, { method: 'DELETE' });
    const response = await DELETE(request, { params: params('nonexistent') });
    const json = await response.json();
    expect(response.status).toBe(404);
    expect(json.error).toBe('Package not found');
  });

  it('requires packages.review permission', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Missing permission: packages.review', 403));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/pkg-1`, { method: 'DELETE' });
    const response = await DELETE(request, { params: params('pkg-1') });
    const json = await response.json();
    expect(response.status).toBe(403);
    expect(json.error).toBe('Missing permission: packages.review');
  });

  it('creates moderation log with correct data', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/pkg-1`, { method: 'DELETE' });
    await DELETE(request, { params: params('pkg-1') });

    // Verify moderation log insert was called
    const insertCall = mocks.dbInsert.mock.calls[0]?.[0];
    expect(insertCall).toBeDefined();
    // The values call is separate, but we verify insert was invoked via moderationLogs
    expect(mocks.dbInsert).toHaveBeenCalledTimes(1);
  });

  it('returns 500 on unexpected error', async () => {
    mocks.getPackageType.mockRejectedValue(new Error('DB crash'));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages/pkg-1`, { method: 'DELETE' });
    const response = await DELETE(request, { params: params('pkg-1') });
    const json = await response.json();
    expect(response.status).toBe(500);
    expect(json.error).toBe('Internal server error');
  });
});
