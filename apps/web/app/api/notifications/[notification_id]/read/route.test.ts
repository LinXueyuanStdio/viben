import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  markNotificationsRead: vi.fn(),
}));

vi.mock('@/lib/auth/middleware', () => ({
  AuthError: class AuthError extends Error {
    constructor(message: string, public status = 401) {
      super(message);
      this.name = 'AuthError';
    }
  },
  requireAuth: mocks.requireAuth,
}));

vi.mock('@/lib/services/community', () => ({
  markNotificationsRead: mocks.markNotificationsRead,
}));

import { POST } from './route';

describe('POST /api/notifications/[notification_id]/read', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue({
      userId: 'reader-1',
      username: 'reader',
      userSlug: 'reader',
      email: 'reader@example.com',
      role: 'user',
      expiresAt: Date.now() + 1000,
    });
    mocks.markNotificationsRead.mockResolvedValue({
      success: true,
      updated_count: 1,
    });
  });

  it('delegates single notification read updates to the community service', async () => {
    const response = await POST(
      new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/notifications/notification-1/read`, {
        method: 'POST',
      }),
      {
        params: Promise.resolve({ notification_id: 'notification-1' }),
      }
    );

    expect(response.status).toBe(200);
    expect(mocks.markNotificationsRead).toHaveBeenCalledWith({
      session: expect.objectContaining({ userId: 'reader-1' }),
      notificationIds: ['notification-1'],
      beforeCursor: null,
    });
  });
});
