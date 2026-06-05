import { describe, it, expect, beforeEach, vi } from 'vitest'
import { IdentityServiceImpl } from '../identity-service.js'
import { KvIdentityStore } from '../store/kv-identity-store.js'
import { createAutoRegisterHandler } from '../middleware/auto-register.js'
import { formatIdentityId } from '../types.js'
import type { IdentityStore } from '../store/identity-store.js'
import type { UserRecord, IdentityRecord, IdentityId } from '../types.js'

// ─── Helpers ───

/** In-memory PluginStorage — matches the interface used by KvIdentityStore */
function createMockStorage() {
  const data = new Map<string, unknown>()
  return {
    get: async <T>(key: string) => (data.has(key) ? (data.get(key) as T) : undefined),
    set: async <T>(key: string, value: T) => { data.set(key, value) },
    delete: async (key: string) => { data.delete(key) },
    list: async () => [...data.keys()],
    keys: async (prefix?: string) => {
      const all = [...data.keys()]
      return prefix ? all.filter((k) => k.startsWith(prefix)) : all
    },
    clear: async () => { data.clear() },
    getDataDir: () => '/tmp/test',
    forSession: () => createMockStorage(),
  }
}

function makePayload(overrides: Partial<{
  channelId: string
  userId: string
  threadId: string
  text: string
  meta: Record<string, unknown>
}> = {}) {
  return {
    channelId: 'telegram',
    threadId: 't1',
    userId: 'user123',
    text: 'hello',
    meta: {} as Record<string, unknown>,
    ...overrides,
  }
}

// ─── Suite ───

describe('createAutoRegisterHandler', () => {
  let store: KvIdentityStore
  let service: IdentityServiceImpl
  let emitEvent: ReturnType<typeof vi.fn>
  let next: ReturnType<typeof vi.fn>
  let handler: ReturnType<typeof createAutoRegisterHandler>

  beforeEach(() => {
    store = new KvIdentityStore(createMockStorage())
    emitEvent = vi.fn()
    service = new IdentityServiceImpl(store, emitEvent)
    next = vi.fn().mockResolvedValue(undefined)
    handler = createAutoRegisterHandler(service, store)
  })

  it('creates user + identity for an unknown identity and injects meta.identity', async () => {
    const payload = makePayload({
      channelId: 'telegram',
      userId: 'user123',
      meta: {
        channelUser: { channelId: 'telegram', userId: 'user123', displayName: 'Alice', username: 'alice' },
      },
    })

    await handler(payload, next)

    expect(next).toHaveBeenCalledOnce()

    // Identity should now exist in store
    const identityId = formatIdentityId('telegram', 'user123')
    const identity = await store.getIdentity(identityId)
    expect(identity).toBeDefined()
    expect(identity?.platformDisplayName).toBe('Alice')
    expect(identity?.platformUsername).toBe('alice')

    // User should exist
    const user = await store.getUser(identity!.userId)
    expect(user).toBeDefined()
    expect(user?.displayName).toBe('Alice')

    // meta.identity injected
    expect(payload.meta.identity).toMatchObject({
      identityId,
      displayName: 'Alice',
      username: 'alice',
    })
  })

  it('does not create a new user on subsequent messages — reuses existing identity', async () => {
    const payload = makePayload({
      meta: {
        channelUser: { channelId: 'telegram', userId: 'user123', displayName: 'Alice' },
      },
    })

    // First message — creates
    await handler(payload, next)
    const countAfterFirst = await service.getUserCount()

    // Second message
    const payload2 = makePayload({ meta: { channelUser: { channelId: 'telegram', userId: 'user123', displayName: 'Alice' } } })
    await handler(payload2, next)

    const countAfterSecond = await service.getUserCount()
    expect(countAfterSecond).toBe(countAfterFirst)
    expect(next).toHaveBeenCalledTimes(2)
  })

  it('injects meta.identity on subsequent messages', async () => {
    const payload = makePayload({ meta: {} })
    await handler(payload, next)

    const payload2 = makePayload({ meta: {} })
    await handler(payload2, next)

    expect(payload2.meta.identity).toBeDefined()
    expect((payload2.meta.identity as any).userId).toBeTruthy()
  })

  it('assigns admin role to the first user ever created', async () => {
    const payload = makePayload({ meta: {} })
    await handler(payload, next)

    const identityId = formatIdentityId('telegram', 'user123')
    const identity = await store.getIdentity(identityId)
    const user = await store.getUser(identity!.userId)

    expect(user?.role).toBe('admin')
  })

  it('assigns member role to subsequent users', async () => {
    // First user → admin
    await handler(makePayload({ userId: 'user1', meta: {} }), next)

    // Second user → member
    const payload2 = makePayload({ userId: 'user2', meta: {} })
    await handler(payload2, next)

    const identityId2 = formatIdentityId('telegram', 'user2')
    const identity2 = await store.getIdentity(identityId2)
    const user2 = await store.getUser(identity2!.userId)

    expect(user2?.role).toBe('member')
  })

  it('syncs platform displayName when it changes', async () => {
    // First message — sets initial displayName
    await handler(
      makePayload({ meta: { channelUser: { channelId: 'telegram', userId: 'user123', displayName: 'Alice' } } }),
      next,
    )

    // Second message — adapter reports new displayName
    await handler(
      makePayload({ meta: { channelUser: { channelId: 'telegram', userId: 'user123', displayName: 'Alice Smith' } } }),
      next,
    )

    const identityId = formatIdentityId('telegram', 'user123')
    const identity = await store.getIdentity(identityId)
    expect(identity?.platformDisplayName).toBe('Alice Smith')
  })

  it('falls back to userId as displayName when channelUser is missing', async () => {
    const payload = makePayload({ userId: 'raw_id_42', meta: {} })
    await handler(payload, next)

    const identityId = formatIdentityId('telegram', 'raw_id_42')
    const identity = await store.getIdentity(identityId)
    const user = await store.getUser(identity!.userId)

    expect(user?.displayName).toBe('raw_id_42')
  })

  it('throttles lastSeenAt updates — two rapid calls produce only one write', async () => {
    // First call — creates user
    await handler(makePayload({ meta: {} }), next)

    const putUserSpy = vi.spyOn(store, 'putUser')

    // Two rapid calls — second should not persist lastSeenAt again
    await handler(makePayload({ meta: {} }), next)
    await handler(makePayload({ meta: {} }), next)

    // Only one lastSeenAt update should have been written (the first seen update)
    // Both rapid calls share the same throttle window, so only the first fires
    const lastSeenCalls = putUserSpy.mock.calls.filter(([record]) =>
      typeof record === 'object' && 'lastSeenAt' in record,
    )
    expect(lastSeenCalls.length).toBeLessThanOrEqual(1)
  })

  it('still calls next() even when no meta is provided', async () => {
    const payload = { channelId: 'telegram', threadId: 't1', userId: 'user999', text: 'hi' }
    await handler(payload, next)
    expect(next).toHaveBeenCalledOnce()
  })
})
