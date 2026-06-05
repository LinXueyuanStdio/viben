import type { UserRecord, IdentityRecord, IdentityId, UserRole } from '../types.js'

/**
 * Persistence contract for the identity system.
 *
 * Implementations must be consistent: after a put/delete, subsequent reads
 * must reflect the change. All index operations (setUsernameIndex, etc.) must
 * be called explicitly by the service layer — the store does not auto-index.
 */
export interface IdentityStore {
  // === User CRUD ===
  getUser(userId: string): Promise<UserRecord | undefined>
  putUser(record: UserRecord): Promise<void>
  deleteUser(userId: string): Promise<void>
  listUsers(filter?: { source?: string; role?: UserRole }): Promise<UserRecord[]>

  // === Identity CRUD ===
  getIdentity(identityId: IdentityId): Promise<IdentityRecord | undefined>
  putIdentity(record: IdentityRecord): Promise<void>
  deleteIdentity(identityId: IdentityId): Promise<void>
  /** Returns all identity records linked to a user. */
  getIdentitiesForUser(userId: string): Promise<IdentityRecord[]>

  // === Secondary indexes ===
  /** Resolves a username (case-insensitive) to its userId. */
  getUserIdByUsername(username: string): Promise<string | undefined>
  /** Resolves a source+platformId pair to an identityId. */
  getIdentityIdBySource(source: string, platformId: string): Promise<IdentityId | undefined>

  // === Index mutations (managed by service layer) ===
  setUsernameIndex(username: string, userId: string): Promise<void>
  deleteUsernameIndex(username: string): Promise<void>
  setSourceIndex(source: string, platformId: string, identityId: IdentityId): Promise<void>
  deleteSourceIndex(source: string, platformId: string): Promise<void>

  getUserCount(): Promise<number>
}
