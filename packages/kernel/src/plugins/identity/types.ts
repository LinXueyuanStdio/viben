/**
 * Branded string type for identity IDs. Format: '{source}:{platformId}'.
 * Collision between identity spaces is structurally impossible — the source
 * prefix guarantees no two platforms share an ID space.
 */
export type IdentityId = string & { readonly __brand: 'IdentityId' }

/**
 * Validates and creates an IdentityId from source and platformId.
 * The colon delimiter allows parsing back to components without ambiguity,
 * because source names must not contain colons.
 */
export function formatIdentityId(source: string, platformId: string): IdentityId {
  return `${source}:${platformId}` as IdentityId
}

/**
 * Splits an IdentityId into its source and platformId components.
 * Uses the first colon as delimiter, so platformId may itself contain colons.
 */
export function parseIdentityId(id: IdentityId): { source: string; platformId: string } {
  const colonIdx = id.indexOf(':')
  if (colonIdx === -1) throw new Error(`Invalid IdentityId: ${id}`)
  return { source: id.slice(0, colonIdx), platformId: id.slice(colonIdx + 1) }
}

/** Access level within the system. Blocked users are denied all operations. */
export type UserRole = 'admin' | 'member' | 'viewer' | 'blocked'

/**
 * Canonical user record. One user may have multiple identities across platforms.
 * pluginData provides namespaced extension storage without schema coupling.
 */
export interface UserRecord {
  userId: string
  displayName: string
  username?: string
  avatarUrl?: string
  role: UserRole
  timezone?: string
  locale?: string
  /** All IdentityIds linked to this user. At least one is always present. */
  identities: IdentityId[]
  /** Per-plugin extension data. Keys are plugin names; values are plugin-defined schemas. */
  pluginData: Record<string, Record<string, unknown>>
  createdAt: string
  updatedAt: string
  lastSeenAt: string
}

/**
 * A single platform identity. Each identity belongs to exactly one user.
 * Multiple identities for the same user are linked at the UserRecord level.
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

/** Lightweight session snapshot used when listing sessions for a user. */
export interface SessionInfo {
  sessionId: string
  agentName: string
  channelId: string
  status: string
  createdAt: string
}

/**
 * Public contract for the identity service.
 *
 * Implementations coordinate a persistent store with event emission.
 * All mutation methods update `updatedAt` on affected records.
 */
export interface IdentityService {
  // === Lookups ===
  getUser(userId: string): Promise<UserRecord | undefined>
  getUserByUsername(username: string): Promise<UserRecord | undefined>
  getIdentity(identityId: IdentityId): Promise<IdentityRecord | undefined>
  /** Fetches the user that owns the given identity. */
  getUserByIdentity(identityId: IdentityId): Promise<UserRecord | undefined>
  getIdentitiesFor(userId: string): Promise<IdentityRecord[]>
  listUsers(filter?: { source?: string; role?: UserRole }): Promise<UserRecord[]>
  searchUsers(query: string): Promise<UserRecord[]>
  /**
   * Returns active session snapshots for a user.
   * Reads from SessionManager — requires kernel:access during setup.
   */
  getSessionsFor(userId: string): Promise<SessionInfo[]>

  // === Mutations ===
  /**
   * Creates a new user and their first identity atomically.
   * The first user ever created in the system is automatically promoted to admin.
   */
  createUserWithIdentity(data: {
    displayName: string
    username?: string
    role?: UserRole
    source: string
    platformId: string
    platformUsername?: string
    platformDisplayName?: string
  }): Promise<{ user: UserRecord; identity: IdentityRecord }>

  updateUser(
    userId: string,
    changes: Partial<Pick<UserRecord, 'displayName' | 'username' | 'avatarUrl' | 'timezone' | 'locale'>>,
  ): Promise<UserRecord>

  setRole(userId: string, role: UserRole): Promise<void>

  createIdentity(
    userId: string,
    identity: {
      source: string
      platformId: string
      platformUsername?: string
      platformDisplayName?: string
    },
  ): Promise<IdentityRecord>

  /**
   * Links two identities into a single user account.
   * If they already share a user, this is a no-op.
   * If they belong to different users, the younger account is merged into the
   * older one and deleted. Emits identity:linked + identity:userMerged.
   */
  link(identityIdA: IdentityId, identityIdB: IdentityId): Promise<void>

  /**
   * Separates an identity into a new standalone user account.
   * Throws if the identity is the last one on its user (would leave a ghost user).
   * Emits identity:unlinked.
   */
  unlink(identityId: IdentityId): Promise<void>

  // === Plugin data ===
  /**
   * Stores arbitrary plugin-specific data under a namespaced key.
   * Prevents plugins from accidentally overwriting each other's data.
   */
  setPluginData(userId: string, pluginName: string, key: string, value: unknown): Promise<void>
  getPluginData(userId: string, pluginName: string, key: string): Promise<unknown>

  // === Source registry ===
  /**
   * Registers a source name (e.g., 'telegram', 'discord') so it can be used
   * for filtering and mention resolution. Adapters call this during setup().
   */
  registerSource(source: string): void

  /**
   * Resolves a @username mention in the context of a given source platform.
   * Returns the platform-specific ID and username for the matched user, enabling
   * adapters to construct native mentions (e.g., Telegram @username, Discord <@id>).
   */
  resolveCanonicalMention(
    username: string,
    source: string,
  ): Promise<{ found: boolean; platformId?: string; platformUsername?: string }>

  getUserCount(): Promise<number>
}
