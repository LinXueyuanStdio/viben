import { describe, it, expect, beforeEach, vi } from 'vitest'
import { IdentityServiceImpl } from '../identity-service.js'
import { formatIdentityId } from '../types.js'
import type { IdentityStore } from '../store/identity-store.js'
import type { UserRecord, IdentityRecord, IdentityId, UserRole } from '../types.js'

// ─── In-memory store for testing ───

function createMemoryStore(): IdentityStore {
  const users = new Map<string, UserRecord>()
  const identities = new Map<string, IdentityRecord>()
  const usernameIdx = new Map<string, string>()
  const sourceIdx = new Map<string, IdentityId>()

  return {
    getUser: async (id) => users.get(id),
    putUser: async (record) => { users.set(record.userId, record) },
    deleteUser: async (id) => { users.delete(id) },
    listUsers: async (filter) => {
      let all = [...users.values()]
      if (filter?.role) all = all.filter((u) => u.role === filter.role)
      if (filter?.source) {
        all = all.filter((u) => u.identities.some((id) => id.startsWith(`${filter.source}:`)))
      }
      return all
    },
    getIdentity: async (id) => identities.get(id),
    putIdentity: async (record) => { identities.set(record.identityId, record) },
    deleteIdentity: async (id) => { identities.delete(id) },
    getIdentitiesForUser: async (userId) => {
      const user = users.get(userId)
      if (!user) return []
      return user.identities
        .map((id) => identities.get(id))
        .filter((r): r is IdentityRecord => r !== undefined)
    },
    getUserIdByUsername: async (username) => usernameIdx.get(username.toLowerCase()),
    getIdentityIdBySource: async (source, platformId) =>
      sourceIdx.get(`${source}/${platformId}`),
    setUsernameIndex: async (username, userId) => { usernameIdx.set(username.toLowerCase(), userId) },
    deleteUsernameIndex: async (username) => { usernameIdx.delete(username.toLowerCase()) },
    setSourceIndex: async (source, platformId, identityId) => {
      sourceIdx.set(`${source}/${platformId}`, identityId)
    },
    deleteSourceIndex: async (source, platformId) => {
      sourceIdx.delete(`${source}/${platformId}`)
    },
    getUserCount: async () => users.size,
  }
}

describe('IdentityServiceImpl', () => {
  let store: IdentityStore
  let emitEvent: ReturnType<typeof vi.fn>
  let service: IdentityServiceImpl

  beforeEach(() => {
    store = createMemoryStore()
    emitEvent = vi.fn()
    service = new IdentityServiceImpl(store, emitEvent)
  })

  // ─── createUserWithIdentity ───

  describe('createUserWithIdentity()', () => {
    it('creates user and identity with generated userId', async () => {
      const { user, identity } = await service.createUserWithIdentity({
        displayName: 'Alice',
        source: 'telegram',
        platformId: '100',
      })

      expect(user.userId).toMatch(/^u_/)
      expect(user.displayName).toBe('Alice')
      expect(user.role).toBe('admin') // first user → admin
      expect(user.identities).toContain(identity.identityId)
      expect(identity.source).toBe('telegram')
      expect(identity.platformId).toBe('100')
      expect(identity.userId).toBe(user.userId)
    })

    it('first user is always admin regardless of requested role', async () => {
      const { user } = await service.createUserWithIdentity({
        displayName: 'Alice',
        source: 'telegram',
        platformId: '1',
        role: 'viewer',
      })
      expect(user.role).toBe('admin')
    })

    it('subsequent users respect the provided role', async () => {
      await service.createUserWithIdentity({ displayName: 'Admin', source: 'telegram', platformId: '1' })
      const { user } = await service.createUserWithIdentity({
        displayName: 'Bob',
        source: 'discord',
        platformId: '2',
        role: 'viewer',
      })
      expect(user.role).toBe('viewer')
    })

    it('subsequent users default to member when no role given', async () => {
      await service.createUserWithIdentity({ displayName: 'Admin', source: 'telegram', platformId: '1' })
      const { user } = await service.createUserWithIdentity({ displayName: 'Bob', source: 'discord', platformId: '2' })
      expect(user.role).toBe('member')
    })

    it('sets username index when username provided', async () => {
      const { user } = await service.createUserWithIdentity({
        displayName: 'Alice',
        username: 'alice',
        source: 'telegram',
        platformId: '1',
      })
      expect(await service.getUserByUsername('alice')).toEqual(user)
    })

    it('emits identity:created with userId, identityId, source, and displayName', async () => {
      const { user, identity } = await service.createUserWithIdentity({
        displayName: 'Alice',
        source: 'telegram',
        platformId: '1',
      })
      expect(emitEvent).toHaveBeenCalledWith('identity:created', {
        userId: user.userId,
        identityId: identity.identityId,
        source: 'telegram',
        displayName: 'Alice',
      })
    })
  })

  // ─── updateUser ───

  describe('updateUser()', () => {
    it('updates displayName', async () => {
      const { user } = await service.createUserWithIdentity({ displayName: 'Alice', source: 'telegram', platformId: '1' })
      const updated = await service.updateUser(user.userId, { displayName: 'Alicia' })
      expect(updated.displayName).toBe('Alicia')
    })

    it('bumps updatedAt', async () => {
      const { user } = await service.createUserWithIdentity({ displayName: 'Alice', source: 'telegram', platformId: '1' })
      const before = user.updatedAt
      // Tiny delay to ensure timestamp differs
      await new Promise((r) => setTimeout(r, 1))
      const updated = await service.updateUser(user.userId, { displayName: 'Alicia' })
      expect(updated.updatedAt).not.toBe(before)
    })

    it('throws for unknown userId', async () => {
      await expect(service.updateUser('u_ghost', { displayName: 'X' })).rejects.toThrow('User not found')
    })

    it('updates username index when username changes', async () => {
      const { user } = await service.createUserWithIdentity({
        displayName: 'Alice', username: 'alice', source: 'telegram', platformId: '1',
      })
      await service.updateUser(user.userId, { username: 'alicia' })

      expect(await service.getUserByUsername('alicia')).toBeDefined()
      // Old index entry should be gone
      expect(await service.getUserByUsername('alice')).toBeUndefined()
    })

    it('throws when username is already taken by another user', async () => {
      await service.createUserWithIdentity({ displayName: 'Admin', source: 'telegram', platformId: '1' })
      const { user: bob } = await service.createUserWithIdentity({
        displayName: 'Bob', username: 'bob', source: 'discord', platformId: '2',
      })
      await service.createUserWithIdentity({
        displayName: 'Carol', username: 'carol', source: 'slack', platformId: '3',
      })

      await expect(service.updateUser(bob.userId, { username: 'carol' })).rejects.toThrow('already taken')
    })
  })

  // ─── setRole ───

  describe('setRole()', () => {
    it('changes the user role', async () => {
      const { user } = await service.createUserWithIdentity({ displayName: 'Alice', source: 'telegram', platformId: '1' })
      await service.setRole(user.userId, 'blocked')
      const fetched = await service.getUser(user.userId)
      expect(fetched?.role).toBe('blocked')
    })

    it('emits identity:roleChanged with old and new role', async () => {
      const { user } = await service.createUserWithIdentity({ displayName: 'Alice', source: 'telegram', platformId: '1' })
      emitEvent.mockClear()
      await service.setRole(user.userId, 'viewer')
      expect(emitEvent).toHaveBeenCalledWith('identity:roleChanged', {
        userId: user.userId,
        oldRole: 'admin',
        newRole: 'viewer',
      })
    })

    it('throws for unknown userId', async () => {
      await expect(service.setRole('u_ghost', 'member')).rejects.toThrow('User not found')
    })
  })

  // ─── createIdentity ───

  describe('createIdentity()', () => {
    it('adds identity to existing user', async () => {
      const { user } = await service.createUserWithIdentity({ displayName: 'Alice', source: 'telegram', platformId: '1' })
      const identity = await service.createIdentity(user.userId, { source: 'discord', platformId: '42' })

      expect(identity.userId).toBe(user.userId)
      expect(identity.source).toBe('discord')

      const fetched = await service.getUser(user.userId)
      expect(fetched?.identities).toContain(identity.identityId)
    })

    it('throws for unknown userId', async () => {
      await expect(service.createIdentity('u_ghost', { source: 'discord', platformId: '1' })).rejects.toThrow('User not found')
    })
  })

  // ─── link ───

  describe('link()', () => {
    it('is a no-op when both identities already share a user', async () => {
      const { user, identity } = await service.createUserWithIdentity({ displayName: 'Alice', source: 'telegram', platformId: '1' })
      const identity2 = await service.createIdentity(user.userId, { source: 'discord', platformId: '2' })
      emitEvent.mockClear()

      await service.link(identity.identityId, identity2.identityId)

      expect(emitEvent).not.toHaveBeenCalled()
      // User still exists with both identities
      const fetched = await service.getUser(user.userId)
      expect(fetched?.identities).toHaveLength(2)
    })

    it('merges younger user into older user', async () => {
      const { user: alice, identity: aliceId } = await service.createUserWithIdentity({
        displayName: 'Alice', source: 'telegram', platformId: '1',
      })
      const { user: bob, identity: bobId } = await service.createUserWithIdentity({
        displayName: 'Bob', source: 'discord', platformId: '2',
      })

      await service.link(aliceId.identityId, bobId.identityId)

      // Alice is older (created first) — she should survive
      const survivorAlice = await service.getUser(alice.userId)
      expect(survivorAlice).toBeDefined()
      expect(survivorAlice?.identities).toContain(aliceId.identityId)
      expect(survivorAlice?.identities).toContain(bobId.identityId)

      // Bob's user record should be gone
      expect(await service.getUser(bob.userId)).toBeUndefined()
    })

    it('moves identities from merged user to survivor', async () => {
      const { user: alice, identity: aliceId } = await service.createUserWithIdentity({
        displayName: 'Alice', source: 'telegram', platformId: '1',
      })
      const { identity: bobId } = await service.createUserWithIdentity({
        displayName: 'Bob', source: 'discord', platformId: '2',
      })

      await service.link(aliceId.identityId, bobId.identityId)

      const movedIdentity = await service.getIdentity(bobId.identityId)
      expect(movedIdentity?.userId).toBe(alice.userId)
    })

    it('merges pluginData — survivor namespace wins', async () => {
      const { user: alice, identity: aliceId } = await service.createUserWithIdentity({
        displayName: 'Alice', source: 'telegram', platformId: '1',
      })
      const { user: bob, identity: bobId } = await service.createUserWithIdentity({
        displayName: 'Bob', source: 'discord', platformId: '2',
      })

      // Both have data in 'context' namespace; only Bob has 'usage'
      await service.setPluginData(alice.userId, 'context', 'history', ['msg1'])
      await service.setPluginData(bob.userId, 'context', 'history', ['msg2'])
      await service.setPluginData(bob.userId, 'usage', 'tokens', 500)

      await service.link(aliceId.identityId, bobId.identityId)

      // Alice's 'context' wins
      expect(await service.getPluginData(alice.userId, 'context', 'history')).toEqual(['msg1'])
      // Bob's 'usage' fills in the missing namespace
      expect(await service.getPluginData(alice.userId, 'usage', 'tokens')).toBe(500)
    })

    it('removes merged user username index', async () => {
      const { identity: aliceId } = await service.createUserWithIdentity({
        displayName: 'Alice', source: 'telegram', platformId: '1',
      })
      const { user: bob, identity: bobId } = await service.createUserWithIdentity({
        displayName: 'Bob', username: 'bob', source: 'discord', platformId: '2',
      })

      await service.link(aliceId.identityId, bobId.identityId)

      // Bob's username index should be cleaned up since his user was deleted
      expect(await service.getUserByUsername('bob')).toBeUndefined()
    })

    it('emits identity:linked and identity:userMerged', async () => {
      const { user: alice, identity: aliceId } = await service.createUserWithIdentity({
        displayName: 'Alice', source: 'telegram', platformId: '1',
      })
      const { user: bob, identity: bobId } = await service.createUserWithIdentity({
        displayName: 'Bob', source: 'discord', platformId: '2',
      })
      emitEvent.mockClear()

      await service.link(aliceId.identityId, bobId.identityId)

      // Alice is older — she survives; Bob's identity is linked into her account
      expect(emitEvent).toHaveBeenCalledWith('identity:linked', {
        userId: alice.userId,
        identityId: bobId.identityId,
        linkedFrom: bob.userId,
      })
      expect(emitEvent).toHaveBeenCalledWith('identity:userMerged', {
        keptUserId: alice.userId,
        mergedUserId: bob.userId,
        movedIdentities: [bobId.identityId],
      })
    })

    it('throws when identity not found', async () => {
      const { identity } = await service.createUserWithIdentity({ displayName: 'Alice', source: 'telegram', platformId: '1' })
      const ghost = formatIdentityId('discord', '999') as IdentityId
      await expect(service.link(identity.identityId, ghost)).rejects.toThrow('Identity not found')
    })
  })

  // ─── unlink ───

  describe('unlink()', () => {
    it('throws when trying to unlink last identity', async () => {
      const { identity } = await service.createUserWithIdentity({ displayName: 'Alice', source: 'telegram', platformId: '1' })
      await expect(service.unlink(identity.identityId)).rejects.toThrow('Cannot unlink the last identity')
    })

    it('separates identity into a new user account', async () => {
      const { user, identity: id1 } = await service.createUserWithIdentity({ displayName: 'Alice', source: 'telegram', platformId: '1' })
      const id2 = await service.createIdentity(user.userId, { source: 'discord', platformId: '2' })

      await service.unlink(id2.identityId)

      // Original user no longer has the identity
      const originalUser = await service.getUser(user.userId)
      expect(originalUser?.identities).not.toContain(id2.identityId)
      expect(originalUser?.identities).toContain(id1.identityId)

      // The identity now points to a new user
      const unlinkedIdentity = await service.getIdentity(id2.identityId)
      expect(unlinkedIdentity?.userId).not.toBe(user.userId)
      const newUser = await service.getUser(unlinkedIdentity!.userId)
      expect(newUser).toBeDefined()
      expect(newUser?.identities).toContain(id2.identityId)
    })

    it('emits identity:unlinked', async () => {
      const { user, identity: id1 } = await service.createUserWithIdentity({ displayName: 'Alice', source: 'telegram', platformId: '1' })
      const id2 = await service.createIdentity(user.userId, { source: 'discord', platformId: '2' })
      emitEvent.mockClear()

      await service.unlink(id2.identityId)

      const call = emitEvent.mock.calls.find(([event]) => event === 'identity:unlinked')
      expect(call).toBeDefined()
      expect(call![0]).toBe('identity:unlinked')
      expect(call![1]).toMatchObject({
        userId: user.userId,
        identityId: id2.identityId,
      })
      // newUserId should be a fresh user ID (not the original)
      expect(call![1].newUserId).toMatch(/^u_/)
      expect(call![1].newUserId).not.toBe(user.userId)
    })

    it('throws when identity not found', async () => {
      const ghost = formatIdentityId('telegram', '999') as IdentityId
      await expect(service.unlink(ghost)).rejects.toThrow('Identity not found')
    })
  })

  // ─── Plugin data ───

  describe('setPluginData / getPluginData', () => {
    it('stores and retrieves namespaced data', async () => {
      const { user } = await service.createUserWithIdentity({ displayName: 'Alice', source: 'telegram', platformId: '1' })
      await service.setPluginData(user.userId, 'my-plugin', 'foo', 42)
      expect(await service.getPluginData(user.userId, 'my-plugin', 'foo')).toBe(42)
    })

    it('namespaces are isolated between plugins', async () => {
      const { user } = await service.createUserWithIdentity({ displayName: 'Alice', source: 'telegram', platformId: '1' })
      await service.setPluginData(user.userId, 'plugin-a', 'key', 'value-a')
      await service.setPluginData(user.userId, 'plugin-b', 'key', 'value-b')
      expect(await service.getPluginData(user.userId, 'plugin-a', 'key')).toBe('value-a')
      expect(await service.getPluginData(user.userId, 'plugin-b', 'key')).toBe('value-b')
    })

    it('returns undefined for unknown user', async () => {
      expect(await service.getPluginData('u_ghost', 'plugin', 'key')).toBeUndefined()
    })

    it('returns undefined for unset key', async () => {
      const { user } = await service.createUserWithIdentity({ displayName: 'Alice', source: 'telegram', platformId: '1' })
      expect(await service.getPluginData(user.userId, 'plugin', 'missing')).toBeUndefined()
    })

    it('throws when setting data for unknown user', async () => {
      await expect(service.setPluginData('u_ghost', 'plugin', 'key', 'value')).rejects.toThrow('User not found')
    })
  })

  // ─── resolveCanonicalMention ───

  describe('resolveCanonicalMention()', () => {
    it('returns found=false for unknown username', async () => {
      const result = await service.resolveCanonicalMention('nobody', 'telegram')
      expect(result).toEqual({ found: false })
    })

    it('returns found=false when user exists but has no identity on the source', async () => {
      await service.createUserWithIdentity({ displayName: 'Alice', username: 'alice', source: 'telegram', platformId: '1' })
      const result = await service.resolveCanonicalMention('alice', 'discord')
      expect(result).toEqual({ found: false })
    })

    it('returns platform info when user has identity on the requested source', async () => {
      const { user } = await service.createUserWithIdentity({
        displayName: 'Alice', username: 'alice', source: 'telegram', platformId: '111', platformUsername: 'alice_tg',
      })
      const result = await service.resolveCanonicalMention('alice', 'telegram')
      expect(result).toEqual({ found: true, platformId: '111', platformUsername: 'alice_tg' })
    })

    it('resolves after linking identities across platforms', async () => {
      const { user, identity: tgId } = await service.createUserWithIdentity({
        displayName: 'Alice', username: 'alice', source: 'telegram', platformId: '111', platformUsername: 'alice_tg',
      })
      const { identity: discordId } = await service.createUserWithIdentity({
        displayName: 'Alice Discord', source: 'discord', platformId: '222', platformUsername: 'alice_dc',
      })
      await service.link(tgId.identityId, discordId.identityId)

      const result = await service.resolveCanonicalMention('alice', 'discord')
      expect(result).toEqual({ found: true, platformId: '222', platformUsername: 'alice_dc' })
    })
  })

  // ─── searchUsers ───

  describe('searchUsers()', () => {
    beforeEach(async () => {
      await service.createUserWithIdentity({ displayName: 'Alice Admin', username: 'alice', source: 'telegram', platformId: '1' })
      await service.createUserWithIdentity({ displayName: 'Bob Builder', source: 'discord', platformId: '2' })
    })

    it('finds user by displayName substring', async () => {
      const result = await service.searchUsers('Alice')
      expect(result).toHaveLength(1)
      expect(result[0].displayName).toBe('Alice Admin')
    })

    it('finds user by username', async () => {
      const result = await service.searchUsers('alice')
      expect(result).toHaveLength(1)
    })

    it('is case-insensitive', async () => {
      const result = await service.searchUsers('bob')
      expect(result).toHaveLength(1)
      expect(result[0].displayName).toBe('Bob Builder')
    })

    it('returns empty array for no matches', async () => {
      expect(await service.searchUsers('xyz_nonexistent')).toHaveLength(0)
    })
  })

  // ─── getSessionsFor ───

  describe('getSessionsFor()', () => {
    it('returns empty array when no session provider configured', async () => {
      const { user } = await service.createUserWithIdentity({ displayName: 'Alice', source: 'telegram', platformId: '1' })
      expect(await service.getSessionsFor(user.userId)).toEqual([])
    })

    it('delegates to the provided session resolver', async () => {
      const sessions = [{ sessionId: 'sess-1', agentName: 'claude', channelId: 'telegram', status: 'active', createdAt: '2024-01-01T00:00:00.000Z' }]
      const getSessionsForUser = vi.fn().mockResolvedValue(sessions)
      const svc = new IdentityServiceImpl(store, emitEvent, getSessionsForUser)

      const { user } = await svc.createUserWithIdentity({ displayName: 'Alice', source: 'telegram', platformId: '1' })
      const result = await svc.getSessionsFor(user.userId)

      expect(result).toEqual(sessions)
      expect(getSessionsForUser).toHaveBeenCalledWith(user.userId)
    })
  })

  // ─── registerSource ───

  describe('registerSource()', () => {
    it('does not throw', () => {
      expect(() => service.registerSource('telegram')).not.toThrow()
      expect(() => service.registerSource('telegram')).not.toThrow() // idempotent
    })
  })

  // ─── getUserCount ───

  describe('getUserCount()', () => {
    it('returns 0 initially', async () => {
      expect(await service.getUserCount()).toBe(0)
    })

    it('increments with each created user', async () => {
      await service.createUserWithIdentity({ displayName: 'Alice', source: 'telegram', platformId: '1' })
      await service.createUserWithIdentity({ displayName: 'Bob', source: 'discord', platformId: '2' })
      expect(await service.getUserCount()).toBe(2)
    })

    it('decrements after link (merged user is deleted)', async () => {
      const { identity: id1 } = await service.createUserWithIdentity({ displayName: 'Alice', source: 'telegram', platformId: '1' })
      const { identity: id2 } = await service.createUserWithIdentity({ displayName: 'Bob', source: 'discord', platformId: '2' })
      await service.link(id1.identityId, id2.identityId)
      expect(await service.getUserCount()).toBe(1)
    })
  })
})
