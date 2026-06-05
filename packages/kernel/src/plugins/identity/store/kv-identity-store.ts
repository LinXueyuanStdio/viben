import type { PluginStorage } from '../../../core/plugin/types.js'
import type { IdentityStore } from './identity-store.js'
import type { UserRecord, IdentityRecord, IdentityId, UserRole } from '../types.js'

/**
 * PluginStorage-backed implementation of IdentityStore.
 *
 * Key layout in kv.json:
 *   users/{userId}               → UserRecord
 *   identities/{identityId}      → IdentityRecord
 *   idx/usernames/{username}     → userId  (lowercase for case-insensitive lookup)
 *   idx/sources/{source}/{pid}   → identityId
 *
 * The flat kv.json layout avoids nested directories and makes the data portable.
 * All identity records are also referenced via the owning user's `identities` array,
 * enabling O(n) user-scoped lookups without a separate index.
 */
export class KvIdentityStore implements IdentityStore {
  constructor(private readonly storage: PluginStorage) {}

  // === User CRUD ===

  async getUser(userId: string): Promise<UserRecord | undefined> {
    return this.storage.get<UserRecord>(`users/${userId}`)
  }

  async putUser(record: UserRecord): Promise<void> {
    await this.storage.set(`users/${record.userId}`, record)
  }

  async deleteUser(userId: string): Promise<void> {
    await this.storage.delete(`users/${userId}`)
  }

  /**
   * Lists all users, optionally filtered by role or source.
   * Filtering by source requires scanning all identity records for the user,
   * which is acceptable given the expected user count (hundreds, not millions).
   */
  async listUsers(filter?: { source?: string; role?: UserRole }): Promise<UserRecord[]> {
    const keys = await this.storage.keys('users/')
    const users: UserRecord[] = []

    for (const key of keys) {
      const user = await this.storage.get<UserRecord>(key)
      if (!user) continue
      if (filter?.role && user.role !== filter.role) continue

      if (filter?.source) {
        // Check if user has at least one identity from the requested source
        const hasSource = user.identities.some((id) => id.startsWith(`${filter.source}:`))
        if (!hasSource) continue
      }

      users.push(user)
    }

    return users
  }

  // === Identity CRUD ===

  async getIdentity(identityId: IdentityId): Promise<IdentityRecord | undefined> {
    return this.storage.get<IdentityRecord>(`identities/${identityId}`)
  }

  async putIdentity(record: IdentityRecord): Promise<void> {
    await this.storage.set(`identities/${record.identityId}`, record)
  }

  async deleteIdentity(identityId: IdentityId): Promise<void> {
    await this.storage.delete(`identities/${identityId}`)
  }

  /**
   * Fetches all identity records for a user by scanning their identities array.
   * Avoids a full table scan by leveraging the user record as a secondary index.
   */
  async getIdentitiesForUser(userId: string): Promise<IdentityRecord[]> {
    const user = await this.getUser(userId)
    if (!user) return []

    const records: IdentityRecord[] = []
    for (const identityId of user.identities) {
      const record = await this.getIdentity(identityId)
      if (record) records.push(record)
    }
    return records
  }

  // === Secondary indexes ===

  async getUserIdByUsername(username: string): Promise<string | undefined> {
    // Lowercase to enforce case-insensitive uniqueness
    return this.storage.get<string>(`idx/usernames/${username.toLowerCase()}`)
  }

  async getIdentityIdBySource(source: string, platformId: string): Promise<IdentityId | undefined> {
    return this.storage.get<IdentityId>(`idx/sources/${source}/${platformId}`)
  }

  // === Index mutations ===

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

  async getUserCount(): Promise<number> {
    const keys = await this.storage.keys('users/')
    return keys.length
  }
}
