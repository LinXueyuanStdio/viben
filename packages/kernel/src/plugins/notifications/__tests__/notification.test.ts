import { describe, it, expect, vi } from 'vitest'
import { NotificationManager, NotificationService } from '../notification.js'
import type { IChannelAdapter } from '../../../core/channel.js'
import type { NotificationMessage } from '../../../core/types.js'

function mockAdapter(name = 'test'): IChannelAdapter {
  return {
    name,
    capabilities: { streaming: false, richFormatting: false, threads: false, reactions: false, fileUpload: false, voice: false },
    start: vi.fn(),
    stop: vi.fn(),
    sendMessage: vi.fn(),
    sendPermissionRequest: vi.fn(),
    sendNotification: vi.fn().mockResolvedValue(undefined),
    createSessionThread: vi.fn(),
    renameSessionThread: vi.fn(),
    deleteSessionThread: vi.fn(),
    sendSkillCommands: vi.fn(),
    cleanupSkillCommands: vi.fn(),
    sendUserNotification: vi.fn().mockResolvedValue(undefined),
  } as unknown as IChannelAdapter
}

function mockAdapterWithoutUserNotification(name = 'test'): IChannelAdapter {
  const adapter = mockAdapter(name)
  // Simulate an adapter that hasn't implemented sendUserNotification
  const { sendUserNotification: _, ...rest } = adapter as any
  return rest as unknown as IChannelAdapter
}

describe('NotificationService (alias: NotificationManager)', () => {
  const notification: NotificationMessage = {
    sessionId: 'sess-1',
    type: 'completed',
    summary: 'Test notification',
  }

  // Verify the backward compat alias works
  it('NotificationManager is an alias for NotificationService', () => {
    expect(NotificationManager).toBe(NotificationService)
  })

  describe('notify()', () => {
    it('sends notification to specified adapter', async () => {
      const adapter = mockAdapter()
      const adapters = new Map([['telegram', adapter]])
      const manager = new NotificationManager(adapters)

      await manager.notify('telegram', notification)

      expect(adapter.sendNotification).toHaveBeenCalledWith(notification)
    })

    it('does nothing when adapter not found', async () => {
      const adapters = new Map<string, IChannelAdapter>()
      const manager = new NotificationManager(adapters)

      // Should not throw
      await manager.notify('unknown', notification)
    })

    it('does not notify other adapters', async () => {
      const telegram = mockAdapter('telegram')
      const discord = mockAdapter('discord')
      const adapters = new Map([
        ['telegram', telegram],
        ['discord', discord],
      ])
      const manager = new NotificationManager(adapters)

      await manager.notify('telegram', notification)

      expect(telegram.sendNotification).toHaveBeenCalledWith(notification)
      expect(discord.sendNotification).not.toHaveBeenCalled()
    })
  })

  describe('notifyAll()', () => {
    it('sends notification to all adapters', async () => {
      const telegram = mockAdapter('telegram')
      const discord = mockAdapter('discord')
      const adapters = new Map([
        ['telegram', telegram],
        ['discord', discord],
      ])
      const manager = new NotificationManager(adapters)

      await manager.notifyAll(notification)

      expect(telegram.sendNotification).toHaveBeenCalledWith(notification)
      expect(discord.sendNotification).toHaveBeenCalledWith(notification)
    })

    it('handles empty adapter map', async () => {
      const adapters = new Map<string, IChannelAdapter>()
      const manager = new NotificationManager(adapters)

      // Should not throw
      await manager.notifyAll(notification)
    })

    it('sends to single adapter when only one registered', async () => {
      const adapter = mockAdapter()
      const adapters = new Map([['telegram', adapter]])
      const manager = new NotificationManager(adapters)

      await manager.notifyAll(notification)

      expect(adapter.sendNotification).toHaveBeenCalledTimes(1)
    })
  })

  describe('error resilience', () => {
    it('notify() does not throw when adapter.sendNotification fails', async () => {
      const adapter = mockAdapter()
      ;(adapter.sendNotification as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network error'))
      const adapters = new Map([['telegram', adapter]])
      const manager = new NotificationManager(adapters)

      // Should not throw
      await manager.notify('telegram', notification)
    })

    it('notifyAll() continues to next adapter when one fails', async () => {
      const failing = mockAdapter('failing')
      ;(failing.sendNotification as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network error'))
      const working = mockAdapter('working')
      const adapters = new Map([
        ['telegram', failing],
        ['discord', working],
      ])
      const manager = new NotificationManager(adapters)

      await manager.notifyAll(notification)

      expect(failing.sendNotification).toHaveBeenCalledWith(notification)
      expect(working.sendNotification).toHaveBeenCalledWith(notification)
    })
  })

  describe('notifyUser()', () => {
    const message = { type: 'text' as const, text: 'Hello!' }

    it('calls sendUserNotification on direct { channelId, platformId } target', async () => {
      const adapter = mockAdapter('telegram')
      const adapters = new Map([['telegram', adapter]])
      const service = new NotificationService(adapters)

      await service.notifyUser({ channelId: 'telegram', platformId: 'user-123' }, message)

      expect(adapter.sendUserNotification).toHaveBeenCalledWith('user-123', message, expect.objectContaining({}))
    })

    it('skips gracefully when adapter does not have sendUserNotification', async () => {
      const adapter = mockAdapterWithoutUserNotification('telegram')
      const adapters = new Map([['telegram', adapter]])
      const service = new NotificationService(adapters)

      // Should not throw
      await service.notifyUser({ channelId: 'telegram', platformId: 'user-123' }, message)
    })

    it('does nothing with identity target when no resolver is set', async () => {
      const adapter = mockAdapter('telegram')
      const adapters = new Map([['telegram', adapter]])
      const service = new NotificationService(adapters)

      await service.notifyUser({ identityId: 'identity-1' }, message)

      // No resolver → no delivery
      expect(adapter.sendUserNotification).not.toHaveBeenCalled()
    })

    it('resolves via identityId and delivers to all user platforms', async () => {
      const telegram = mockAdapter('telegram')
      const discord = mockAdapter('discord')
      const adapters = new Map([
        ['telegram', telegram],
        ['discord', discord],
      ])
      const service = new NotificationService(adapters)

      const resolver = {
        getIdentity: vi.fn().mockResolvedValue({ userId: 'user-1', source: 'telegram', platformId: 'tg-123' }),
        getUser: vi.fn().mockResolvedValue({ userId: 'user-1', identities: ['identity-1', 'identity-2'] }),
        getIdentitiesFor: vi.fn().mockResolvedValue([
          { identityId: 'identity-1', source: 'telegram', platformId: 'tg-123', platformUsername: 'alice' },
          { identityId: 'identity-2', source: 'discord', platformId: 'dc-456' },
        ]),
      }
      service.setIdentityResolver(resolver)

      await service.notifyUser({ identityId: 'identity-1' }, message)

      expect(resolver.getIdentity).toHaveBeenCalledWith('identity-1')
      expect(resolver.getUser).toHaveBeenCalledWith('user-1')
      expect(resolver.getIdentitiesFor).toHaveBeenCalledWith('user-1')
      expect(telegram.sendUserNotification).toHaveBeenCalledWith('tg-123', message, expect.objectContaining({
        platformMention: { platformUsername: 'alice', platformId: 'tg-123' },
      }))
      expect(discord.sendUserNotification).toHaveBeenCalledWith('dc-456', message, expect.objectContaining({}))
    })

    it('resolves via userId and delivers to all platforms', async () => {
      const adapter = mockAdapter('slack')
      const adapters = new Map([['slack', adapter]])
      const service = new NotificationService(adapters)

      const resolver = {
        getIdentity: vi.fn(),
        getUser: vi.fn(),
        getIdentitiesFor: vi.fn().mockResolvedValue([
          { identityId: 'identity-3', source: 'slack', platformId: 'sk-789' },
        ]),
      }
      service.setIdentityResolver(resolver)

      await service.notifyUser({ userId: 'user-2' }, message)

      expect(resolver.getIdentitiesFor).toHaveBeenCalledWith('user-2')
      expect(adapter.sendUserNotification).toHaveBeenCalledWith('sk-789', message, expect.objectContaining({}))
    })

    it('applies onlyPlatforms filter', async () => {
      const telegram = mockAdapter('telegram')
      const discord = mockAdapter('discord')
      const adapters = new Map([
        ['telegram', telegram],
        ['discord', discord],
      ])
      const service = new NotificationService(adapters)

      const resolver = {
        getIdentity: vi.fn(),
        getUser: vi.fn(),
        getIdentitiesFor: vi.fn().mockResolvedValue([
          { identityId: 'i1', source: 'telegram', platformId: 'tg-1' },
          { identityId: 'i2', source: 'discord', platformId: 'dc-1' },
        ]),
      }
      service.setIdentityResolver(resolver)

      await service.notifyUser({ userId: 'user-1' }, message, { onlyPlatforms: ['telegram'] })

      expect(telegram.sendUserNotification).toHaveBeenCalled()
      expect(discord.sendUserNotification).not.toHaveBeenCalled()
    })

    it('applies excludePlatforms filter', async () => {
      const telegram = mockAdapter('telegram')
      const discord = mockAdapter('discord')
      const adapters = new Map([
        ['telegram', telegram],
        ['discord', discord],
      ])
      const service = new NotificationService(adapters)

      const resolver = {
        getIdentity: vi.fn(),
        getUser: vi.fn(),
        getIdentitiesFor: vi.fn().mockResolvedValue([
          { identityId: 'i1', source: 'telegram', platformId: 'tg-1' },
          { identityId: 'i2', source: 'discord', platformId: 'dc-1' },
        ]),
      }
      service.setIdentityResolver(resolver)

      await service.notifyUser({ userId: 'user-1' }, message, { excludePlatforms: ['discord'] })

      expect(telegram.sendUserNotification).toHaveBeenCalled()
      expect(discord.sendUserNotification).not.toHaveBeenCalled()
    })

    it('does not propagate errors (fire-and-forget)', async () => {
      const adapter = mockAdapter('telegram')
      ;(adapter.sendUserNotification as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('delivery failed'))
      const adapters = new Map([['telegram', adapter]])
      const service = new NotificationService(adapters)

      // Should not throw even if delivery fails
      await service.notifyUser({ channelId: 'telegram', platformId: 'user-123' }, message)
    })

    it('continues delivering to remaining platforms when one fails', async () => {
      const failing = mockAdapter('telegram')
      ;(failing.sendUserNotification as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('failed'))
      const working = mockAdapter('discord')
      const adapters = new Map([
        ['telegram', failing],
        ['discord', working],
      ])
      const service = new NotificationService(adapters)

      const resolver = {
        getIdentity: vi.fn(),
        getUser: vi.fn(),
        getIdentitiesFor: vi.fn().mockResolvedValue([
          { identityId: 'i1', source: 'telegram', platformId: 'tg-1' },
          { identityId: 'i2', source: 'discord', platformId: 'dc-1' },
        ]),
      }
      service.setIdentityResolver(resolver)

      await service.notifyUser({ userId: 'user-1' }, message)

      // Working adapter must still receive the notification
      expect(working.sendUserNotification).toHaveBeenCalledWith('dc-1', message, expect.anything())
    })
  })
})
