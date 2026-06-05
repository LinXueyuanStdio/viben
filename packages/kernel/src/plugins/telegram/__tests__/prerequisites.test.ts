import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validateBotAdmin } from '../validators.js'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function makeMeResponse(botId: number) {
  return { ok: true, status: 200, json: async () => ({ ok: true, result: { id: botId } }) }
}

function makeMemberResponse(status: string, canManageTopics: boolean) {
  return {
    ok: true, status: 200,
    json: async () => ({
      ok: true,
      result: { status, can_manage_topics: canManageTopics },
    }),
  }
}

describe('validateBotAdmin', () => {
  beforeEach(() => mockFetch.mockReset())

  it('returns ok:true with canManageTopics:true when bot is admin with topic perm', async () => {
    mockFetch
      .mockResolvedValueOnce(makeMeResponse(42))
      .mockResolvedValueOnce(makeMemberResponse('administrator', true))

    const result = await validateBotAdmin('token123', -1001234)
    expect(result).toEqual({ ok: true, canManageTopics: true })
  })

  it('returns ok:true with canManageTopics:false when bot is admin without topic perm', async () => {
    mockFetch
      .mockResolvedValueOnce(makeMeResponse(42))
      .mockResolvedValueOnce(makeMemberResponse('administrator', false))

    const result = await validateBotAdmin('token123', -1001234)
    expect(result).toEqual({ ok: true, canManageTopics: false })
  })

  it('returns ok:true with canManageTopics:true when bot is creator', async () => {
    mockFetch
      .mockResolvedValueOnce(makeMeResponse(42))
      .mockResolvedValueOnce(makeMemberResponse('creator', false))

    const result = await validateBotAdmin('token123', -1001234)
    // creator always has all permissions
    expect(result).toEqual({ ok: true, canManageTopics: true })
  })

  it('returns ok:false when bot is not admin', async () => {
    mockFetch
      .mockResolvedValueOnce(makeMeResponse(42))
      .mockResolvedValueOnce(makeMemberResponse('member', false))

    const result = await validateBotAdmin('token123', -1001234)
    expect(result.ok).toBe(false)
  })

  it('returns ok:false when fetch throws (network error)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network timeout'))

    const result = await validateBotAdmin('token123', -1001234)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('Network timeout')
    }
  })
})

import { checkTopicsPrerequisites } from '../validators.js'

function makeChatResponse(type: string, isForum: boolean) {
  return {
    ok: true, status: 200,
    json: async () => ({
      ok: true,
      result: { type, is_forum: isForum, title: 'My Group' },
    }),
  }
}

describe('checkTopicsPrerequisites', () => {
  beforeEach(() => mockFetch.mockReset())

  it('returns ok:true when all checks pass', async () => {
    mockFetch
      .mockResolvedValueOnce(makeChatResponse('supergroup', true))   // getChat
      .mockResolvedValueOnce(makeMeResponse(42))                      // getMe (inside validateBotAdmin)
      .mockResolvedValueOnce(makeMemberResponse('administrator', true)) // getChatMember

    const result = await checkTopicsPrerequisites('token', -1001234)
    expect(result).toEqual({ ok: true })
  })

  it('returns issues when topics not enabled', async () => {
    mockFetch
      .mockResolvedValueOnce(makeChatResponse('supergroup', false))
      .mockResolvedValueOnce(makeMeResponse(42))
      .mockResolvedValueOnce(makeMemberResponse('administrator', true))

    const result = await checkTopicsPrerequisites('token', -1001234)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.some(i => i.includes('Topics'))).toBe(true)
    }
  })

  it('returns issues when bot is not admin', async () => {
    mockFetch
      .mockResolvedValueOnce(makeChatResponse('supergroup', true))
      .mockResolvedValueOnce(makeMeResponse(42))
      .mockResolvedValueOnce(makeMemberResponse('member', false))

    const result = await checkTopicsPrerequisites('token', -1001234)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.some(i => i.toLowerCase().includes('admin'))).toBe(true)
    }
  })

  it('returns issues when bot lacks can_manage_topics', async () => {
    mockFetch
      .mockResolvedValueOnce(makeChatResponse('supergroup', true))
      .mockResolvedValueOnce(makeMeResponse(42))
      .mockResolvedValueOnce(makeMemberResponse('administrator', false))

    const result = await checkTopicsPrerequisites('token', -1001234)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.some(i => i.toLowerCase().includes('manage topics'))).toBe(true)
    }
  })

  it('returns multiple issues when multiple checks fail', async () => {
    mockFetch
      .mockResolvedValueOnce(makeChatResponse('supergroup', false))
      .mockResolvedValueOnce(makeMeResponse(42))
      .mockResolvedValueOnce(makeMemberResponse('member', false))

    const result = await checkTopicsPrerequisites('token', -1001234)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.length).toBeGreaterThanOrEqual(2)
    }
  })
})
