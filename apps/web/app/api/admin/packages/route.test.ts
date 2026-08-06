/**
 * Tests for Admin Packages list API
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  listPackagesForReview: vi.fn(),
  AuthError: class AuthError extends Error {
    constructor(message: string, public status = 401) { super(message); this.name = 'AuthError'; }
  },
}));

vi.mock('@/lib/auth', () => ({
  requirePermission: mocks.requirePermission,
  AuthError: mocks.AuthError,
}));

vi.mock('@/lib/admin', () => ({
  listPackagesForReview: mocks.listPackagesForReview,
}));

import { GET } from './route';

const adminSession = {
  userId: 'admin-1', username: 'admin', userSlug: 'admin',
  email: 'admin@example.com', role: 'super_admin', expiresAt: Date.now() + 3600,
};

const mockPackageList = {
  packages: [
    { id: 'pkg-1', name: 'test-mcp', type: 'mcp', status: 'pending',
      author: { id: 'u1', username: 'dev', displayName: 'Dev' },
      createdAt: new Date('2025-01-01').toISOString() },
  ],
  pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

describe('GET /api/admin/packages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.listPackagesForReview.mockResolvedValue(mockPackageList);
  });

  // ======== Permission ========

  it('returns 401 when requirePermission rejects with status 401', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(401);
    expect(json.error).toBe('Authentication required');
  });

  it('returns 403 when requirePermission rejects with status 403', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Missing permission: packages.review', 403));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(403);
    expect(json.error).toBe('Missing permission: packages.review');
  });

  // ======== Successful response ========

  it('returns 200 with packages and pagination', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.packages).toBeDefined();
    expect(json.packages.length).toBe(1);
    expect(json.packages[0].id).toBe('pkg-1');
    expect(json.pagination.page).toBe(1);
    expect(json.pagination.total).toBe(1);
  });

  // ======== Default params ========

  it('uses default pagination when no params provided', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages`);
    await GET(request);
    expect(mocks.listPackagesForReview).toHaveBeenCalledWith(expect.objectContaining({
      page: 1, limit: 20, sort: 'oldest',
    }));
  });

  // ======== Query parameters ========

  it('passes type filter', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages?type=mcp`);
    await GET(request);
    expect(mocks.listPackagesForReview).toHaveBeenCalledWith(expect.objectContaining({ type: 'mcp' }));
  });

  it('passes status filter', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages?status=approved`);
    await GET(request);
    expect(mocks.listPackagesForReview).toHaveBeenCalledWith(expect.objectContaining({ status: 'approved' }));
  });

  it('passes page and limit params', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages?page=2&limit=10`);
    await GET(request);
    expect(mocks.listPackagesForReview).toHaveBeenCalledWith(expect.objectContaining({ page: 2, limit: 10 }));
  });

  it('passes sort param', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages?sort=newest`);
    await GET(request);
    expect(mocks.listPackagesForReview).toHaveBeenCalledWith(expect.objectContaining({ sort: 'newest' }));
  });

  it('passes all params combined', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages?type=skill&status=featured&page=3&limit=50&sort=newest`);
    await GET(request);
    expect(mocks.listPackagesForReview).toHaveBeenCalledWith({
      type: 'skill', status: 'featured', page: 3, limit: 50, sort: 'newest',
    });
  });

  // ======== Validation ========

  it('returns 400 for invalid status value', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages?status=invalid`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
  });

  it('returns 400 for invalid type value', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages?type=invalid`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
  });

  it('returns 400 for page less than 1', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages?page=0`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
  });

  it('returns 400 for limit exceeding 100', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages?limit=200`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
  });

  // ======== Empty results ========

  it('returns 200 with empty packages array', async () => {
    mocks.listPackagesForReview.mockResolvedValue({
      packages: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.packages).toEqual([]);
    expect(json.pagination.total).toBe(0);
  });

  // ======== Server error ========

  it('returns 500 on unexpected error', async () => {
    mocks.listPackagesForReview.mockRejectedValue(new Error('DB crash'));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/packages`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(500);
    expect(json.error).toBe('Internal server error');
  });
});
