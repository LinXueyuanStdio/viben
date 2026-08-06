import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getAdminStats: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  AuthError: class AuthError extends Error {
    constructor(message: string, public status = 401) {
      super(message);
      this.name = 'AuthError';
    }
  },
  requireAdmin: mocks.requireAdmin,
}));

vi.mock('@/lib/admin/stats', () => ({
  getAdminStats: mocks.getAdminStats,
}));

import { GET } from './route';

const mockStats = {
  pendingPackages: 4,
  openReports: 2,
  todayActions: 15,
  totalUsers: 1234,
  totalPublishedPages: 56,
  totalMoments: 789,
  totalPackages: 90,
  newUsersToday: 12,
  newUsersThisWeek: 67,
  totalDownloads: 45000,
  totalComments: 3200,
  recentActivity: [],
  pendingQueue: [],
};

describe('GET /api/admin/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      userId: 'admin-1',
      username: 'admin',
      userSlug: 'admin',
      email: 'admin@example.com',
      role: 'super_admin',
      expiresAt: Date.now() + 1000,
    });
    mocks.getAdminStats.mockResolvedValue(mockStats);
  });

  it('returns 401 when requireAdmin rejects with AuthError(status=401)', async () => {
    mocks.requireAdmin.mockRejectedValue(
      new (await import('@/lib/auth')).AuthError('Authentication required', 401)
    );

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/stats`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Authentication required');
    expect(mocks.getAdminStats).not.toHaveBeenCalled();
  });

  it('returns 403 when requireAdmin rejects with AuthError(status=403)', async () => {
    mocks.requireAdmin.mockRejectedValue(
      new (await import('@/lib/auth')).AuthError('Insufficient permissions', 403)
    );

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/stats`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe('Insufficient permissions');
  });

  it('returns 200 with full AdminStats object', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/stats`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual(mockStats);
    expect(json.pendingPackages).toBe(4);
    expect(json.openReports).toBe(2);
    expect(json.totalUsers).toBe(1234);
    expect(json.totalDownloads).toBe(45000);
    expect(json.recentActivity).toEqual([]);
    expect(json.pendingQueue).toEqual([]);
    expect(mocks.getAdminStats).toHaveBeenCalledTimes(1);
  });

  it('handles empty stats gracefully', async () => {
    mocks.getAdminStats.mockResolvedValue({
      ...mockStats,
      pendingPackages: 0,
      openReports: 0,
      todayActions: 0,
      recentActivity: [],
      pendingQueue: [],
    });

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/stats`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.pendingPackages).toBe(0);
    expect(json.openReports).toBe(0);
    expect(json.todayActions).toBe(0);
  });

  it('returns 500 on unexpected error', async () => {
    mocks.getAdminStats.mockRejectedValue(new Error('Database connection failed'));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/stats`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe('Internal server error');
  });
});
