# Core Identity & Push Notification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a built-in identity plugin with User + Identity model, cross-platform linking, role-based access, and a push notification service with `ctx.notify()` API.

**Architecture:** Two systems built on top of each other. Phase 1 adds the identity plugin (`@viben/identity`) as a built-in core plugin with its own storage, middleware, commands, and REST routes. Phase 2 replaces the existing `NotificationManager` with a new `NotificationService` that resolves targets through the identity system and delivers via `sendUserNotification()` on adapters. Both systems are backward compatible — existing tokens, sessions, and adapters continue to work without changes.

**Tech Stack:** TypeScript (ES2022, NodeNext), Vitest, PluginStorage (kv.json), Fastify (REST routes)

**Specs:**
- [Core Identity System](../specs/2026-04-12-core-identity-system-design.md)
- [Core Push Notification System](../specs/2026-04-12-core-push-notification-design.md)

---

## File Structure

### New files (Identity)

```
src/plugins/identity/
  index.ts                    — Plugin entry point (VibenPlugin)
  identity-service.ts         — IdentityService implementation
  types.ts                    — UserRecord, IdentityRecord, UserRole, IdentityId types
  store/
    identity-store.ts         — Abstract IdentityStore interface
    kv-identity-store.ts      — PluginStorage-backed implementation
  middleware/
    auto-register.ts          — message:incoming auto-registration middleware
  routes/
    users.ts                  — User CRUD routes
    setup.ts                  — /identity/setup + /identity/link-code
  __tests__/
    identity-service.test.ts  — IdentityService unit tests
    kv-identity-store.test.ts — KvIdentityStore unit tests
    auto-register.test.ts     — Auto-registration middleware tests
```

### Modified files (Core types)

```
src/core/plugin/types.ts      — Add PluginPermission entries, PluginContext.notify()
src/core/event-bus.ts          — Add identity lifecycle events to EventBusEvents
src/core/events.ts             — Add BusEvent constants for identity events
src/core/types.ts              — Add createdBy/participants to SessionRecord
src/core/channel.ts            — Add sendUserNotification?() to IChannelAdapter
src/core/plugin/plugin-context.ts — Add ctx.notify() method
src/core/sessions/session-factory.ts — Add userId to SessionCreateParams + beforeCreate payload
```

### Modified files (Existing plugins)

```
src/plugins/core-plugins.ts         — Add identityPlugin to boot list
src/plugins/notifications/notification.ts — Extend to NotificationService
src/plugins/notifications/index.ts  — Wire identity service dependency
src/plugins/api-server/auth/types.ts — Add userId? to StoredToken
src/plugins/api-server/auth/token-store.ts — Expose setUserId() method
src/plugins/api-server/routes/auth.ts — Update /me response
src/plugins/sse-adapter/connection-manager.ts — Add user-level connections
```

---

## Phase 1: Core Identity System

### Task 1: Identity types

**Files:**
- Create: `src/plugins/identity/types.ts`

- [ ] **Step 1: Create identity type definitions**

```typescript
// src/plugins/identity/types.ts

/**
 * Branded string type for identity IDs. Format: '{source}:{platformId}'.
 * Collision between identity spaces is structurally impossible.
 */
export type IdentityId = string & { readonly __brand: 'IdentityId' }

/** Validates and creates an IdentityId from source and platformId. */
export function formatIdentityId(source: string, platformId: string): IdentityId {
  return `${source}:${platformId}` as IdentityId
}

/** Splits an IdentityId into its source and platformId components. */
export function parseIdentityId(id: IdentityId): { source: string; platformId: string } {
  const colonIdx = id.indexOf(':')
  if (colonIdx === -1) throw new Error(`Invalid IdentityId: ${id}`)
  return { source: id.slice(0, colonIdx), platformId: id.slice(colonIdx + 1) }
}

/** Access level within the system. Controls session creation, messaging, and admin actions. */
export type UserRole = 'admin' | 'member' | 'viewer' | 'blocked'

/**
 * A person in the system. One UserRecord can have multiple IdentityRecords
 * across different platforms (Telegram, Discord, App, etc.).
 *
 * Core fields are typed and validated; plugin-specific data is namespaced
 * in pluginData to prevent collision between plugins.
 */
export interface UserRecord {
  userId: string
  displayName: string
  username?: string
  avatarUrl?: string
  role: UserRole
  timezone?: string
  locale?: string
  identities: IdentityId[]
  pluginData: Record<string, Record<string, unknown>>
  createdAt: string
  updatedAt: string
  lastSeenAt: string
}

/**
 * A single platform account. Multiple IdentityRecords can belong to one UserRecord.
 * Platform-specific fields (platformUsername, platformDisplayName) are used by adapters
 * for native mention rendering and notification delivery.
 */
export interface IdentityRecord {
  identityId: IdentityId
  userId: string
  source: string
  platformId: string
  platformUsername?: string
  platformDisplayName?: string
  createdAt: string
  updatedAt: string
}

/** Lightweight session info returned by getSessionsFor(). */
export interface SessionInfo {
  sessionId: string
  agentName: string
  channelId: string
  status: string
  createdAt: string
}

/** Public API for the identity service. Plugins access via ctx.getService<IdentityService>('identity'). */
export interface IdentityService {
  // Read
  getUser(userId: string): Promise<UserRecord | undefined>
  getUserByUsername(username: string): Promise<UserRecord | undefined>
  getIdentity(identityId: IdentityId): Promise<IdentityRecord | undefined>
  getUserByIdentity(identityId: IdentityId): Promise<UserRecord | undefined>
  getIdentitiesFor(userId: string): Promise<IdentityRecord[]>
  listUsers(filter?: { source?: string; role?: UserRole }): Promise<UserRecord[]>
  searchUsers(query: string): Promise<UserRecord[]>
  getSessionsFor(userId: string): Promise<SessionInfo[]>

  // Write — user management
  createUserWithIdentity(data: {
    displayName: string
    username?: string
    role?: UserRole
    source: string
    platformId: string
    platformUsername?: string
    platformDisplayName?: string
  }): Promise<{ user: UserRecord; identity: IdentityRecord }>

  updateUser(userId: string, changes: Partial<Pick<UserRecord, 'displayName' | 'username' | 'avatarUrl' | 'timezone' | 'locale'>>): Promise<UserRecord>
  setRole(userId: string, role: UserRole): Promise<void>

  // Write — identity management
  createIdentity(userId: string, identity: {
    source: string
    platformId: string
    platformUsername?: string
    platformDisplayName?: string
  }): Promise<IdentityRecord>

  link(identityIdA: IdentityId, identityIdB: IdentityId): Promise<void>
  unlink(identityId: IdentityId): Promise<void>

  // Plugin data
  setPluginData(userId: string, pluginName: string, key: string, value: unknown): Promise<void>
  getPluginData(userId: string, pluginName: string, key: string): Promise<unknown>

  // Source registration
  registerSource(source: string): void

  // Mention helper
  resolveCanonicalMention(username: string, source: string): Promise<{
    found: boolean
    platformId?: string
    platformUsername?: string
  }>

  // Stats
  getUserCount(): Promise<number>
}
```

- [ ] **Step 2: Commit**

```bash
git add src/plugins/identity/types.ts
git commit -m "feat(identity): add core identity type definitions"
```

---

### Task 2: IdentityStore interface and KvIdentityStore

**Files:**
- Create: `src/plugins/identity/store/identity-store.ts`
- Create: `src/plugins/identity/store/kv-identity-store.ts`
- Create: `src/plugins/identity/__tests__/kv-identity-store.test.ts`

- [ ] **Step 1: Write IdentityStore interface**

```typescript
// src/plugins/identity/store/identity-store.ts
import type { UserRecord, IdentityRecord, IdentityId, UserRole } from '../types.js'

/**
 * Abstract storage interface for identity data.
 * Decouples IdentityService from storage backend — v1 uses PluginStorage (kv.json),
 * future versions can swap to SQLite without changing the service layer.
 */
export interface IdentityStore {
  // Users
  getUser(userId: string): Promise<UserRecord | undefined>
  putUser(record: UserRecord): Promise<void>
  deleteUser(userId: string): Promise<void>
  listUsers(filter?: { source?: string; role?: UserRole }): Promise<UserRecord[]>

  // Identities
  getIdentity(identityId: IdentityId): Promise<IdentityRecord | undefined>
  putIdentity(record: IdentityRecord): Promise<void>
  deleteIdentity(identityId: IdentityId): Promise<void>
  getIdentitiesForUser(userId: string): Promise<IdentityRecord[]>

  // Indexes
  getUserIdByUsername(username: string): Promise<string | undefined>
  getIdentityIdBySource(source: string, platformId: string): Promise<IdentityId | undefined>

  // Index maintenance
  setUsernameIndex(username: string, userId: string): Promise<void>
  deleteUsernameIndex(username: string): Promise<void>
  setSourceIndex(source: string, platformId: string, identityId: IdentityId): Promise<void>
  deleteSourceIndex(source: string, platformId: string): Promise<void>

  // Stats
  getUserCount(): Promise<number>
}
```

- [ ] **Step 2: Write failing tests for KvIdentityStore**

```typescript
// src/plugins/identity/__tests__/kv-identity-store.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { KvIdentityStore } from '../store/kv-identity-store.js'
import type { UserRecord, IdentityRecord } from '../types.js'
import type { IdentityId } from '../types.js'

// In-memory PluginStorage mock
function createMockStorage() {
  const data = new Map<string, unknown>()
  return {
    get: async <T>(key: string) => data.get(key) as T | undefined,
    set: async <T>(key: string, value: T) => { data.set(key, value) },
    delete: async (key: string) => { data.delete(key) },
    list: async () => Array.from(data.keys()),
    keys: async (prefix?: string) => {
      const all = Array.from(data.keys())
      return prefix ? all.filter(k => k.startsWith(prefix)) : all
    },
    clear: async () => { data.clear() },
    getDataDir: () => '/tmp/test',
    forSession: () => createMockStorage() as any,
  }
}

function makeUser(overrides: Partial<UserRecord> = {}): UserRecord {
  const now = new Date().toISOString()
  return {
    userId: 'u_test123',
    displayName: 'Test User',
    role: 'member',
    identities: [] as IdentityId[],
    pluginData: {},
    createdAt: now,
    updatedAt: now,
    lastSeenAt: now,
    ...overrides,
  }
}

function makeIdentity(overrides: Partial<IdentityRecord> = {}): IdentityRecord {
  const now = new Date().toISOString()
  return {
    identityId: 'telegram:123' as IdentityId,
    userId: 'u_test123',
    source: 'telegram',
    platformId: '123',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('KvIdentityStore', () => {
  let store: KvIdentityStore

  beforeEach(() => {
    store = new KvIdentityStore(createMockStorage() as any)
  })

  describe('users', () => {
    it('should put and get a user', async () => {
      const user = makeUser()
      await store.putUser(user)
      const result = await store.getUser('u_test123')
      expect(result).toEqual(user)
    })

    it('should return undefined for missing user', async () => {
      expect(await store.getUser('nonexistent')).toBeUndefined()
    })

    it('should delete a user', async () => {
      await store.putUser(makeUser())
      await store.deleteUser('u_test123')
      expect(await store.getUser('u_test123')).toBeUndefined()
    })

    it('should list users with role filter', async () => {
      await store.putUser(makeUser({ userId: 'u_1', role: 'admin' }))
      await store.putUser(makeUser({ userId: 'u_2', role: 'member' }))
      await store.putUser(makeUser({ userId: 'u_3', role: 'admin' }))

      const admins = await store.listUsers({ role: 'admin' })
      expect(admins).toHaveLength(2)
      expect(admins.map(u => u.userId).sort()).toEqual(['u_1', 'u_3'])
    })
  })

  describe('identities', () => {
    it('should put and get an identity', async () => {
      const identity = makeIdentity()
      await store.putIdentity(identity)
      const result = await store.getIdentity('telegram:123' as IdentityId)
      expect(result).toEqual(identity)
    })

    it('should get identities for a user', async () => {
      await store.putIdentity(makeIdentity({ identityId: 'telegram:123' as IdentityId, userId: 'u_1' }))
      await store.putIdentity(makeIdentity({ identityId: 'discord:456' as IdentityId, userId: 'u_1', source: 'discord', platformId: '456' }))
      await store.putIdentity(makeIdentity({ identityId: 'telegram:789' as IdentityId, userId: 'u_2', platformId: '789' }))

      const identities = await store.getIdentitiesForUser('u_1')
      expect(identities).toHaveLength(2)
    })
  })

  describe('indexes', () => {
    it('should resolve username to userId', async () => {
      await store.setUsernameIndex('lucas', 'u_1')
      expect(await store.getUserIdByUsername('lucas')).toBe('u_1')
    })

    it('should resolve source+platformId to identityId', async () => {
      await store.setSourceIndex('telegram', '123', 'telegram:123' as IdentityId)
      expect(await store.getIdentityIdBySource('telegram', '123')).toBe('telegram:123')
    })

    it('should delete username index', async () => {
      await store.setUsernameIndex('lucas', 'u_1')
      await store.deleteUsernameIndex('lucas')
      expect(await store.getUserIdByUsername('lucas')).toBeUndefined()
    })
  })

  describe('getUserCount', () => {
    it('should return count of users', async () => {
      await store.putUser(makeUser({ userId: 'u_1' }))
      await store.putUser(makeUser({ userId: 'u_2' }))
      expect(await store.getUserCount()).toBe(2)
    })
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm test -- src/plugins/identity/__tests__/kv-identity-store.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement KvIdentityStore**

```typescript
// src/plugins/identity/store/kv-identity-store.ts
import type { PluginStorage } from '../../../core/plugin/types.js'
import type { IdentityStore } from './identity-store.js'
import type { UserRecord, IdentityRecord, IdentityId, UserRole } from '../types.js'

/**
 * PluginStorage-backed identity store.
 *
 * Uses flat key-value storage with manual indexes for username and source lookups.
 * Storage layout:
 *   users/{userId}                      → UserRecord
 *   identities/{identityId}             → IdentityRecord
 *   idx/usernames/{username}            → userId (string)
 *   idx/sources/{source}/{platformId}   → identityId (string)
 */
export class KvIdentityStore implements IdentityStore {
  constructor(private storage: PluginStorage) {}

  // --- Users ---

  async getUser(userId: string): Promise<UserRecord | undefined> {
    return this.storage.get<UserRecord>(`users/${userId}`)
  }

  async putUser(record: UserRecord): Promise<void> {
    await this.storage.set(`users/${record.userId}`, record)
  }

  async deleteUser(userId: string): Promise<void> {
    await this.storage.delete(`users/${userId}`)
  }

  async listUsers(filter?: { source?: string; role?: UserRole }): Promise<UserRecord[]> {
    const keys = await this.storage.keys('users/')
    const users: UserRecord[] = []
    for (const key of keys) {
      const user = await this.storage.get<UserRecord>(key)
      if (!user) continue
      if (filter?.role && user.role !== filter.role) continue
      if (filter?.source && !user.identities.some(id => id.startsWith(`${filter.source}:`))) continue
      users.push(user)
    }
    return users
  }

  // --- Identities ---

  async getIdentity(identityId: IdentityId): Promise<IdentityRecord | undefined> {
    return this.storage.get<IdentityRecord>(`identities/${identityId}`)
  }

  async putIdentity(record: IdentityRecord): Promise<void> {
    await this.storage.set(`identities/${record.identityId}`, record)
  }

  async deleteIdentity(identityId: IdentityId): Promise<void> {
    await this.storage.delete(`identities/${identityId}`)
  }

  async getIdentitiesForUser(userId: string): Promise<IdentityRecord[]> {
    const keys = await this.storage.keys('identities/')
    const identities: IdentityRecord[] = []
    for (const key of keys) {
      const identity = await this.storage.get<IdentityRecord>(key)
      if (identity && identity.userId === userId) identities.push(identity)
    }
    return identities
  }

  // --- Indexes ---

  async getUserIdByUsername(username: string): Promise<string | undefined> {
    return this.storage.get<string>(`idx/usernames/${username.toLowerCase()}`)
  }

  async getIdentityIdBySource(source: string, platformId: string): Promise<IdentityId | undefined> {
    return this.storage.get<IdentityId>(`idx/sources/${source}/${platformId}`)
  }

  async setUsernameIndex(username: string, userId: string): Promise<void> {
    await this.storage.set(`idx/usernames/${username.toLowerCase()}`, userId)
  }

  async deleteUsernameIndex(username: string): Promise<void> {
    await this.storage.delete(`idx/usernames/${username.toLowerCase()}`)
  }

  async setSourceIndex(source: string, platformId: string, identityId: IdentityId): Promise<void> {
    await this.storage.set(`idx/sources/${source}/${platformId}`, identityId)
  }

  async deleteSourceIndex(source: string, platformId: string): Promise<void> {
    await this.storage.delete(`idx/sources/${source}/${platformId}`)
  }

  // --- Stats ---

  async getUserCount(): Promise<number> {
    const keys = await this.storage.keys('users/')
    return keys.length
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm test -- src/plugins/identity/__tests__/kv-identity-store.test.ts`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/plugins/identity/store/ src/plugins/identity/__tests__/kv-identity-store.test.ts
git commit -m "feat(identity): add IdentityStore interface and KvIdentityStore implementation"
```

---

### Task 3: IdentityService implementation

**Files:**
- Create: `src/plugins/identity/identity-service.ts`
- Create: `src/plugins/identity/__tests__/identity-service.test.ts`

- [ ] **Step 1: Write failing tests for IdentityService**

Write tests covering:
- `createUserWithIdentity()` — creates user + identity + indexes
- `getUserByUsername()` — resolves via username index
- `getUserByIdentity()` — resolves via identity → user
- `updateUser()` — updates display name, username (with index update)
- `setRole()` — changes role
- `link()` — links two identities (same user no-op, different users merge)
- `unlink()` — separates identity into new user, error on last identity
- `resolveCanonicalMention()` — finds platform-specific info for a canonical username
- `setPluginData()` / `getPluginData()` — namespaced plugin data
- First user auto-promoted to admin

Test file: `src/plugins/identity/__tests__/identity-service.test.ts`

Use the same `createMockStorage()` helper from Task 2 tests. Create `KvIdentityStore` with mock storage, then create `IdentityServiceImpl` with the store.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm test -- src/plugins/identity/__tests__/identity-service.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement IdentityServiceImpl**

```typescript
// src/plugins/identity/identity-service.ts
import { nanoid } from 'nanoid'
import type { IdentityStore } from './store/identity-store.js'
import type {
  IdentityService, UserRecord, IdentityRecord, IdentityId, UserRole,
  formatIdentityId, parseIdentityId,
} from './types.js'
import { formatIdentityId as fmtId, parseIdentityId as parseId } from './types.js'

/**
 * Core implementation of the identity service.
 *
 * Coordinates between the IdentityStore (persistence) and EventBus (lifecycle events).
 * All write operations maintain indexes (username, source) atomically with the primary record.
 */
export class IdentityServiceImpl implements IdentityService {
  private registeredSources = new Set<string>()
  private emitEvent: (event: string, data: unknown) => void

  constructor(
    private store: IdentityStore,
    emitEvent: (event: string, data: unknown) => void,
  ) {
    this.emitEvent = emitEvent
  }

  // --- Read ---

  async getUser(userId: string) { return this.store.getUser(userId) }

  async getUserByUsername(username: string) {
    const userId = await this.store.getUserIdByUsername(username)
    if (!userId) return undefined
    return this.store.getUser(userId)
  }

  async getIdentity(identityId: IdentityId) { return this.store.getIdentity(identityId) }

  async getUserByIdentity(identityId: IdentityId) {
    const identity = await this.store.getIdentity(identityId)
    if (!identity) return undefined
    return this.store.getUser(identity.userId)
  }

  async getIdentitiesFor(userId: string) { return this.store.getIdentitiesForUser(userId) }

  async listUsers(filter?: { source?: string; role?: UserRole }) {
    return this.store.listUsers(filter)
  }

  async searchUsers(query: string): Promise<UserRecord[]> {
    const lowerQuery = query.toLowerCase()
    const allUsers = await this.store.listUsers()
    return allUsers.filter(u =>
      u.displayName.toLowerCase().includes(lowerQuery) ||
      (u.username && u.username.toLowerCase().includes(lowerQuery))
    )
  }

  // --- Write ---

  async createUserWithIdentity(data: {
    displayName: string
    username?: string
    role?: UserRole
    source: string
    platformId: string
    platformUsername?: string
    platformDisplayName?: string
  }) {
    const now = new Date().toISOString()
    const userId = `u_${nanoid(12)}`

    // First user ever → auto-promote to admin
    let role = data.role ?? 'member'
    const count = await this.store.getUserCount()
    if (count === 0) role = 'admin'

    // Check username uniqueness
    let username = data.username
    if (username) {
      const existing = await this.store.getUserIdByUsername(username)
      if (existing) username = undefined // Skip conflicting username
    }

    const identityId = fmtId(data.source, data.platformId)

    const user: UserRecord = {
      userId, displayName: data.displayName, username, role,
      identities: [identityId], pluginData: {},
      createdAt: now, updatedAt: now, lastSeenAt: now,
    }

    const identity: IdentityRecord = {
      identityId, userId, source: data.source, platformId: data.platformId,
      platformUsername: data.platformUsername,
      platformDisplayName: data.platformDisplayName,
      createdAt: now, updatedAt: now,
    }

    await this.store.putUser(user)
    await this.store.putIdentity(identity)
    await this.store.setSourceIndex(data.source, data.platformId, identityId)
    if (username) await this.store.setUsernameIndex(username, userId)

    this.emitEvent('identity:created', { userId, identityId, source: data.source, displayName: data.displayName })
    return { user, identity }
  }

  async updateUser(userId: string, changes: Partial<Pick<UserRecord, 'displayName' | 'username' | 'avatarUrl' | 'timezone' | 'locale'>>) {
    const user = await this.store.getUser(userId)
    if (!user) throw new Error(`User not found: ${userId}`)

    // Handle username change
    if (changes.username !== undefined && changes.username !== user.username) {
      if (changes.username) {
        const existing = await this.store.getUserIdByUsername(changes.username)
        if (existing && existing !== userId) throw new Error(`Username already taken: ${changes.username}`)
        await this.store.setUsernameIndex(changes.username, userId)
      }
      if (user.username) await this.store.deleteUsernameIndex(user.username)
    }

    const updated: UserRecord = { ...user, ...changes, updatedAt: new Date().toISOString() }
    await this.store.putUser(updated)
    this.emitEvent('identity:updated', { userId, changes: Object.keys(changes) })
    return updated
  }

  async setRole(userId: string, role: UserRole) {
    const user = await this.store.getUser(userId)
    if (!user) throw new Error(`User not found: ${userId}`)
    const oldRole = user.role
    await this.store.putUser({ ...user, role, updatedAt: new Date().toISOString() })
    this.emitEvent('identity:roleChanged', { userId, oldRole, newRole: role })
  }

  async createIdentity(userId: string, data: {
    source: string; platformId: string; platformUsername?: string; platformDisplayName?: string
  }) {
    const user = await this.store.getUser(userId)
    if (!user) throw new Error(`User not found: ${userId}`)

    const identityId = fmtId(data.source, data.platformId)
    const now = new Date().toISOString()

    const identity: IdentityRecord = {
      identityId, userId, source: data.source, platformId: data.platformId,
      platformUsername: data.platformUsername, platformDisplayName: data.platformDisplayName,
      createdAt: now, updatedAt: now,
    }

    await this.store.putIdentity(identity)
    await this.store.setSourceIndex(data.source, data.platformId, identityId)

    // Update user's identities list
    const updatedUser = { ...user, identities: [...user.identities, identityId], updatedAt: now }
    await this.store.putUser(updatedUser)

    return identity
  }

  async link(identityIdA: IdentityId, identityIdB: IdentityId) {
    const idA = await this.store.getIdentity(identityIdA)
    const idB = await this.store.getIdentity(identityIdB)

    if (!idA || !idB) throw new Error('One or both identities not found')
    if (idA.userId === idB.userId) return // Already same user — no-op

    const userA = await this.store.getUser(idA.userId)
    const userB = await this.store.getUser(idB.userId)
    if (!userA || !userB) throw new Error('One or both users not found')

    // Keep older user
    const [kept, merged] = userA.createdAt <= userB.createdAt ? [userA, userB] : [userB, userA]

    // Move all identities from merged → kept
    const mergedIdentities = await this.store.getIdentitiesForUser(merged.userId)
    for (const ident of mergedIdentities) {
      await this.store.putIdentity({ ...ident, userId: kept.userId, updatedAt: new Date().toISOString() })
    }

    // Merge pluginData: per-namespace, keep older's data, add missing namespaces from younger
    const mergedPluginData = { ...kept.pluginData }
    for (const [ns, data] of Object.entries(merged.pluginData)) {
      if (!mergedPluginData[ns]) mergedPluginData[ns] = data
    }

    // Update kept user
    const allIdentityIds = [...kept.identities, ...merged.identities]
    const username = kept.username ?? merged.username
    await this.store.putUser({
      ...kept,
      identities: allIdentityIds,
      username,
      pluginData: mergedPluginData,
      updatedAt: new Date().toISOString(),
    })
    if (username && !kept.username && merged.username) {
      await this.store.setUsernameIndex(username, kept.userId)
    }

    // Delete merged user
    if (merged.username && merged.username !== username) {
      await this.store.deleteUsernameIndex(merged.username)
    }
    await this.store.deleteUser(merged.userId)

    this.emitEvent('identity:linked', { userId: kept.userId, identityId: identityIdB, linkedFrom: merged.userId })
    this.emitEvent('identity:userMerged', {
      keptUserId: kept.userId, mergedUserId: merged.userId,
      movedIdentities: mergedIdentities.map(i => i.identityId),
    })
  }

  async unlink(identityId: IdentityId) {
    const identity = await this.store.getIdentity(identityId)
    if (!identity) throw new Error(`Identity not found: ${identityId}`)

    const user = await this.store.getUser(identity.userId)
    if (!user) throw new Error(`User not found: ${identity.userId}`)
    if (user.identities.length <= 1) throw new Error('Cannot unlink last identity')

    const now = new Date().toISOString()
    const newUserId = `u_${nanoid(12)}`

    // Create new user for the unlinked identity
    const newUser: UserRecord = {
      userId: newUserId, displayName: identity.platformDisplayName ?? identity.platformId,
      role: 'member', identities: [identityId], pluginData: {},
      createdAt: now, updatedAt: now, lastSeenAt: now,
    }

    // Remove identity from old user
    const updatedOldUser = {
      ...user,
      identities: user.identities.filter(id => id !== identityId),
      updatedAt: now,
    }

    await this.store.putUser(updatedOldUser)
    await this.store.putUser(newUser)
    await this.store.putIdentity({ ...identity, userId: newUserId, updatedAt: now })

    this.emitEvent('identity:unlinked', { userId: user.userId, identityId, newUserId })
  }

  // --- Plugin data ---

  async setPluginData(userId: string, pluginName: string, key: string, value: unknown) {
    const user = await this.store.getUser(userId)
    if (!user) throw new Error(`User not found: ${userId}`)
    const nsData = { ...(user.pluginData[pluginName] ?? {}), [key]: value }
    await this.store.putUser({
      ...user,
      pluginData: { ...user.pluginData, [pluginName]: nsData },
      updatedAt: new Date().toISOString(),
    })
  }

  async getPluginData(userId: string, pluginName: string, key: string) {
    const user = await this.store.getUser(userId)
    return user?.pluginData[pluginName]?.[key]
  }

  // --- Source registration ---

  registerSource(source: string) { this.registeredSources.add(source) }

  // --- Mention resolution ---

  async resolveCanonicalMention(username: string, source: string) {
    const user = await this.getUserByUsername(username)
    if (!user) return { found: false }
    const identities = await this.getIdentitiesFor(user.userId)
    const match = identities.find(i => i.source === source)
    if (!match) return { found: false }
    return { found: true, platformId: match.platformId, platformUsername: match.platformUsername }
  }

  // --- Session query ---

  /** Requires kernel:access — injected by plugin via setSessionAccessor(). */
  private sessionAccessor?: {
    listSessions(): Array<{ id: string; agentName: string; channelId: string; status: string; createdAt: string; participants?: string[] }>
  }

  setSessionAccessor(accessor: typeof this.sessionAccessor): void {
    this.sessionAccessor = accessor
  }

  async getSessionsFor(userId: string): Promise<import('./types.js').SessionInfo[]> {
    if (!this.sessionAccessor) return []
    return this.sessionAccessor.listSessions()
      .filter(s => s.participants?.includes(userId))
      .map(s => ({
        sessionId: s.id,
        agentName: s.agentName,
        channelId: s.channelId,
        status: s.status,
        createdAt: s.createdAt,
      }))
  }

  // --- Stats ---

  async getUserCount() { return this.store.getUserCount() }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm test -- src/plugins/identity/__tests__/identity-service.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/plugins/identity/identity-service.ts src/plugins/identity/__tests__/identity-service.test.ts
git commit -m "feat(identity): add IdentityService implementation with full CRUD, linking, and mention resolution"
```

---

### Task 4: Core type changes (EventBus, BusEvent, PluginPermission, SessionRecord)

**Files:**
- Modify: `src/core/event-bus.ts`
- Modify: `src/core/events.ts`
- Modify: `src/core/plugin/types.ts`
- Modify: `src/core/types.ts`

- [ ] **Step 1: Add identity events to EventBusEvents**

In `src/core/event-bus.ts`, add before the closing `}` of the `EventBusEvents` interface:

```typescript
  // Identity lifecycle (emitted by @viben/identity built-in plugin)
  "identity:created": (data: { userId: string; identityId: string; source: string; displayName: string }) => void;
  "identity:updated": (data: { userId: string; changes: string[] }) => void;
  "identity:linked": (data: { userId: string; identityId: string; linkedFrom?: string }) => void;
  "identity:unlinked": (data: { userId: string; identityId: string; newUserId: string }) => void;
  "identity:userMerged": (data: { keptUserId: string; mergedUserId: string; movedIdentities: string[] }) => void;
  "identity:roleChanged": (data: { userId: string; oldRole: string; newRole: string; changedBy?: string }) => void;
  "identity:seen": (data: { userId: string; identityId: string; sessionId: string }) => void;
```

- [ ] **Step 2: Add BusEvent constants**

In `src/core/events.ts`, add to the `BusEvent` object before the closing `} as const`:

```typescript
  // --- Identity lifecycle ---
  IDENTITY_CREATED: 'identity:created',
  IDENTITY_UPDATED: 'identity:updated',
  IDENTITY_LINKED: 'identity:linked',
  IDENTITY_UNLINKED: 'identity:unlinked',
  IDENTITY_USER_MERGED: 'identity:userMerged',
  IDENTITY_ROLE_CHANGED: 'identity:roleChanged',
  IDENTITY_SEEN: 'identity:seen',
```

- [ ] **Step 3: Add new permissions to PluginPermission**

In `src/core/plugin/types.ts`, add to the `PluginPermission` union type (after `'sessions:read'`):

```typescript
  /** Read identity data (users, identities, search) */
  | 'identity:read'
  /** Write identity data (create, update, link, unlink, roles) */
  | 'identity:write'
  /** Register an identity source (adapters register their platform name) */
  | 'identity:register-source'
  /** Send push notifications to users */
  | 'notifications:send'
```

- [ ] **Step 4: Add createdBy and participants to SessionRecord**

In `src/core/types.ts`, add to the `SessionRecord` interface (after `agentSwitchHistory?`):

```typescript
  /** userId of the user who created this session (from identity system). */
  createdBy?: string;
  /** userId[] of all users who have sent messages in this session. */
  participants?: string[];
```

- [ ] **Step 5: Run build to verify types compile**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build`
Expected: SUCCESS

- [ ] **Step 6: Commit**

```bash
git add src/core/event-bus.ts src/core/events.ts src/core/plugin/types.ts src/core/types.ts
git commit -m "feat(core): add identity events, permissions, and session record fields"
```

---

### Task 5: Fix SessionFactory userId and session:created event

**Files:**
- Modify: `src/core/sessions/session-factory.ts`

- [ ] **Step 1: Add userId to SessionCreateParams**

In `src/core/sessions/session-factory.ts`, add `userId?: string` to `SessionCreateParams`:

```typescript
export interface SessionCreateParams {
  channelId: string;
  agentName: string;
  workingDirectory: string;
  resumeAgentSessionId?: string;
  existingSessionId?: string;
  initialName?: string;
  isAssistant?: boolean;
  userId?: string;  // from identity system — who created this session
}
```

- [ ] **Step 2: Use params.userId in session:beforeCreate payload**

Replace the hardcoded `userId: ''` in the `create()` method with `params.userId ?? ''`.

Find this block in the `create()` method:
```typescript
      const payload = {
        agentName: params.agentName,
        workingDir: params.workingDirectory,
        userId: '', // userId is not part of SessionCreateParams — resolved upstream
```

Replace with:
```typescript
      const payload = {
        agentName: params.agentName,
        workingDir: params.workingDirectory,
        userId: params.userId ?? '',
```

- [ ] **Step 3: Add userId to session:created EventBus emit**

Find where `BusEvent.SESSION_CREATED` is emitted in the same file and add `userId`. Search for `this.eventBus.emit(BusEvent.SESSION_CREATED` and add the `userId` field. The current emit looks like:

```typescript
this.eventBus.emit(BusEvent.SESSION_CREATED, {
  sessionId: session.id,
  agent: session.agentName,
  status: session.status,
});
```

Update to:
```typescript
this.eventBus.emit(BusEvent.SESSION_CREATED, {
  sessionId: session.id,
  agent: session.agentName,
  status: session.status,
  userId: params.userId ?? '',
});
```

Note: The `EventBusEvents['session:created']` type must also be updated to include `userId`. In `src/core/event-bus.ts`, update the `session:created` event:

```typescript
  "session:created": (data: {
    sessionId: string;
    agent: string;
    status: SessionStatus;
    userId?: string;
  }) => void;
```

- [ ] **Step 4: Run build + existing tests**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build && pnpm test`
Expected: All existing tests still pass

- [ ] **Step 5: Commit**

```bash
git add src/core/sessions/session-factory.ts src/core/event-bus.ts
git commit -m "fix(core): pass userId through session creation and session:created event"
```

---

### Task 6: Auto-registration middleware

**Files:**
- Create: `src/plugins/identity/middleware/auto-register.ts`
- Create: `src/plugins/identity/__tests__/auto-register.test.ts`

- [ ] **Step 1: Write tests for auto-registration**

Test cases:
- First message from unknown identity → creates user + identity + injects meta.identity
- Subsequent message from known identity → updates lastSeenAt, injects meta.identity
- First user ever → role auto-promoted to 'admin'
- Platform displayName/username synced on change
- Missing channelUser metadata → falls back to userId as displayName

- [ ] **Step 2: Implement auto-register middleware**

```typescript
// src/plugins/identity/middleware/auto-register.ts
import type { IdentityServiceImpl } from '../identity-service.js'
import type { IdentityStore } from '../store/identity-store.js'
import { formatIdentityId } from '../types.js'
import type { IdentityId, UserRecord } from '../types.js'
import type { TurnMeta } from '../../../core/types.js'

interface ChannelUser {
  channelId: string
  userId: string
  displayName?: string
  username?: string
}

/**
 * Creates the message:incoming middleware handler for auto-registration.
 *
 * Runs at priority 110 (after security at 100) to ensure blocked users
 * are rejected before identity records are created.
 */
export function createAutoRegisterHandler(service: IdentityServiceImpl, store: IdentityStore) {
  // Throttle lastSeenAt updates — max once per 5 minutes per user
  const lastSeenThrottle = new Map<string, number>()

  return async (payload: {
    channelId: string
    userId: string
    meta?: TurnMeta
    [key: string]: unknown
  }, next: () => Promise<any>) => {
    const { channelId, userId, meta } = payload
    const identityId = formatIdentityId(channelId, userId)
    const channelUser = (meta as any)?.channelUser as ChannelUser | undefined

    let identity = await store.getIdentity(identityId)
    let user: UserRecord | undefined

    if (!identity) {
      // New identity — create user + identity
      const result = await service.createUserWithIdentity({
        displayName: channelUser?.displayName ?? userId,
        username: channelUser?.username,
        source: channelId,
        platformId: userId,
        platformUsername: channelUser?.username,
        platformDisplayName: channelUser?.displayName,
      })
      user = result.user
      identity = result.identity
    } else {
      user = await service.getUser(identity.userId)
      if (!user) {
        // Orphaned identity — should not happen, but handle gracefully
        return next()
      }

      // Throttled lastSeenAt update
      const now = Date.now()
      const lastSeen = lastSeenThrottle.get(user.userId)
      if (!lastSeen || now - lastSeen > 5 * 60 * 1000) {
        lastSeenThrottle.set(user.userId, now)
        await store.putUser({ ...user, lastSeenAt: new Date(now).toISOString() })
      }

      // Sync platform fields if changed
      if (channelUser) {
        const needsUpdate =
          (channelUser.displayName && channelUser.displayName !== identity.platformDisplayName) ||
          (channelUser.username && channelUser.username !== identity.platformUsername)
        if (needsUpdate) {
          await store.putIdentity({
            ...identity,
            platformDisplayName: channelUser.displayName ?? identity.platformDisplayName,
            platformUsername: channelUser.username ?? identity.platformUsername,
            updatedAt: new Date().toISOString(),
          })
        }
      }
    }

    // Inject identity into TurnMeta
    if (meta) {
      ;(meta as any).identity = {
        userId: user.userId,
        identityId: identity.identityId,
        displayName: user.displayName,
        username: user.username,
        role: user.role,
      }
    }

    return next()
  }
}
```

- [ ] **Step 3: Run tests**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm test -- src/plugins/identity/__tests__/auto-register.test.ts`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add src/plugins/identity/middleware/ src/plugins/identity/__tests__/auto-register.test.ts
git commit -m "feat(identity): add auto-registration middleware for message:incoming"
```

---

### Task 7: Identity plugin entry point

**Files:**
- Create: `src/plugins/identity/index.ts`
- Modify: `src/plugins/core-plugins.ts`

- [ ] **Step 1: Create plugin entry point**

```typescript
// src/plugins/identity/index.ts
import type { VibenPlugin, CoreAccess } from '../../core/plugin/types.js'
import { IdentityServiceImpl } from './identity-service.js'
import { KvIdentityStore } from './store/kv-identity-store.js'
import { createAutoRegisterHandler } from './middleware/auto-register.js'
import { Hook } from '../../core/events.js'

function createIdentityPlugin(): VibenPlugin {
  return {
    name: '@viben/identity',
    version: '1.0.0',
    description: 'User identity, cross-platform linking, and role-based access',
    essential: false,
    permissions: [
      'storage:read', 'storage:write',
      'middleware:register',
      'services:register', 'services:use',
      'events:emit', 'events:read',
      'commands:register',
      'kernel:access',
    ],
    optionalPluginDependencies: {
      '@viben/api-server': '>=1.0.0',
    },

    async setup(ctx) {
      const store = new KvIdentityStore(ctx.storage)
      const service = new IdentityServiceImpl(store, (event, data) => {
        ctx.emit(event, data)
      })

      // Register service for other plugins
      ctx.registerService('identity', service)

      // Auto-registration middleware — runs after security (priority 100)
      ctx.registerMiddleware(Hook.MESSAGE_INCOMING, {
        priority: 110,
        handler: createAutoRegisterHandler(service, store),
      })

      // Register /whoami command
      ctx.registerCommand({
        name: 'whoami',
        description: 'Set your display name and username',
        usage: '[name]',
        category: 'plugin',
        async handler(args) {
          const name = args.raw.trim()
          if (!name) {
            return { type: 'text', text: 'Usage: /whoami <name>' }
          }

          const identityId = `${args.channelId}:${args.userId}`
          const user = await service.getUserByIdentity(identityId as any)
          if (!user) {
            return { type: 'error', message: 'User not found — send a message first.' }
          }

          try {
            await service.updateUser(user.userId, { displayName: name, username: name.toLowerCase().replace(/[^a-z0-9_]/g, '') })
            return { type: 'text', text: `Display name set to "${name}"` }
          } catch (err: any) {
            return { type: 'error', message: err.message }
          }
        },
      })

      // Register REST routes if api-server is available
      const apiServer = ctx.getService<any>('api-server')
      if (apiServer) {
        const { registerIdentityRoutes } = await import('./routes/users.js')
        const { registerSetupRoutes } = await import('./routes/setup.js')
        apiServer.registerPlugin('/api/v1/identity', async (app: any) => {
          registerIdentityRoutes(app, service)
          registerSetupRoutes(app, service, ctx)
        })
      }

      ctx.log.info(`Identity service ready (${await service.getUserCount()} users)`)
    },
  }
}

export default createIdentityPlugin()
```

- [ ] **Step 2: Add to core-plugins.ts**

In `src/plugins/core-plugins.ts`, add the import and plugin to the list. Insert identity plugin as a service plugin (before infrastructure plugins):

```typescript
import identityPlugin from './identity/index.js'
```

And in the `corePlugins` array, add after `securityPlugin`:

```typescript
export const corePlugins = [
  securityPlugin,
  identityPlugin,  // Must boot after security (uses security check results)
  fileServicePlugin,
  // ...rest unchanged
]
```

- [ ] **Step 3: Run build**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build`
Expected: SUCCESS

- [ ] **Step 4: Commit**

```bash
git add src/plugins/identity/index.ts src/plugins/core-plugins.ts
git commit -m "feat(identity): add identity plugin entry point and register in core-plugins"
```

---

### Task 8: REST API routes (users + setup)

**Files:**
- Create: `src/plugins/identity/routes/users.ts`
- Create: `src/plugins/identity/routes/setup.ts`

- [ ] **Step 1: Implement user routes**

```typescript
// src/plugins/identity/routes/users.ts
import type { FastifyInstance } from 'fastify'
import type { IdentityServiceImpl } from '../identity-service.js'

/**
 * REST routes for user management.
 * All routes require JWT auth (inherited from api-server plugin registration).
 */
export function registerIdentityRoutes(app: FastifyInstance, service: IdentityServiceImpl) {
  // GET /identity/users — list users
  app.get('/users', async (request) => {
    const { source, role, q } = request.query as any
    if (q) return service.searchUsers(q)
    return service.listUsers({ source, role })
  })

  // GET /identity/users/me — get own profile (must be before :userId route)
  app.get('/users/me', async (request, reply) => {
    const auth = (request as any).auth
    const tokenStore = app.diContainer?.resolve?.('token-store') // or passed via deps
    const userId = tokenStore?.getUserId?.(auth?.tokenId)
    if (!userId) return reply.status(403).send({ error: 'Identity not set up' })
    return service.getUser(userId)
  })

  // PUT /identity/users/me — update own profile
  app.put('/users/me', async (request, reply) => {
    const auth = (request as any).auth
    const tokenStore = app.diContainer?.resolve?.('token-store')
    const userId = tokenStore?.getUserId?.(auth?.tokenId)
    if (!userId) return reply.status(403).send({ error: 'Identity not set up. Call POST /identity/setup first.' })
    const body = request.body as any
    return service.updateUser(userId, {
      displayName: body.displayName,
      username: body.username,
      avatarUrl: body.avatarUrl,
      timezone: body.timezone,
      locale: body.locale,
    })
  })

  // GET /identity/users/:userId — get user by ID
  app.get('/users/:userId', async (request, reply) => {
    const { userId } = request.params as any
    const user = await service.getUser(userId)
    if (!user) return reply.status(404).send({ error: 'User not found' })
    return user
  })

  // PUT /identity/users/:userId/role — set role (admin only)
  app.put('/users/:userId/role', async (request, reply) => {
    const auth = (request as any).auth
    const tokenStore = app.diContainer?.resolve?.('token-store')
    const callerUserId = tokenStore?.getUserId?.(auth?.tokenId)
    if (!callerUserId) return reply.status(403).send({ error: 'Identity not set up' })
    const currentUser = await service.getUser(callerUserId)
    if (!currentUser || currentUser.role !== 'admin') return reply.status(403).send({ error: 'Admin only' })

    const { userId } = request.params as any
    const { role } = request.body as any
    await service.setRole(userId, role)
    return { ok: true }
  })

  // GET /identity/users/:userId/identities — list identities for user
  app.get('/users/:userId/identities', async (request) => {
    const { userId } = request.params as any
    return service.getIdentitiesFor(userId)
  })

  // GET /identity/resolve/:identityId — resolve identity to user
  app.get('/resolve/:identityId', async (request, reply) => {
    const { identityId } = request.params as any
    const user = await service.getUserByIdentity(identityId)
    if (!user) return reply.status(404).send({ error: 'Identity not found' })
    const identity = await service.getIdentity(identityId)
    return { user, identity }
  })

  // POST /identity/link — link two identities
  app.post('/link', async (request) => {
    const { identityIdA, identityIdB } = request.body as any
    await service.link(identityIdA, identityIdB)
    return { ok: true }
  })

  // POST /identity/unlink — unlink identity
  app.post('/unlink', async (request) => {
    const { identityId } = request.body as any
    await service.unlink(identityId)
    return { ok: true }
  })

  // GET /identity/search — search users
  app.get('/search', async (request) => {
    const { q } = request.query as any
    if (!q) return []
    return service.searchUsers(q)
  })
}
```

- [ ] **Step 2: Implement setup routes**

```typescript
// src/plugins/identity/routes/setup.ts
import { randomBytes } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import type { IdentityServiceImpl } from '../identity-service.js'
import type { PluginContext } from '../../../core/plugin/types.js'
import { formatIdentityId } from '../types.js'

// In-memory link codes (short-lived, no need to persist)
const linkCodes = new Map<string, { userId: string; expiresAt: number }>()

/**
 * Setup routes for API/App user identity initialization.
 * POST /identity/setup — first-time identity setup or link to existing user
 * POST /identity/link-code — generate one-time link code for multi-device
 */
export function registerSetupRoutes(
  app: FastifyInstance,
  service: IdentityServiceImpl,
  ctx: PluginContext,
) {
  // POST /identity/setup — create or link identity for API token
  app.post('/setup', async (request) => {
    const auth = (request as any).auth
    if (!auth?.tokenId) return app.httpErrors.unauthorized('JWT required')

    // Check if this token already has a user
    const tokenStore = ctx.getService<any>('token-store')
    const existingUserId = tokenStore?.getUserId?.(auth.tokenId)
    if (existingUserId) {
      const user = await service.getUser(existingUserId)
      if (user) return user // Already set up
    }

    const body = request.body as any

    if (body.linkCode) {
      // Link to existing user via link code
      const entry = linkCodes.get(body.linkCode)
      if (!entry || entry.expiresAt < Date.now()) {
        return app.httpErrors.unauthorized('Invalid or expired link code')
      }
      linkCodes.delete(body.linkCode)

      // Create identity for this token, attach to existing user
      const identityId = formatIdentityId('api', auth.tokenId)
      await service.createIdentity(entry.userId, {
        source: 'api', platformId: auth.tokenId,
      })

      // Store userId on token
      if (tokenStore?.setUserId) tokenStore.setUserId(auth.tokenId, entry.userId)

      return service.getUser(entry.userId)
    }

    // New user setup
    if (!body.displayName) return app.httpErrors.badRequest('displayName is required')

    const { user } = await service.createUserWithIdentity({
      displayName: body.displayName,
      username: body.username,
      source: 'api',
      platformId: auth.tokenId,
    })

    // Store userId on token
    if (tokenStore?.setUserId) tokenStore.setUserId(auth.tokenId, user.userId)

    return user
  })

  // POST /identity/link-code — generate link code for multi-device
  app.post('/link-code', async (request) => {
    const auth = (request as any).auth
    if (!auth?.tokenId) return app.httpErrors.unauthorized('JWT required')

    const tokenStore = ctx.getService<any>('token-store')
    const userId = tokenStore?.getUserId?.(auth.tokenId)
    if (!userId) return app.httpErrors.forbidden('Identity not set up')

    const code = randomBytes(16).toString('hex')
    const expiresAt = Date.now() + 5 * 60 * 1000 // 5 minutes
    linkCodes.set(code, { userId, expiresAt })

    // Clean expired codes
    for (const [k, v] of linkCodes) {
      if (v.expiresAt < Date.now()) linkCodes.delete(k)
    }

    return { linkCode: code, expiresAt: new Date(expiresAt).toISOString() }
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add src/plugins/identity/routes/
git commit -m "feat(identity): add REST API routes for users, setup, and link-code"
```

---

### Task 9: TokenStore userId field and /auth/me update

**Files:**
- Modify: `src/plugins/api-server/auth/types.ts`
- Modify: `src/plugins/api-server/auth/token-store.ts`
- Modify: `src/plugins/api-server/routes/auth.ts`

- [ ] **Step 1: Add userId to StoredToken**

In `src/plugins/api-server/auth/types.ts`, add to `StoredToken`:

```typescript
  /** User ID from identity system. Null until user completes /identity/setup. */
  userId?: string;
```

- [ ] **Step 2: Add setUserId/getUserId to TokenStore**

In `src/plugins/api-server/auth/token-store.ts`, add methods:

```typescript
  /** Associate a user ID with a token. Called by identity plugin after /identity/setup. */
  setUserId(tokenId: string, userId: string): void {
    const token = this.tokens.find((t) => t.id === tokenId);
    if (token) {
      token.userId = userId;
      this.scheduleSave();
    }
  }

  /** Get the user ID associated with a token, if any. */
  getUserId(tokenId: string): string | undefined {
    return this.tokens.find((t) => t.id === tokenId)?.userId;
  }
```

Also register token-store as a service so identity plugin can access it. In `src/plugins/api-server/index.ts`, after creating the tokenStore, add:
```typescript
// Register token-store as a service for identity plugin access
ctx.registerService('token-store', tokenStore)
```

- [ ] **Step 3: Update /auth/me response**

In `src/plugins/api-server/routes/auth.ts`, update the `/me` handler:

```typescript
  app.get('/me', async (request) => {
    const { auth } = request;
    const tokenStore = deps.tokenStore;  // tokenStore is part of auth route deps
    const userId = auth.tokenId ? tokenStore.getUserId(auth.tokenId) : undefined;

    // Resolve displayName from identity service if userId is set
    let displayName: string | null = null;
    if (userId) {
      const identityService = deps.serviceRegistry?.get?.('identity') as any;
      const user = identityService ? await identityService.getUser(userId) : undefined;
      displayName = user?.displayName ?? null;
    }

    return {
      type: auth.type,
      tokenId: auth.tokenId,
      role: auth.role,
      scopes: auth.scopes,
      userId: userId ?? null,
      displayName,
      claimed: !!userId,
    };
  });
```

- [ ] **Step 4: Run build + tests**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build && pnpm test`
Expected: Pass

- [ ] **Step 5: Commit**

```bash
git add src/plugins/api-server/auth/types.ts src/plugins/api-server/auth/token-store.ts src/plugins/api-server/routes/auth.ts src/plugins/api-server/index.ts
git commit -m "feat(api-server): add userId to token store and update /auth/me response"
```

---

## Phase 2: Core Push Notification System

### Task 10: Add sendUserNotification to IChannelAdapter

**Files:**
- Modify: `src/core/channel.ts`

- [ ] **Step 1: Add optional method to IChannelAdapter**

In `src/core/channel.ts`, add to the `IChannelAdapter` interface after the existing optional methods:

```typescript
  // --- User-targeted notifications (optional) ---
  /** Send a notification directly to a user by platform ID. Best-effort delivery. */
  sendUserNotification?(
    platformId: string,
    message: NotificationMessage,
    options?: {
      via?: 'dm' | 'thread' | 'topic'
      topicId?: string
      sessionId?: string
      platformMention?: { platformUsername?: string; platformId: string }
    }
  ): Promise<void>
```

Add a no-op default in the `ChannelAdapter` base class:

```typescript
  async sendUserNotification(_platformId: string, _message: NotificationMessage, _options?: any): Promise<void> {}
```

- [ ] **Step 2: Run build**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build`
Expected: SUCCESS

- [ ] **Step 3: Commit**

```bash
git add src/core/channel.ts
git commit -m "feat(core): add optional sendUserNotification to IChannelAdapter"
```

---

### Task 11: NotificationService (replacing NotificationManager)

**Files:**
- Modify: `src/plugins/notifications/notification.ts`
- Modify: `src/plugins/notifications/index.ts`

- [ ] **Step 1: Extend NotificationManager to NotificationService**

Replace content of `src/plugins/notifications/notification.ts`:

```typescript
import type { IChannelAdapter } from '../../core/channel.js'
import type { NotificationMessage } from '../../core/types.js'

/** Target for user-directed notifications. */
export type NotificationTarget =
  | { identityId: string }
  | { userId: string }
  | { channelId: string; platformId: string }

export interface NotificationOptions {
  via?: 'dm' | 'thread' | 'topic'
  topicId?: string
  sessionId?: string
  onlyPlatforms?: string[]
  excludePlatforms?: string[]
}

interface IdentityServiceLike {
  getIdentity(identityId: string): Promise<{ userId: string; source: string; platformId: string; platformUsername?: string } | undefined>
  getUser(userId: string): Promise<{ userId: string; identities: string[] } | undefined>
  getIdentitiesFor(userId: string): Promise<Array<{ identityId: string; source: string; platformId: string; platformUsername?: string }>>
}

/**
 * Routes notifications to channel adapters. Supports both legacy adapter-targeted
 * broadcast and new user-targeted delivery via the identity system.
 */
export class NotificationService {
  private identityService?: IdentityServiceLike

  constructor(private adapters: Map<string, IChannelAdapter>) {}

  /** Inject identity service for user-targeted resolution. Called by plugin setup. */
  setIdentityService(service: IdentityServiceLike): void {
    this.identityService = service
  }

  // --- Legacy API (backward compat) ---

  async notify(channelId: string, notification: NotificationMessage): Promise<void> {
    const adapter = this.adapters.get(channelId)
    if (!adapter) return
    try {
      await adapter.sendNotification(notification)
    } catch {
      // Best effort
    }
  }

  async notifyAll(notification: NotificationMessage): Promise<void> {
    for (const adapter of this.adapters.values()) {
      try {
        await adapter.sendNotification(notification)
      } catch {
        // Continue
      }
    }
  }

  // --- New user-targeted API ---

  async notifyUser(
    target: NotificationTarget,
    message: { type: 'text'; text: string },
    options?: NotificationOptions,
  ): Promise<void> {
    try {
      await this._resolveAndDeliver(target, message, options)
    } catch {
      // Fire-and-forget — never throw
    }
  }

  private async _resolveAndDeliver(
    target: NotificationTarget,
    message: { type: 'text'; text: string },
    options?: NotificationOptions,
  ): Promise<void> {
    // Direct adapter call (bypass identity resolution)
    if ('channelId' in target && 'platformId' in target) {
      const adapter = this.adapters.get(target.channelId)
      if (!adapter?.sendUserNotification) return
      await adapter.sendUserNotification(target.platformId, message as any, {
        via: options?.via,
        topicId: options?.topicId,
        sessionId: options?.sessionId,
      })
      return
    }

    // Identity-based resolution
    if (!this.identityService) return

    let identities: Array<{ identityId: string; source: string; platformId: string; platformUsername?: string }> = []

    if ('identityId' in target) {
      const identity = await this.identityService.getIdentity(target.identityId)
      if (!identity) return
      const user = await this.identityService.getUser(identity.userId)
      if (!user) return
      identities = await this.identityService.getIdentitiesFor(user.userId)
    } else if ('userId' in target) {
      identities = await this.identityService.getIdentitiesFor(target.userId)
    }

    // Apply platform filters
    if (options?.onlyPlatforms) {
      identities = identities.filter(i => options.onlyPlatforms!.includes(i.source))
    }
    if (options?.excludePlatforms) {
      identities = identities.filter(i => !options.excludePlatforms!.includes(i.source))
    }

    // Deliver to each identity's adapter
    for (const identity of identities) {
      const adapter = this.adapters.get(identity.source)
      if (!adapter?.sendUserNotification) continue
      try {
        await adapter.sendUserNotification(identity.platformId, message as any, {
          via: options?.via,
          topicId: options?.topicId,
          sessionId: options?.sessionId,
          platformMention: {
            platformUsername: identity.platformUsername,
            platformId: identity.platformId,
          },
        })
      } catch {
        // Continue to next — best effort
      }
    }
  }
}
```

- [ ] **Step 2: Update notifications plugin index to wire identity service**

In `src/plugins/notifications/index.ts`, update setup to optionally wire identity service:

Replace the setup function:

```typescript
    async setup(ctx) {
      const core = ctx.core as CoreAccess
      const service = new NotificationService(core.adapters)

      // Wire identity service if available (might not be loaded yet)
      const identity = ctx.getService<any>('identity')
      if (identity) service.setIdentityService(identity)

      // Listen for identity plugin load (in case it boots after us)
      ctx.on('plugin:loaded', (data: any) => {
        if (data.name === '@viben/identity') {
          const id = ctx.getService<any>('identity')
          if (id) service.setIdentityService(id)
        }
      })

      ctx.registerService('notifications', service)
      ctx.log.info('Notifications service ready')
    },
```

Update the import to use `NotificationService` instead of `NotificationManager`:

```typescript
import { NotificationService } from './notification.js'
```

- [ ] **Step 3: Update references to NotificationManager**

Search for any imports of `NotificationManager` in the codebase and update them to `NotificationService`. Key files:
- `src/core/sessions/session-factory.ts` — type import in `SideEffectDeps`
- `src/core/sessions/session-bridge.ts` — type usage

Both should import from the same path, just rename the type.

- [ ] **Step 4: Run build + tests**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build && pnpm test`
Expected: Pass (NotificationService is backward compatible)

- [ ] **Step 5: Commit**

```bash
git add src/plugins/notifications/ src/core/sessions/session-factory.ts src/core/sessions/session-bridge.ts
git commit -m "feat(notifications): extend NotificationManager to NotificationService with user-targeted delivery"
```

---

### Task 12: Add ctx.notify() to PluginContext

**Files:**
- Modify: `src/core/plugin/types.ts`
- Modify: `src/core/plugin/plugin-context.ts`

- [ ] **Step 1: Add notify() to PluginContext interface**

In `src/core/plugin/types.ts`, add after `sendMessage()` in the PluginContext interface:

```typescript
  /**
   * Send a user-targeted notification. Fire-and-forget, best-effort.
   * Requires 'notifications:send' permission.
   *
   * Target types:
   * - { identityId } — resolve via identity system → all linked platforms
   * - { userId } — resolve via identity system → all linked platforms
   * - { channelId, platformId } — direct adapter call, bypass identity
   */
  notify(
    target: { identityId: string } | { userId: string } | { channelId: string; platformId: string },
    message: { type: 'text'; text: string },
    options?: {
      via?: 'dm' | 'thread' | 'topic'
      topicId?: string
      sessionId?: string
      onlyPlatforms?: string[]
      excludePlatforms?: string[]
    }
  ): void
```

- [ ] **Step 2: Implement in plugin-context.ts**

In `src/core/plugin/plugin-context.ts`, add after the `sendMessage()` implementation:

```typescript
    notify(
      target: { identityId: string } | { userId: string } | { channelId: string; platformId: string },
      message: { type: 'text'; text: string },
      options?: any,
    ): void {
      requirePermission(permissions, 'notifications:send', 'notify()')
      const svc = serviceRegistry.get<{ notifyUser(t: any, m: any, o: any): Promise<void> }>('notifications')
      if (svc?.notifyUser) {
        // Fire-and-forget — don't await, don't throw
        svc.notifyUser(target, message, options).catch(() => {})
      }
    },
```

- [ ] **Step 3: Run build**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build`
Expected: SUCCESS

- [ ] **Step 4: Commit**

```bash
git add src/core/plugin/types.ts src/core/plugin/plugin-context.ts
git commit -m "feat(core): add ctx.notify() to PluginContext for user-targeted notifications"
```

---

### Task 13: SSE ConnectionManager user-level connections

**Files:**
- Modify: `src/plugins/sse-adapter/connection-manager.ts`

- [ ] **Step 1: Add user-level connection tracking**

In `src/plugins/sse-adapter/connection-manager.ts`, add:

1. A new `userIndex` map alongside `sessionIndex`:
```typescript
  // Secondary index: userId → Set of connection IDs for user-level broadcast
  private userIndex = new Map<string, Set<string>>();
```

2. Modify `SSEConnection` to include optional `userId`:
```typescript
export interface SSEConnection {
  id: string;
  sessionId: string;  // empty string for user-level connections
  tokenId: string;
  userId?: string;     // set for user-level connections
  response: ServerResponse;
  connectedAt: Date;
  lastEventId?: string;
  backpressured?: boolean;
}
```

3. Add `addUserConnection()` method:
```typescript
  /**
   * Registers a user-level SSE connection (not tied to a session).
   * Used for notifications and system events delivered to a specific user.
   */
  addUserConnection(userId: string, tokenId: string, response: ServerResponse): SSEConnection {
    if (this.connections.size >= this.maxTotalConnections) {
      throw new Error('Maximum total connections reached');
    }

    const id = `conn_${randomBytes(8).toString('hex')}`;
    const connection: SSEConnection = { id, sessionId: '', tokenId, userId, response, connectedAt: new Date() };

    this.connections.set(id, connection);

    let userConns = this.userIndex.get(userId);
    if (!userConns) {
      userConns = new Set();
      this.userIndex.set(userId, userConns);
    }
    userConns.add(id);

    response.on('close', () => this.removeConnection(id));
    return connection;
  }
```

4. Add `pushToUser()` method:
```typescript
  /** Writes a serialized SSE event to all connections for the given user. */
  pushToUser(userId: string, serializedEvent: string): void {
    const connIds = this.userIndex.get(userId);
    if (!connIds) return;
    for (const connId of connIds) {
      const conn = this.connections.get(connId);
      if (!conn || conn.response.writableEnded) continue;
      try {
        const ok = conn.response.write(serializedEvent);
        if (!ok) {
          if (conn.backpressured) {
            conn.response.end();
            this.removeConnection(conn.id);
          } else {
            conn.backpressured = true;
            conn.response.once('drain', () => { conn.backpressured = false; });
          }
        }
      } catch {
        this.removeConnection(conn.id);
      }
    }
  }
```

5. Update `removeConnection()` to clean userIndex:
```typescript
  removeConnection(connectionId: string): void {
    const conn = this.connections.get(connectionId);
    if (!conn) return;
    this.connections.delete(connectionId);
    // Clean session index
    const sessionConns = this.sessionIndex.get(conn.sessionId);
    if (sessionConns) {
      sessionConns.delete(connectionId);
      if (sessionConns.size === 0) this.sessionIndex.delete(conn.sessionId);
    }
    // Clean user index
    if (conn.userId) {
      const userConns = this.userIndex.get(conn.userId);
      if (userConns) {
        userConns.delete(connectionId);
        if (userConns.size === 0) this.userIndex.delete(conn.userId);
      }
    }
  }
```

6. Update `cleanup()` to clear `userIndex`:
```typescript
    this.userIndex.clear();
```

- [ ] **Step 2: Run build + tests**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build && pnpm test`
Expected: Pass

- [ ] **Step 3: Commit**

```bash
git add src/plugins/sse-adapter/connection-manager.ts
git commit -m "feat(sse): add user-level connection tracking to ConnectionManager"
```

---

### Task 14: SSE user-level endpoint and SSE Adapter sendUserNotification

**Files:**
- Modify: `src/plugins/sse-adapter/adapter.ts` (or `index.ts` depending on where routes are)

- [ ] **Step 1: Add user-level SSE endpoint**

Add to `src/plugins/sse-adapter/routes.ts` (where all SSE adapter endpoints are registered) and update `src/plugins/sse-adapter/index.ts` to pass `ctx` for token-store access:

```typescript
// GET /api/v1/sse/events — user-level SSE stream
app.get('/events', async (request, reply) => {
  const auth = (request as any).auth
  if (!auth?.tokenId) return reply.code(401).send({ error: 'Unauthorized' })

  const tokenStore = ctx.getService<any>('token-store')
  const userId = tokenStore?.getUserId?.(auth.tokenId)
  if (!userId) return reply.code(401).send({ error: 'Identity not set up' })

  const raw = reply.raw
  raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  })

  try {
    connectionManager.addUserConnection(userId, auth.tokenId, raw)
  } catch (err: any) {
    return reply.code(503).send({ error: err.message })
  }

  // Initial heartbeat
  raw.write(`event: heartbeat\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`)
})
```

- [ ] **Step 2: Implement sendUserNotification on SSE adapter**

In the SSE adapter class, add:

```typescript
  async sendUserNotification(platformId: string, message: NotificationMessage, options?: any): Promise<void> {
    // platformId = userId for SSE adapter
    const serialized = `event: notification:text\ndata: ${JSON.stringify({
      text: message.text ?? (message as any).summary,
      ...options,
    })}\n\n`
    this.connectionManager.pushToUser(platformId, serialized)
  }
```

- [ ] **Step 3: Run build**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build`
Expected: SUCCESS

- [ ] **Step 4: Commit**

```bash
git add src/plugins/sse-adapter/
git commit -m "feat(sse): add user-level SSE endpoint and sendUserNotification"
```

---

### Task 15: Final integration test and plugin-sdk exports

**Files:**
- Modify: `src/packages/plugin-sdk/` (if identity types need to be exported)

- [ ] **Step 1: Run full test suite**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm test`
Expected: ALL PASS

- [ ] **Step 2: Run build**

Run: `cd /Users/lucas/viben-workspace/Viben && pnpm build`
Expected: SUCCESS

- [ ] **Step 3: Verify no type errors in strict mode**

Run: `cd /Users/lucas/viben-workspace/Viben && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(identity+notifications): complete identity system and push notification service"
```

---

## Implementation Notes

### Backward Compatibility
- `StoredToken.userId` is optional — existing tokens.json files work without migration
- `SessionRecord.createdBy` and `participants` are optional — old session records unaffected
- `NotificationService` extends `NotificationManager` API — all existing callers continue to work
- `sendUserNotification()` is optional on `IChannelAdapter` — adapters that don't implement it are skipped
- `ctx.notify()` is a new method — no existing code affected

### Testing Strategy
- Unit tests for KvIdentityStore (data layer)
- Unit tests for IdentityServiceImpl (business logic)
- Unit tests for auto-registration middleware
- Integration verified by existing test suite (no breaking changes)

### Migration
- No data migration needed — all new fields are optional
- First user to message after upgrade becomes admin (if no users exist)
- Existing security plugin allowlist continues to work as fallback
