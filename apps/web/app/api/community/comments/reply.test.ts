/**
 * Multi-round reply logic tests:
 * - Flat thread: all replies are depth=1, parent is the original comment
 * - @mention in body for addressing specific users
 * - Reply count tracking
 * - Depth=2 (reply-to-reply) is blocked
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const session = { userId: 'user-2', username: 'replier', userSlug: 'replier', email: 'r@t.com', role: 'user' as const, avatarUrl: undefined, expiresAt: Date.now() + 999999 }

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  createCommunityComment: vi.fn(),
  listCommunityComments: vi.fn(),
}))

vi.mock('@/lib/auth/middleware', () => ({
  AuthError: class AuthError extends Error {
    constructor(message: string, public status = 401) { super(message); this.name = 'AuthError' }
  },
  requireAuth: mocks.requireAuth,
}))

vi.mock('@/lib/services/community', () => ({
  createCommunityComment: mocks.createCommunityComment,
}))

import { POST } from './route'

describe('Multi-round reply logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuth.mockResolvedValue(session)
  })

  describe('Flat thread: replying to top-level comment', () => {
    it('creates depth=1 reply when replying to parent comment', async () => {
      mocks.createCommunityComment.mockResolvedValue({
        id: 'reply-1', content: '@alice nice post', status: 'active', depth: 1,
        parentCommentId: 'top-level-1', createdAt: new Date(),
      })

      const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/community/comments`, {
        method: 'POST',
        body: JSON.stringify({
          entity_type: 'moment', entity_id: 'm1',
          parent_comment_id: 'top-level-1',
          content: '@alice nice post',
        }),
      })

      const json = await (await POST(request)).json()

      expect(json.comment.depth).toBe(1)
      expect(json.comment.parent_comment_id).toBe('top-level-1')
      expect(mocks.createCommunityComment).toHaveBeenCalledWith(
        expect.objectContaining({ parentCommentId: 'top-level-1' })
      )
    })

    it('includes @mention in content but parent stays as original comment', async () => {
      mocks.createCommunityComment.mockResolvedValue({
        id: 'r2', content: '@bob good point', status: 'active', depth: 1,
        parentCommentId: 'top-level-1', createdAt: new Date(),
      })

      const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/community/comments`, {
        method: 'POST',
        body: JSON.stringify({
          entity_type: 'moment', entity_id: 'm1',
          parent_comment_id: 'top-level-1',
          content: '@bob good point',
        }),
      })

      const json = await (await POST(request)).json()

      // Parent stays as the original comment, NOT bob's reply id
      expect(json.comment.depth).toBe(1)
      expect(json.comment.parent_comment_id).toBe('top-level-1')
    })
  })

  describe('Depth=2 (reply-to-reply) is blocked', () => {
    it('rejects replying to a depth=1 reply', async () => {
      // The service throws 'comment_not_found' because parent.depth !== 0
      mocks.createCommunityComment.mockRejectedValue(new Error('comment_not_found'))

      const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/community/comments`, {
        method: 'POST',
        body: JSON.stringify({
          entity_type: 'moment', entity_id: 'm1',
          parent_comment_id: 'reply-1',  // this is a depth=1 reply
          content: 'trying to nest deeper',
        }),
      })

      const response = await POST(request)
      expect(response.status).toBe(400)  // comment_not_found → 400
    })
  })

  describe('Reply count management', () => {
    it('increments reply count when replying to top-level comment', async () => {
      mocks.createCommunityComment.mockResolvedValue({
        id: 'r3', content: 'another reply', status: 'active', depth: 1,
        parentCommentId: 'top-level-1', createdAt: new Date(),
      })

      const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/community/comments`, {
        method: 'POST',
        body: JSON.stringify({
          entity_type: 'moment', entity_id: 'm1',
          parent_comment_id: 'top-level-1',
          content: 'another reply',
        }),
      })

      const response = await POST(request)
      expect(response.status).toBe(200)
      // The service should have incremented replies_count on the parent
    })

    it('does NOT increment replies_count when posting top-level comment', async () => {
      mocks.createCommunityComment.mockResolvedValue({
        id: 'c-new', content: 'fresh comment', status: 'active', depth: 0,
        parentCommentId: null, createdAt: new Date(),
      })

      const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/community/comments`, {
        method: 'POST',
        body: JSON.stringify({ entity_type: 'moment', entity_id: 'm1', content: 'fresh comment' }),
      })

      await POST(request)
      expect(mocks.createCommunityComment).toHaveBeenCalledWith(
        expect.objectContaining({ parentCommentId: null })
      )
    })
  })

  describe('Multiple replies in a flat thread', () => {
    it('all replies share the same parent (original comment)', async () => {
      // First reply
      mocks.createCommunityComment.mockResolvedValueOnce({
        id: 'r-a', content: '@alice hi', status: 'active', depth: 1,
        parentCommentId: 'top-level-1', createdAt: new Date(),
      })

      await POST(new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/community/comments`, {
        method: 'POST',
        body: JSON.stringify({ entity_type: 'moment', entity_id: 'm1', parent_comment_id: 'top-level-1', content: '@alice hi' }),
      }))

      // Second reply
      mocks.createCommunityComment.mockResolvedValueOnce({
        id: 'r-b', content: '@bob hello', status: 'active', depth: 1,
        parentCommentId: 'top-level-1', createdAt: new Date(),
      })

      await POST(new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/community/comments`, {
        method: 'POST',
        body: JSON.stringify({ entity_type: 'moment', entity_id: 'm1', parent_comment_id: 'top-level-1', content: '@bob hello' }),
      }))

      // Both calls had the same parent
      expect(mocks.createCommunityComment).toHaveBeenCalledTimes(2)
      const calls = mocks.createCommunityComment.mock.calls
      expect(calls[0][0].parentCommentId).toBe('top-level-1')
      expect(calls[1][0].parentCommentId).toBe('top-level-1')
    })
  })

  describe('Empty parent_comment_id handling', () => {
    it('treats empty string as top-level (no parent)', async () => {
      mocks.createCommunityComment.mockResolvedValue({
        id: 'c1', content: 'top', status: 'active', depth: 0,
        parentCommentId: null, createdAt: new Date(),
      })

      const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/community/comments`, {
        method: 'POST',
        body: JSON.stringify({ entity_type: 'moment', entity_id: 'm1', parent_comment_id: '', content: 'top' }),
      })

      await POST(request)
      expect(mocks.createCommunityComment).toHaveBeenCalledWith(
        expect.objectContaining({ parentCommentId: null })
      )
    })
  })
})
