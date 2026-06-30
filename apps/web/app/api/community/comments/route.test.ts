import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getOptionalSession: vi.fn(),
  requireAuth: vi.fn(),
  listCommunityComments: vi.fn(),
  createCommunityComment: vi.fn(),
}));

vi.mock('@/lib/auth/middleware', () => ({
  AuthError: class AuthError extends Error {
    constructor(message: string, public status = 401) {
      super(message);
      this.name = 'AuthError';
    }
  },
  getOptionalSession: mocks.getOptionalSession,
  requireAuth: mocks.requireAuth,
}));

vi.mock('@/lib/services/community', () => ({
  createCommunityComment: mocks.createCommunityComment,
  listCommunityComments: mocks.listCommunityComments,
}));

import { GET, POST } from './route';

describe('GET /api/community/comments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOptionalSession.mockResolvedValue(null);
    mocks.listCommunityComments.mockResolvedValue({
      comments: [],
      next_cursor: null,
    });
  });

  it('passes snake_case cursor pagination to the comment service', async () => {
    const request = new NextRequest(
      'https://viben-web.vercel.app/api/community/comments?entity_type=published_page&entity_id=page-1&parent_comment_id=comment-parent&limit=5&cursor=cursor-1'
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mocks.listCommunityComments).toHaveBeenCalledWith({
      entityType: 'published_page',
      entityId: 'page-1',
      parentCommentId: 'comment-parent',
      limit: 5,
      cursor: 'cursor-1',
      session: null,
    });
  });
});

describe('POST /api/community/comments', () => {
  const session = { userId: 'user-1', username: 'test', userSlug: 'test', email: 't@t.com', role: 'user' as const, expiresAt: Date.now() + 999999 };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue(session);
    mocks.createCommunityComment.mockResolvedValue({
      id: 'comment-1',
      content: 'hello',
      status: 'active',
      depth: 0,
      parentCommentId: null,
      createdAt: new Date(),
    });
  });

  it('creates a comment on a moment', async () => {
    const request = new NextRequest('https://viben-web.vercel.app/api/community/comments', {
      method: 'POST',
      body: JSON.stringify({
        entity_type: 'moment',
        entity_id: 'moment-1',
        content: 'hello world',
      }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.comment.id).toBe('comment-1');
    expect(json.comment.content).toBe('hello');
    expect(mocks.createCommunityComment).toHaveBeenCalledWith({
      entityType: 'moment',
      entityId: 'moment-1',
      parentCommentId: null,
      content: 'hello world',
      session,
    });
  });

  it('creates a reply to a parent comment', async () => {
    const request = new NextRequest('https://viben-web.vercel.app/api/community/comments', {
      method: 'POST',
      body: JSON.stringify({
        entity_type: 'moment',
        entity_id: 'moment-1',
        parent_comment_id: 'parent-1',
        content: 'a reply',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mocks.createCommunityComment).toHaveBeenCalledWith({
      entityType: 'moment',
      entityId: 'moment-1',
      parentCommentId: 'parent-1',
      content: 'a reply',
      session,
    });
  });

  it('returns 401 when not authenticated', async () => {
    mocks.requireAuth.mockRejectedValue(new (await import('@/lib/auth/middleware')).AuthError('Not authenticated', 401));

    const request = new NextRequest('https://viben-web.vercel.app/api/community/comments', {
      method: 'POST',
      body: JSON.stringify({ entity_type: 'moment', entity_id: 'm1', content: 'hi' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('returns 400 for invalid entity_type', async () => {
    const request = new NextRequest('https://viben-web.vercel.app/api/community/comments', {
      method: 'POST',
      body: JSON.stringify({ entity_type: 'invalid', entity_id: 'm1', content: 'hi' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 400 for missing content', async () => {
    const request = new NextRequest('https://viben-web.vercel.app/api/community/comments', {
      method: 'POST',
      body: JSON.stringify({ entity_type: 'moment', entity_id: 'm1' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 404 when community entity not found', async () => {
    mocks.createCommunityComment.mockRejectedValue(new Error('community_entity_not_found'));

    const request = new NextRequest('https://viben-web.vercel.app/api/community/comments', {
      method: 'POST',
      body: JSON.stringify({ entity_type: 'moment', entity_id: 'no-such-moment', content: 'hi' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(404);
  });
});
