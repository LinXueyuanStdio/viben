import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  toggleReaction: vi.fn(),
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
  toggleReaction: mocks.toggleReaction,
}));

import { POST } from './route';

describe('POST /api/community/reactions/toggle', () => {
  const session = { userId: 'user-1', username: 'test', userSlug: 'test', email: 't@t.com', role: 'user' as const, expiresAt: Date.now() + 999999 };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue(session);
  });

  it('toggles a like reaction on a moment', async () => {
    mocks.toggleReaction.mockResolvedValue({ has_reacted: true, reactions_count: 5 });

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/community/reactions/toggle`, {
      method: 'POST',
      body: JSON.stringify({ entity_type: 'moment', entity_id: 'moment-1', reaction_type: 'like' }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.has_reacted).toBe(true);
    expect(json.reactions_count).toBe(5);
    expect(mocks.toggleReaction).toHaveBeenCalledWith({
      entityType: 'moment',
      entityId: 'moment-1',
      reactionType: 'like',
      session,
    });
  });

  it('toggles off a like reaction (un-like)', async () => {
    mocks.toggleReaction.mockResolvedValue({ has_reacted: false, reactions_count: 4 });

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/community/reactions/toggle`, {
      method: 'POST',
      body: JSON.stringify({ entity_type: 'moment', entity_id: 'moment-1', reaction_type: 'like' }),
    });

    const json = await (await POST(request)).json();
    expect(json.has_reacted).toBe(false);
    expect(json.reactions_count).toBe(4);
  });

  it('supports reactions on published_page entities', async () => {
    mocks.toggleReaction.mockResolvedValue({ has_reacted: true, reactions_count: 1 });

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/community/reactions/toggle`, {
      method: 'POST',
      body: JSON.stringify({ entity_type: 'published_page', entity_id: 'page-1', reaction_type: 'like' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(mocks.toggleReaction).toHaveBeenCalledWith({
      entityType: 'published_page',
      entityId: 'page-1',
      reactionType: 'like',
      session,
    });
  });

  it('returns 401 when not authenticated', async () => {
    mocks.requireAuth.mockRejectedValue(new (await import('@/lib/auth/middleware')).AuthError('Not authenticated', 401));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/community/reactions/toggle`, {
      method: 'POST',
      body: JSON.stringify({ entity_type: 'moment', entity_id: 'm1', reaction_type: 'like' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('returns 400 for missing entity_id', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/community/reactions/toggle`, {
      method: 'POST',
      body: JSON.stringify({ entity_type: 'moment' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 404 when community entity not found', async () => {
    mocks.toggleReaction.mockRejectedValue(new Error('community_entity_not_found'));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/community/reactions/toggle`, {
      method: 'POST',
      body: JSON.stringify({ entity_type: 'moment', entity_id: 'no-such-moment', reaction_type: 'like' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(404);
  });
});
