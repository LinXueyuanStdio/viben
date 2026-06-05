import { nanoid } from 'nanoid'
import { formatIdentityId } from './types.js'
import type { IdentityStore } from './store/identity-store.js'
import type {
  IdentityService,
  IdentityRecord,
  UserRecord,
  IdentityId,
  UserRole,
  SessionInfo,
} from './types.js'

/**
 * Core implementation of the identity service.
 *
 * Coordinates reads/writes through an IdentityStore and emits events via a
 * provided callback (EventBus integration). The emitter decoupling allows the
 * service to be tested without a full EventBus, and lets it be registered in
 * the plugin's setup() before the EventBus is fully wired.
 *
 * SessionManager integration is optional — if not provided, getSessionsFor()
 * always returns an empty array (graceful degradation during early boot).
 */
export class IdentityServiceImpl implements IdentityService {
  private readonly registeredSources = new Set<string>()

  /**
   * @param store - Persistence layer for user/identity records and indexes.
   * @param emitEvent - Callback to publish events on the EventBus.
   * @param getSessionsForUser - Optional function to look up sessions for a userId.
   */
  constructor(
    private readonly store: IdentityStore,
    private readonly emitEvent: (event: string, payload: unknown) => void,
    private readonly getSessionsForUser?: (userId: string) => Promise<SessionInfo[]>,
  ) {}

  // ─── Lookups ───

  async getUser(userId: string): Promise<UserRecord | undefined> {
    return this.store.getUser(userId)
  }

  async getUserByUsername(username: string): Promise<UserRecord | undefined> {
    const userId = await this.store.getUserIdByUsername(username)
    if (!userId) return undefined
    return this.store.getUser(userId)
  }

  async getIdentity(identityId: IdentityId): Promise<IdentityRecord | undefined> {
    return this.store.getIdentity(identityId)
  }

  async getUserByIdentity(identityId: IdentityId): Promise<UserRecord | undefined> {
    const identity = await this.store.getIdentity(identityId)
    if (!identity) return undefined
    return this.store.getUser(identity.userId)
  }

  async getIdentitiesFor(userId: string): Promise<IdentityRecord[]> {
    return this.store.getIdentitiesForUser(userId)
  }

  async listUsers(filter?: { source?: string; role?: UserRole }): Promise<UserRecord[]> {
    return this.store.listUsers(filter)
  }

  /**
   * Case-insensitive substring search across displayName, username, and platform
   * usernames. Designed for admin tooling, not high-frequency user-facing paths.
   */
  async searchUsers(query: string): Promise<UserRecord[]> {
    const all = await this.store.listUsers()
    const q = query.toLowerCase()

    const matched: UserRecord[] = []
    for (const user of all) {
      const nameMatch =
        user.displayName.toLowerCase().includes(q) ||
        (user.username && user.username.toLowerCase().includes(q))

      if (nameMatch) {
        matched.push(user)
        continue
      }

      // Also search platform usernames via identity records
      const identities = await this.store.getIdentitiesForUser(user.userId)
      const platformMatch = identities.some(
        (id) => id.platformUsername && id.platformUsername.toLowerCase().includes(q),
      )
      if (platformMatch) matched.push(user)
    }

    return matched
  }

  async getSessionsFor(userId: string): Promise<SessionInfo[]> {
    if (!this.getSessionsForUser) return []
    return this.getSessionsForUser(userId)
  }

  // ─── Mutations ───

  /**
   * Creates a user + identity pair atomically.
   * The first ever user in the system is auto-promoted to admin — this ensures
   * there is always at least one admin when bootstrapping a fresh instance.
   */
  async createUserWithIdentity(data: {
    displayName: string
    username?: string
    role?: UserRole
    source: string
    platformId: string
    platformUsername?: string
    platformDisplayName?: string
  }): Promise<{ user: UserRecord; identity: IdentityRecord }> {
    const now = new Date().toISOString()
    const userId = `u_${nanoid(12)}`
    const identityId = formatIdentityId(data.source, data.platformId)

    // First user ever gets admin to avoid a locked-out instance
    const count = await this.store.getUserCount()
    const role: UserRole = count === 0 ? 'admin' : (data.role ?? 'member')

    const user: UserRecord = {
      userId,
      displayName: data.displayName,
      username: data.username,
      role,
      identities: [identityId],
      pluginData: {},
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now,
    }

    const identity: IdentityRecord = {
      identityId,
      userId,
      source: data.source,
      platformId: data.platformId,
      platformUsername: data.platformUsername,
      platformDisplayName: data.platformDisplayName,
      createdAt: now,
      updatedAt: now,
    }

    await this.store.putUser(user)
    await this.store.putIdentity(identity)
    await this.store.setSourceIndex(data.source, data.platformId, identityId)
    if (data.username) {
      await this.store.setUsernameIndex(data.username, userId)
    }

    this.emitEvent('identity:created', { userId, identityId, source: data.source, displayName: data.displayName })
    return { user, identity }
  }

  async updateUser(
    userId: string,
    changes: Partial<Pick<UserRecord, 'displayName' | 'username' | 'avatarUrl' | 'timezone' | 'locale'>>,
  ): Promise<UserRecord> {
    const user = await this.store.getUser(userId)
    if (!user) throw new Error(`User not found: ${userId}`)

    // Username index must stay consistent — remove old, add new
    if (changes.username !== undefined && changes.username !== user.username) {
      if (changes.username) {
        const existingId = await this.store.getUserIdByUsername(changes.username)
        if (existingId && existingId !== userId) {
          throw new Error(`Username already taken: ${changes.username}`)
        }
        await this.store.setUsernameIndex(changes.username, userId)
      }
      if (user.username) {
        await this.store.deleteUsernameIndex(user.username)
      }
    }

    const updated: UserRecord = {
      ...user,
      ...changes,
      updatedAt: new Date().toISOString(),
    }
    await this.store.putUser(updated)
    this.emitEvent('identity:updated', { userId, changes: Object.keys(changes) })
    return updated
  }

  async setRole(userId: string, role: UserRole): Promise<void> {
    const user = await this.store.getUser(userId)
    if (!user) throw new Error(`User not found: ${userId}`)

    const oldRole = user.role
    await this.store.putUser({ ...user, role, updatedAt: new Date().toISOString() })
    this.emitEvent('identity:roleChanged', { userId, oldRole, newRole: role })
  }

  async createIdentity(
    userId: string,
    identity: {
      source: string
      platformId: string
      platformUsername?: string
      platformDisplayName?: string
    },
  ): Promise<IdentityRecord> {
    const user = await this.store.getUser(userId)
    if (!user) throw new Error(`User not found: ${userId}`)

    const now = new Date().toISOString()
    const identityId = formatIdentityId(identity.source, identity.platformId)
    const record: IdentityRecord = {
      identityId,
      userId,
      source: identity.source,
      platformId: identity.platformId,
      platformUsername: identity.platformUsername,
      platformDisplayName: identity.platformDisplayName,
      createdAt: now,
      updatedAt: now,
    }

    await this.store.putIdentity(record)
    await this.store.setSourceIndex(identity.source, identity.platformId, identityId)

    // Add to user's identity list
    const updatedUser: UserRecord = {
      ...user,
      identities: [...user.identities, identityId],
      updatedAt: now,
    }
    await this.store.putUser(updatedUser)

    return record
  }

  /**
   * Links two identities into a single user.
   *
   * When identities belong to different users, the younger (more recently created)
   * user is merged into the older one. We keep the older user as the canonical
   * record because it likely has more history, sessions, and plugin data.
   *
   * Merge strategy for pluginData: per-namespace, the winning user's data takes
   * precedence. The younger user's data only fills in missing namespaces.
   */
  async link(identityIdA: IdentityId, identityIdB: IdentityId): Promise<void> {
    const identityA = await this.store.getIdentity(identityIdA)
    const identityB = await this.store.getIdentity(identityIdB)
    if (!identityA) throw new Error(`Identity not found: ${identityIdA}`)
    if (!identityB) throw new Error(`Identity not found: ${identityIdB}`)

    // Already on the same user — no-op
    if (identityA.userId === identityB.userId) return

    const userA = await this.store.getUser(identityA.userId)
    const userB = await this.store.getUser(identityB.userId)
    if (!userA) throw new Error(`User not found: ${identityA.userId}`)
    if (!userB) throw new Error(`User not found: ${identityB.userId}`)

    // Keep the older user as the survivor
    const [keep, merge] =
      userA.createdAt <= userB.createdAt ? [userA, userB] : [userB, userA]

    const now = new Date().toISOString()

    // Move all of the younger user's identities to the surviving user
    for (const identityId of merge.identities) {
      const identity = await this.store.getIdentity(identityId)
      if (!identity) continue
      const updated: IdentityRecord = { ...identity, userId: keep.userId, updatedAt: now }
      await this.store.putIdentity(updated)
    }

    // Merge pluginData: keep's namespaces win; merge fills in missing ones
    const mergedPluginData: Record<string, Record<string, unknown>> = { ...merge.pluginData }
    for (const [ns, nsData] of Object.entries(keep.pluginData)) {
      mergedPluginData[ns] = nsData
    }

    // Clean up username index for the merged user if it had one
    if (merge.username) {
      await this.store.deleteUsernameIndex(merge.username)
    }

    const updatedKeep: UserRecord = {
      ...keep,
      identities: [...new Set([...keep.identities, ...merge.identities])],
      pluginData: mergedPluginData,
      updatedAt: now,
    }
    await this.store.putUser(updatedKeep)
    await this.store.deleteUser(merge.userId)

    // The "linked" identity is the one that belonged to the merged user — i.e. identityIdB
    // (the caller-supplied second identity). If the merge resolved in the opposite direction,
    // identityIdA is the one moving to the survivor.
    const linkedIdentityId = identityA.userId === merge.userId ? identityIdA : identityIdB
    this.emitEvent('identity:linked', { userId: keep.userId, identityId: linkedIdentityId, linkedFrom: merge.userId })
    this.emitEvent('identity:userMerged', {
      keptUserId: keep.userId,
      mergedUserId: merge.userId,
      movedIdentities: merge.identities,
    })
  }

  /**
   * Separates an identity from its user into a new standalone account.
   * Throws if it's the user's last identity — unlinking would produce a
   * ghost user with no way to authenticate.
   */
  async unlink(identityId: IdentityId): Promise<void> {
    const identity = await this.store.getIdentity(identityId)
    if (!identity) throw new Error(`Identity not found: ${identityId}`)

    const user = await this.store.getUser(identity.userId)
    if (!user) throw new Error(`User not found: ${identity.userId}`)

    if (user.identities.length <= 1) {
      throw new Error(`Cannot unlink the last identity from user ${identity.userId}`)
    }

    const now = new Date().toISOString()
    const newUserId = `u_${nanoid(12)}`

    // Create new user for the separated identity
    const newUser: UserRecord = {
      userId: newUserId,
      displayName: identity.platformDisplayName ?? identity.platformUsername ?? 'User',
      role: 'member',
      identities: [identityId],
      pluginData: {},
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now,
    }
    await this.store.putUser(newUser)

    // Point the identity at the new user
    await this.store.putIdentity({ ...identity, userId: newUserId, updatedAt: now })

    // Remove the identity from the original user
    const updatedUser: UserRecord = {
      ...user,
      identities: user.identities.filter((id) => id !== identityId),
      updatedAt: now,
    }
    await this.store.putUser(updatedUser)

    this.emitEvent('identity:unlinked', {
      userId: user.userId,
      identityId,
      newUserId,
    })
  }

  // ─── Plugin data ───

  async setPluginData(userId: string, pluginName: string, key: string, value: unknown): Promise<void> {
    const user = await this.store.getUser(userId)
    if (!user) throw new Error(`User not found: ${userId}`)

    const pluginData = { ...user.pluginData }
    pluginData[pluginName] = { ...(pluginData[pluginName] ?? {}), [key]: value }

    await this.store.putUser({ ...user, pluginData, updatedAt: new Date().toISOString() })
  }

  async getPluginData(userId: string, pluginName: string, key: string): Promise<unknown> {
    const user = await this.store.getUser(userId)
    if (!user) return undefined
    return user.pluginData[pluginName]?.[key]
  }

  // ─── Source registry ───

  registerSource(source: string): void {
    this.registeredSources.add(source)
  }

  /**
   * Resolves a username mention to platform-specific info for the given source.
   * Finds the user by username, then scans their identities for the matching source.
   * Returns found=false when no user or no identity for that source exists.
   */
  async resolveCanonicalMention(
    username: string,
    source: string,
  ): Promise<{ found: boolean; platformId?: string; platformUsername?: string }> {
    const user = await this.getUserByUsername(username)
    if (!user) return { found: false }

    const identities = await this.store.getIdentitiesForUser(user.userId)
    const sourceIdentity = identities.find((id) => id.source === source)
    if (!sourceIdentity) return { found: false }

    return {
      found: true,
      platformId: sourceIdentity.platformId,
      platformUsername: sourceIdentity.platformUsername,
    }
  }

  async getUserCount(): Promise<number> {
    return this.store.getUserCount()
  }
}
