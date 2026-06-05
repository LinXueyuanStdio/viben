import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTestContext } from '@viben/plugin-sdk/testing'
import type { TTSProvider } from '../speech-types.js'

// Must be hoisted before importing speechPlugin
vi.mock('../../../core/plugin/plugin-installer.js', () => ({
  installNpmPlugin: vi.fn(),
}))

import speechPlugin from '../index.js'
import { installNpmPlugin } from '../../../core/plugin/plugin-installer.js'

const mockInstallNpmPlugin = installNpmPlugin as ReturnType<typeof vi.fn>

function makeMockTTSProvider(name: string): TTSProvider {
  return {
    name,
    synthesize: vi.fn().mockResolvedValue({
      audioBuffer: Buffer.from('fake-audio'),
      mimeType: 'audio/mp3',
    }),
  }
}

describe('/tts command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('when TTS provider is not available', () => {
    it('prompts to install when user runs /tts on', async () => {
      const ctx = createTestContext({
        pluginName: '@viben/speech',
        pluginConfig: {},
        permissions: speechPlugin.permissions,
      })
      await speechPlugin.setup(ctx as any)

      const response = await ctx.executeCommand('tts', { raw: 'on' })
      expect(response?.type).toBe('menu')
      expect((response as any)?.title).toContain('not installed')
    })

    it('prompts to install when user runs /tts with empty arg', async () => {
      const ctx = createTestContext({
        pluginName: '@viben/speech',
        pluginConfig: {},
        permissions: speechPlugin.permissions,
      })
      await speechPlugin.setup(ctx as any)

      const response = await ctx.executeCommand('tts', { raw: '' })
      expect(response?.type).toBe('menu')
      expect((response as any)?.title).toContain('not installed')
    })

    it('install menu includes an Install Edge TTS option', async () => {
      const ctx = createTestContext({
        pluginName: '@viben/speech',
        pluginConfig: {},
        permissions: speechPlugin.permissions,
      })
      await speechPlugin.setup(ctx as any)

      const response = await ctx.executeCommand('tts', { raw: 'on' }) as any
      expect(response?.type).toBe('menu')
      const labels = response.options.map((o: { label: string }) => o.label)
      expect(labels.some((l: string) => /install/i.test(l))).toBe(true)
    })

    it('install menu includes a Cancel option', async () => {
      const ctx = createTestContext({
        pluginName: '@viben/speech',
        pluginConfig: {},
        permissions: speechPlugin.permissions,
      })
      await speechPlugin.setup(ctx as any)

      const response = await ctx.executeCommand('tts', { raw: 'on' }) as any
      const labels = response.options.map((o: { label: string }) => o.label)
      expect(labels.some((l: string) => /cancel/i.test(l))).toBe(true)
    })
  })

  describe('/tts install', () => {
    it('calls installNpmPlugin with the Edge TTS package name', async () => {
      const ctx = createTestContext({
        pluginName: '@viben/speech',
        pluginConfig: {},
        permissions: speechPlugin.permissions,
      })
      await speechPlugin.setup(ctx as any)

      // Mock a successful install returning a module with no default export.
      // The handler checks `if (plugin && ctx.core)`, so when plugin is falsy it
      // skips lifecycle boot and still returns the success message.
      mockInstallNpmPlugin.mockResolvedValue({ default: null })

      await ctx.executeCommand('tts', { raw: 'install' })

      expect(mockInstallNpmPlugin).toHaveBeenCalledOnce()
      expect(mockInstallNpmPlugin).toHaveBeenCalledWith('@viben/msedge-tts-plugin', expect.anything())
    })

    it('returns a success text response after a successful install', async () => {
      const ctx = createTestContext({
        pluginName: '@viben/speech',
        pluginConfig: {},
        permissions: speechPlugin.permissions,
      })
      await speechPlugin.setup(ctx as any)

      // Return a module stub with no default; handler skips lifecycle boot and returns success text
      mockInstallNpmPlugin.mockResolvedValue({ default: null })

      const response = await ctx.executeCommand('tts', { raw: 'install' })
      expect(response?.type).toBe('text')
      expect((response as any)?.text).toMatch(/installed/i)
    })

    it('returns an error response when installNpmPlugin throws', async () => {
      const ctx = createTestContext({
        pluginName: '@viben/speech',
        pluginConfig: {},
        permissions: speechPlugin.permissions,
      })
      await speechPlugin.setup(ctx as any)

      mockInstallNpmPlugin.mockRejectedValue(new Error('network failure'))

      const response = await ctx.executeCommand('tts', { raw: 'install' })
      expect(response?.type).toBe('error')
      expect((response as any)?.message).toMatch(/network failure/)
    })

    it('error response includes manual install hint', async () => {
      const ctx = createTestContext({
        pluginName: '@viben/speech',
        pluginConfig: {},
        permissions: speechPlugin.permissions,
      })
      await speechPlugin.setup(ctx as any)

      mockInstallNpmPlugin.mockRejectedValue(new Error('timeout'))

      const response = await ctx.executeCommand('tts', { raw: 'install' }) as any
      expect(response?.message).toMatch(/@viben\/msedge-tts-plugin/)
    })
  })

  describe('when TTS provider is available', () => {
    function makeMockSession(id: string) {
      return {
        id,
        voiceMode: 'off' as 'off' | 'next' | 'on',
        setVoiceMode(mode: 'off' | 'next' | 'on') {
          this.voiceMode = mode
        },
      }
    }

    function makeMockSessionManager(sessions: Map<string, ReturnType<typeof makeMockSession>>) {
      return {
        getSession(id: string) {
          return sessions.get(id)
        },
      }
    }

    async function setupWithTTS(opts?: { sessions?: Map<string, ReturnType<typeof makeMockSession>> }) {
      const sessions = opts?.sessions ?? new Map()
      const sessionManager = makeMockSessionManager(sessions)

      const ctx = createTestContext({
        pluginName: '@viben/speech',
        pluginConfig: {},
        permissions: speechPlugin.permissions,
      })
      // Provide session manager via ctx.sessions (kernel:access)
      ;(ctx as any).sessions = sessionManager

      await speechPlugin.setup(ctx as any)

      // Retrieve the speech service and inject a TTS provider so isTTSAvailable() returns true
      const service = ctx.registeredServices.get('speech') as any
      service.registerTTSProvider('edge-tts', makeMockTTSProvider('edge-tts'))

      return { ctx, sessions, sessionManager }
    }

    it('returns text response confirming enabled when /tts on', async () => {
      const mockSession = makeMockSession('sess-1')
      const sessions = new Map([['sess-1', mockSession]])
      const { ctx } = await setupWithTTS({ sessions })
      const response = await ctx.executeCommand('tts', { raw: 'on', sessionId: 'sess-1' })
      expect(response?.type).toBe('text')
      expect((response as any)?.text).toMatch(/enabled/)
    })

    it('returns text response confirming disabled when /tts off', async () => {
      const mockSession = makeMockSession('sess-1')
      const sessions = new Map([['sess-1', mockSession]])
      const { ctx } = await setupWithTTS({ sessions })
      const response = await ctx.executeCommand('tts', { raw: 'off', sessionId: 'sess-1' })
      expect(response?.type).toBe('text')
      expect((response as any)?.text).toMatch(/disabled/)
    })

    it('returns a status menu when /tts is called with no args and TTS is available', async () => {
      const mockSession = makeMockSession('sess-1')
      const sessions = new Map([['sess-1', mockSession]])
      const { ctx } = await setupWithTTS({ sessions })
      const response = await ctx.executeCommand('tts', { raw: '', sessionId: 'sess-1' })
      // With TTS available and empty arg, falls through to the status menu
      expect(response?.type).toBe('menu')
    })

    it('sets session voiceMode to "on" when /tts on is called with a valid sessionId', async () => {
      const mockSession = makeMockSession('sess-1')
      const sessions = new Map([['sess-1', mockSession]])
      const { ctx } = await setupWithTTS({ sessions })

      await ctx.executeCommand('tts', { raw: 'on', sessionId: 'sess-1' })
      expect(mockSession.voiceMode).toBe('on')
    })

    it('sets session voiceMode to "off" when /tts off is called with a valid sessionId', async () => {
      const mockSession = makeMockSession('sess-1')
      mockSession.voiceMode = 'on'
      const sessions = new Map([['sess-1', mockSession]])
      const { ctx } = await setupWithTTS({ sessions })

      await ctx.executeCommand('tts', { raw: 'off', sessionId: 'sess-1' })
      expect(mockSession.voiceMode).toBe('off')
    })

    it('sets session voiceMode to "next" when /tts next is called with a valid sessionId', async () => {
      const mockSession = makeMockSession('sess-1')
      const sessions = new Map([['sess-1', mockSession]])
      const { ctx } = await setupWithTTS({ sessions })

      await ctx.executeCommand('tts', { raw: 'next', sessionId: 'sess-1' })
      expect(mockSession.voiceMode).toBe('next')
    })

    it('does not crash when sessionId is null (no session context)', async () => {
      const { ctx } = await setupWithTTS()
      const response = await ctx.executeCommand('tts', { raw: 'on', sessionId: null })
      expect(response?.type).toBe('text')
      expect((response as any)?.text).toMatch(/enabled/)
    })

    it('does not crash when session is not found for sessionId', async () => {
      const { ctx } = await setupWithTTS()
      const response = await ctx.executeCommand('tts', { raw: 'on', sessionId: 'nonexistent' })
      expect(response?.type).toBe('text')
      expect((response as any)?.text).toMatch(/enabled/)
    })
  })

  describe('speech service registration', () => {
    it('registers the speech service during setup', async () => {
      const ctx = createTestContext({
        pluginName: '@viben/speech',
        pluginConfig: {},
        permissions: speechPlugin.permissions,
      })
      await speechPlugin.setup(ctx as any)

      expect(ctx.registeredServices.has('speech')).toBe(true)
    })

    it('registers the tts command during setup', async () => {
      const ctx = createTestContext({
        pluginName: '@viben/speech',
        pluginConfig: {},
        permissions: speechPlugin.permissions,
      })
      await speechPlugin.setup(ctx as any)

      expect(ctx.registeredCommands.has('tts')).toBe(true)
    })

    it('configures STT with groq when groqApiKey is provided', async () => {
      const ctx = createTestContext({
        pluginName: '@viben/speech',
        pluginConfig: { groqApiKey: 'gsk_test_key' },
        permissions: speechPlugin.permissions,
      })
      await speechPlugin.setup(ctx as any)

      const service = ctx.registeredServices.get('speech') as any
      expect(service.isSTTAvailable()).toBe(true)
    })

    it('does not configure STT when groqApiKey is absent', async () => {
      const ctx = createTestContext({
        pluginName: '@viben/speech',
        pluginConfig: {},
        permissions: speechPlugin.permissions,
      })
      await speechPlugin.setup(ctx as any)

      const service = ctx.registeredServices.get('speech') as any
      expect(service.isSTTAvailable()).toBe(false)
    })

    it('reads ttsProvider from pluginConfig instead of hardcoding edge-tts', async () => {
      const ctx = createTestContext({
        pluginName: '@viben/speech',
        pluginConfig: { ttsProvider: 'custom-tts' },
        permissions: speechPlugin.permissions,
      })
      await speechPlugin.setup(ctx as any)

      const service = ctx.registeredServices.get('speech') as any
      // The config should reflect the custom provider name
      expect(service.config.tts.provider).toBe('custom-tts')
    })

    it('defaults ttsProvider to edge-tts when not specified in pluginConfig', async () => {
      const ctx = createTestContext({
        pluginName: '@viben/speech',
        pluginConfig: {},
        permissions: speechPlugin.permissions,
      })
      await speechPlugin.setup(ctx as any)

      const service = ctx.registeredServices.get('speech') as any
      expect(service.config.tts.provider).toBe('edge-tts')
    })
  })
})
