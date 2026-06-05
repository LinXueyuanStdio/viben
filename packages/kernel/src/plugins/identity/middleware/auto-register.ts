import type { IdentityServiceImpl } from '../identity-service.js'
import type { IdentityStore } from '../store/identity-store.js'
import { formatIdentityId } from '../types.js'
import type { UserRecord } from '../types.js'
import type { MiddlewarePayloadMap } from '../../../core/plugin/types.js'

interface ChannelUser {
  channelId: string
  userId: string
  displayName?: string
  username?: string
}

// 5 minutes in milliseconds — max frequency for persisting lastSeenAt updates
const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000

type IncomingPayload = MiddlewarePayloadMap['message:incoming']

/**
 * Creates the message:incoming middleware for identity auto-registration.
 *
 * Runs at priority 110 — after security (100) so blocked users are rejected
 * before we bother creating identity records for them.
 *
 * On each incoming message:
 *  1. Look up the identity by {channelId}:{userId}
 *  2. If missing, create a new user + identity via the service
 *  3. If found, throttle lastSeenAt updates and sync platform fields if changed
 *  4. Inject meta.identity for downstream hooks (agent:beforePrompt, etc.)
 */
export function createAutoRegisterHandler(service: IdentityServiceImpl, store: IdentityStore) {
  // In-memory throttle map — resets on process restart, which is acceptable
  // since lastSeenAt is a best-effort field (no hard SLA on freshness)
  const lastSeenThrottle = new Map<string, number>()

  return async (
    payload: IncomingPayload,
    next: () => Promise<IncomingPayload>,
  ): Promise<IncomingPayload | null> => {
    const { channelId, userId, meta } = payload
    const identityId = formatIdentityId(channelId, userId)
    const channelUser = (meta?.channelUser as ChannelUser | undefined)

    let identity = await store.getIdentity(identityId)
    let user: UserRecord | undefined

    if (!identity) {
      // First time we've seen this user on this channel — create their account
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

      // Guard against an identity pointing at a deleted user (data inconsistency)
      if (!user) return next()

      // Throttled lastSeenAt update — writing on every message would cause excessive I/O
      const now = Date.now()
      const lastSeen = lastSeenThrottle.get(user.userId)
      if (!lastSeen || now - lastSeen > LAST_SEEN_THROTTLE_MS) {
        lastSeenThrottle.set(user.userId, now)
        await store.putUser({ ...user, lastSeenAt: new Date(now).toISOString() })
      }

      // Sync platform display fields if the adapter reports updated values
      if (channelUser) {
        const needsUpdate =
          (channelUser.displayName !== undefined && channelUser.displayName !== identity.platformDisplayName) ||
          (channelUser.username !== undefined && channelUser.username !== identity.platformUsername)

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

    // Inject a lightweight identity snapshot into TurnMeta for downstream hooks.
    // Avoids each downstream hook from doing a separate store lookup.
    if (meta) {
      meta.identity = {
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
