import type { IChannelAdapter } from '../../core/channel.js'
import type { NotificationMessage } from '../../core/types.js'
import type { EventBus } from '../../core/event-bus.js'
import { BusEvent } from '../../core/events.js'

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

/** User-facing notification content — distinct from system NotificationMessage. */
export interface UserNotificationContent {
  type: 'text'
  text: string
}

/**
 * Minimal identity service interface — avoids hard dependency on identity plugin types.
 * NotificationService only needs resolution capabilities, not full CRUD.
 */
interface IdentityResolver {
  getIdentity(identityId: string): Promise<{ userId: string; source: string; platformId: string; platformUsername?: string } | undefined>
  getUser(userId: string): Promise<{ userId: string; identities: string[] } | undefined>
  getIdentitiesFor(userId: string): Promise<Array<{ identityId: string; source: string; platformId: string; platformUsername?: string }>>
}

/**
 * Routes notifications to channel adapters. Extends the legacy NotificationManager
 * with user-targeted delivery via the identity system.
 *
 * Legacy API (notify/notifyAll) is preserved — existing callers in SessionBridge
 * continue to work without changes.
 */
export class NotificationService {
  private identityResolver?: IdentityResolver
  private eventBus?: EventBus

  constructor(private adapters: Map<string, IChannelAdapter>) {}

  /** Inject EventBus to broadcast user:notification events for SSE delivery to App clients. */
  setEventBus(bus: EventBus): void {
    this.eventBus = bus
  }

  /** Inject identity resolver for user-targeted notifications. */
  setIdentityResolver(resolver: IdentityResolver): void {
    this.identityResolver = resolver
  }

  // --- Legacy API (backward compat with NotificationManager) ---

  /**
   * Send a notification to a specific channel adapter.
   *
   * Failures are swallowed — notifications are best-effort and must not crash
   * the session or caller (e.g. on session completion).
   */
  async notify(channelId: string, notification: NotificationMessage): Promise<void> {
    const adapter = this.adapters.get(channelId)
    if (!adapter) return
    try {
      await adapter.sendNotification(notification)
    } catch {
      // Best effort
    }
  }

  /**
   * Broadcast a notification to every registered adapter.
   *
   * Used for system-wide alerts (e.g. global budget exhausted). Each adapter
   * failure is isolated so one broken adapter cannot block the rest.
   */
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

  /**
   * Send a notification to a user across all their linked platforms.
   * Fire-and-forget — never throws, swallows all errors.
   */
  async notifyUser(
    target: NotificationTarget,
    message: UserNotificationContent,
    options?: NotificationOptions,
  ): Promise<void> {
    try {
      const userId = 'userId' in target ? target.userId : undefined
      await this._resolveAndDeliver(target, message, options)
      // Emit on EventBus so SSEManager can broadcast to App clients over /api/v1/events.
      // This is the only SSE stream the App subscribes to.
      if (this.eventBus && userId) {
        this.eventBus.emit(BusEvent.USER_NOTIFICATION, {
          userId,
          text: message.text,
          sessionId: options?.sessionId,
        })
      }
    } catch {
      // Fire-and-forget
    }
  }

  private async _resolveAndDeliver(
    target: NotificationTarget,
    message: UserNotificationContent,
    options?: NotificationOptions,
  ): Promise<void> {
    // Direct adapter call — bypass identity resolution.
    // sendUserNotification accepts NotificationMessage which covers UserNotificationContent shape.
    if ('channelId' in target && 'platformId' in target) {
      const adapter = this.adapters.get(target.channelId)
      if (!adapter?.sendUserNotification) return
      await adapter.sendUserNotification(target.platformId, message as unknown as NotificationMessage, {
        via: options?.via,
        topicId: options?.topicId,
        sessionId: options?.sessionId,
      })
      return
    }

    // Identity-based resolution
    if (!this.identityResolver) return

    let identities: Array<{ identityId: string; source: string; platformId: string; platformUsername?: string }> = []

    if ('identityId' in target) {
      const identity = await this.identityResolver.getIdentity(target.identityId)
      if (!identity) return
      const user = await this.identityResolver.getUser(identity.userId)
      if (!user) return
      identities = await this.identityResolver.getIdentitiesFor(user.userId)
    } else if ('userId' in target) {
      identities = await this.identityResolver.getIdentitiesFor(target.userId)
    }

    // Platform filters
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
        await adapter.sendUserNotification(identity.platformId, message as unknown as NotificationMessage, {
          via: options?.via,
          topicId: options?.topicId,
          sessionId: options?.sessionId,
          platformMention: {
            platformUsername: identity.platformUsername,
            platformId: identity.platformId,
          },
        })
      } catch {
        // Continue — best effort
      }
    }
  }
}

// Backward compat alias — existing imports use NotificationManager
export { NotificationService as NotificationManager }
