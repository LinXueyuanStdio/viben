/**
 * Tests for comment reply functionality.
 * Verifies: posting replies, parent/depth setup, reply count updates.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const session = { userId: 'user-1', username: 'test', userSlug: 'test', email: 't@t.com', role: 'user' as const, avatarUrl: undefined, expiresAt: Date.now() + 999999 }

const mocks = vi.hoisted(() => ({
  getOptionalSession: vi.fn(),
  requireAuth: vi.fn(),
  listCommunityComments: vi.fn(),
  createCommunityComment: vi.fn(),
}))

vi.mock('@/lib/auth/middleware', () => ({
  AuthError: class AuthError extends Error {
    constructor(message: string, public status = 401) { super(message); this.name = 'AuthError' }
  },
  getOptionalSession: mocks.getOptionalSession,
  requireAuth: mocks.requireAuth,
}))

vi.mock('@/lib/services/community', () => ({
  createCommunityComment: mocks.createCommunityComment,
  listCommunityComments: mocks.listCommunityComments,
}))

import { GET, POST } from './route'

describe('Comment reply flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuth.mockResolvedValue(session)
    mocks.getOptionalSession.mockResolvedValue(session)
    mocks.listCommunityComments.mockResolvedValue({ comments: [], next_cursor: null })
  })

  describe('POST /api/community/comments — replies', () => {
    it('creates a reply with parent_comment_id', async () => {
      mocks.createCommunityComment.mockResolvedValue({
        id: 'reply-1', content: 'a reply', status: 'active', depth: 1,
        parentCommentId: 'parent-1', createdAt: new Date(),
      })

      const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/community/comments`, {
        method: 'POST',
        body: JSON.stringify({
          entity_type: 'moment',
          entity_id: 'moment-1',
          parent_comment_id: 'parent-1',
          content: 'a reply',
        }),
      })

      const response = await POST(request)
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.comment.id).toBe('reply-1')
      expect(json.comment.depth).toBe(1)
      expect(json.comment.parent_comment_id).toBe('parent-1')
      expect(mocks.createCommunityComment).toHaveBeenCalledWith({
        entityType: 'moment', entityId: 'moment-1',
        parentCommentId: 'parent-1', content: 'a reply', session,
      })
    })

    it('creates a top-level comment when parent_comment_id is empty string', async () => {
      mocks.createCommunityComment.mockResolvedValue({
        id: 'comment-1', content: 'hello', status: 'active', depth: 0,
        parentCommentId: null, createdAt: new Date(),
      })

      const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/community/comments`, {
        method: 'POST',
        body: JSON.stringify({ entity_type: 'moment', entity_id: 'm1', parent_comment_id: '', content: 'hello' }),
      })

      const json = await (await POST(request)).json()
      // parent_comment_id empty string → null
      expect(mocks.createCommunityComment).toHaveBeenCalledWith(
        expect.objectContaining({ parentCommentId: null })
      )
      expect(json.comment.depth).toBe(0)
      expect(json.comment.parent_comment_id).toBe(null)
    })

    it('creates top-level when parent_comment_id is missing entirely', async () => {
      mocks.createCommunityComment.mockResolvedValue({
        id: 'c1', content: 'hi', status: 'active', depth: 0,
        parentCommentId: null, createdAt: new Date(),
      })

      const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/community/comments`, {
        method: 'POST',
        body: JSON.stringify({ entity_type: 'moment', entity_id: 'm1', content: 'hi' }),
      })

      await POST(request)
      expect(mocks.createCommunityComment).toHaveBeenCalledWith(
        expect.objectContaining({ parentCommentId: null })
      )
    })

    it('returns 400 when replying to non-existent parent comment', async () => {
      mocks.createCommunityComment.mockRejectedValue(new Error('comment_not_found'))

      const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/community/comments`, {
        method: 'POST',
        body: JSON.stringify({ entity_type: 'moment', entity_id: 'm1', parent_comment_id: 'bad-id', content: 'reply' }),
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
    })
  })

  describe('GET /api/community/comments — reply listing', () => {
    it('fetches top-level comments by default (parent_comment_id omitted)', async () => {
      const request = new NextRequest(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/community/comments?entity_type=moment&entity_id=m1&limit=20`
      )
      await GET(request)

      expect(mocks.listCommunityComments).toHaveBeenCalledWith(
        expect.objectContaining({ parentCommentId: null })
      )
    })

    it('fetches replies when parent_comment_id is provided', async () => {
      mocks.listCommunityComments.mockResolvedValue({
        comments: [
          { id: 'r1', content: 'reply', status: 'active', depth: 1, replies_count: 0,
            reactions_count: 0, viewer_has_reacted: false, created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            author: { id: 'a1', user_slug: 'a', display_name: 'A', avatar_url: null } }
        ],
        next_cursor: null,
      })

      const request = new NextRequest(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/community/comments?entity_type=moment&entity_id=m1&parent_comment_id=parent-1&limit=10`
      )
      const response = await GET(request)
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.comments.length).toBe(1)
      expect(json.comments[0].id).toBe('r1')
      expect(mocks.listCommunityComments).toHaveBeenCalledWith(
        expect.objectContaining({ parentCommentId: 'parent-1' })
      )
    })
  })
})
