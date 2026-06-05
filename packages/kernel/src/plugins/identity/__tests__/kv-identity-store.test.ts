import { describe, it, expect, beforeEach } from 'vitest'
import { KvIdentityStore } from '../store/kv-identity-store.js'
import { formatIdentityId } from '../types.js'
import type { UserRecord, IdentityRecord, IdentityId } from '../types.js'

// In-memory PluginStorage for testing — no file I/O required
function createMemoryStorage() {
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
    forSession: () => createMemoryStorage(),
  }
}

function makeUser(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    userId: 'u_test1',
    displayName: 'Test User',
    role: 'member',
    identities: [],
    pluginData: {},
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    lastSeenAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeIdentity(overrides: Partial<IdentityRecord> = {}): IdentityRecord {
  const identityId = formatIdentityId('telegram', '123')
  return {
    identityId,
    userId: 'u_test1',
    source: 'telegram',
    platformId: '123',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('KvIdentityStore', () => {
  let store: KvIdentityStore

  beforeEach(() => {
    store = new KvIdentityStore(createMemoryStorage())
  })

  // ─── User CRUD ───

  describe('getUser / putUser', () => {
    it('returns undefined for unknown userId', async () => {
      expect(await store.getUser('u_unknown')).toBeUndefined()
    })

    it('stores and retrieves a user by userId', async () => {
      const user = makeUser()
      await store.putUser(user)
      expect(await store.getUser(user.userId)).toEqual(user)
    })

    it('overwrites an existing user on putUser', async () => {
      const user = makeUser()
      await store.putUser(user)
      const updated = { ...user, displayName: 'Updated' }
      await store.putUser(updated)
      expect(await store.getUser(user.userId)).toEqual(updated)
    })
  })

  describe('deleteUser', () => {
    it('removes the user so getUser returns undefined', async () => {
      const user = makeUser()
      await store.putUser(user)
      await store.deleteUser(user.userId)
      expect(await store.getUser(user.userId)).toBeUndefined()
    })

    it('is idempotent — deleting non-existent user does not throw', async () => {
      await expect(store.deleteUser('u_ghost')).resolves.toBeUndefined()
    })
  })

  describe('listUsers', () => {
    beforeEach(async () => {
      await store.putUser(makeUser({ userId: 'u_1', role: 'admin', identities: [formatIdentityId('telegram', '1')] }))
      await store.putUser(makeUser({ userId: 'u_2', role: 'member', identities: [formatIdentityId('discord', '2')] }))
      await store.putUser(makeUser({ userId: 'u_3', role: 'viewer', identities: [formatIdentityId('telegram', '3')] }))
      await store.putUser(makeUser({ userId: 'u_4', role: 'blocked', identities: [formatIdentityId('telegram', '4')] }))
    })

    it('returns all users when no filter given', async () => {
      const users = await store.listUsers()
      expect(users).toHaveLength(4)
    })

    it('filters by role', async () => {
      const admins = await store.listUsers({ role: 'admin' })
      expect(admins).toHaveLength(1)
      expect(admins[0].userId).toBe('u_1')
    })

    it('filters by source using identity prefix', async () => {
      const telegramUsers = await store.listUsers({ source: 'telegram' })
      expect(telegramUsers).toHaveLength(3)
      expect(telegramUsers.map((u) => u.userId).sort()).toEqual(['u_1', 'u_3', 'u_4'])
    })

    it('combines role + source filters', async () => {
      const result = await store.listUsers({ role: 'member', source: 'discord' })
      expect(result).toHaveLength(1)
      expect(result[0].userId).toBe('u_2')
    })

    it('returns empty array when no users match', async () => {
      expect(await store.listUsers({ role: 'viewer', source: 'discord' })).toHaveLength(0)
    })
  })

  // ─── Identity CRUD ───

  describe('getIdentity / putIdentity', () => {
    it('returns undefined for unknown identityId', async () => {
      const id = formatIdentityId('telegram', '999')
      expect(await store.getIdentity(id)).toBeUndefined()
    })

    it('stores and retrieves an identity', async () => {
      const identity = makeIdentity()
      await store.putIdentity(identity)
      expect(await store.getIdentity(identity.identityId)).toEqual(identity)
    })

    it('overwrites existing identity', async () => {
      const identity = makeIdentity()
      await store.putIdentity(identity)
      const updated = { ...identity, platformUsername: 'newname' }
      await store.putIdentity(updated)
      expect(await store.getIdentity(identity.identityId)).toEqual(updated)
    })
  })

  describe('deleteIdentity', () => {
    it('removes the identity', async () => {
      const identity = makeIdentity()
      await store.putIdentity(identity)
      await store.deleteIdentity(identity.identityId)
      expect(await store.getIdentity(identity.identityId)).toBeUndefined()
    })

    it('is idempotent for non-existent identities', async () => {
      const id = formatIdentityId('telegram', '999')
      await expect(store.deleteIdentity(id)).resolves.toBeUndefined()
    })
  })

  describe('getIdentitiesForUser', () => {
    it('returns empty array for unknown userId', async () => {
      expect(await store.getIdentitiesForUser('u_ghost')).toEqual([])
    })

    it('returns empty array for user with no identities', async () => {
      const user = makeUser({ identities: [] })
      await store.putUser(user)
      expect(await store.getIdentitiesForUser(user.userId)).toEqual([])
    })

    it('returns all identities linked to a user', async () => {
      const id1 = makeIdentity({ identityId: formatIdentityId('telegram', '1') as IdentityId, source: 'telegram', platformId: '1' })
      const id2 = makeIdentity({ identityId: formatIdentityId('discord', '2') as IdentityId, source: 'discord', platformId: '2' })
      const user = makeUser({ identities: [id1.identityId, id2.identityId] })
      await store.putUser(user)
      await store.putIdentity(id1)
      await store.putIdentity(id2)

      const result = await store.getIdentitiesForUser(user.userId)
      expect(result).toHaveLength(2)
      expect(result.map((r) => r.identityId).sort()).toEqual([id1.identityId, id2.identityId].sort())
    })

    it('skips missing identity records gracefully', async () => {
      const id1 = makeIdentity()
      const user = makeUser({ identities: [id1.identityId] })
      await store.putUser(user)
      // Intentionally don't put the identity record

      const result = await store.getIdentitiesForUser(user.userId)
      expect(result).toHaveLength(0)
    })
  })

  // ─── Secondary indexes ───

  describe('username index', () => {
    it('returns undefined for unknown username', async () => {
      expect(await store.getUserIdByUsername('nobody')).toBeUndefined()
    })

    it('stores and resolves username → userId', async () => {
      await store.setUsernameIndex('Alice', 'u_alice')
      expect(await store.getUserIdByUsername('Alice')).toBe('u_alice')
    })

    it('is case-insensitive', async () => {
      await store.setUsernameIndex('Alice', 'u_alice')
      expect(await store.getUserIdByUsername('alice')).toBe('u_alice')
      expect(await store.getUserIdByUsername('ALICE')).toBe('u_alice')
    })

    it('deleteUsernameIndex removes the entry', async () => {
      await store.setUsernameIndex('alice', 'u_alice')
      await store.deleteUsernameIndex('alice')
      expect(await store.getUserIdByUsername('alice')).toBeUndefined()
    })
  })

  describe('source index', () => {
    it('returns undefined for unknown source+platformId', async () => {
      expect(await store.getIdentityIdBySource('telegram', '999')).toBeUndefined()
    })

    it('stores and resolves source+platformId → identityId', async () => {
      const identityId = formatIdentityId('telegram', '123')
      await store.setSourceIndex('telegram', '123', identityId)
      expect(await store.getIdentityIdBySource('telegram', '123')).toBe(identityId)
    })

    it('deleteSourceIndex removes the entry', async () => {
      const identityId = formatIdentityId('telegram', '123')
      await store.setSourceIndex('telegram', '123', identityId)
      await store.deleteSourceIndex('telegram', '123')
      expect(await store.getIdentityIdBySource('telegram', '123')).toBeUndefined()
    })

    it('different sources with same platformId are independent', async () => {
      const telegramId = formatIdentityId('telegram', '123')
      const discordId = formatIdentityId('discord', '123')
      await store.setSourceIndex('telegram', '123', telegramId)
      await store.setSourceIndex('discord', '123', discordId)

      expect(await store.getIdentityIdBySource('telegram', '123')).toBe(telegramId)
      expect(await store.getIdentityIdBySource('discord', '123')).toBe(discordId)
    })
  })

  // ─── getUserCount ───

  describe('getUserCount', () => {
    it('returns 0 when no users', async () => {
      expect(await store.getUserCount()).toBe(0)
    })

    it('returns correct count after insertions', async () => {
      await store.putUser(makeUser({ userId: 'u_1' }))
      await store.putUser(makeUser({ userId: 'u_2' }))
      expect(await store.getUserCount()).toBe(2)
    })

    it('decrements after deleteUser', async () => {
      await store.putUser(makeUser({ userId: 'u_1' }))
      await store.putUser(makeUser({ userId: 'u_2' }))
      await store.deleteUser('u_1')
      expect(await store.getUserCount()).toBe(1)
    })
  })
})
