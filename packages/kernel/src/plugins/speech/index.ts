import path from 'node:path'
import type { VibenPlugin, InstallContext, PluginContext } from '../../core/plugin/types.js'
import type { VibenCore } from '../../core/core.js'
import type { Session } from '../../core/sessions/session.js'
import { SpeechService, GroqSTT } from './exports.js'
import type { SpeechServiceConfig } from './exports.js'
import { installNpmPlugin } from '../../core/plugin/plugin-installer.js'

// TTS is provided by a separate optional plugin so the core speech plugin
// doesn't bundle a large native dependency on every install.
const EDGE_TTS_PLUGIN = '@viben/msedge-tts-plugin'

const speechPlugin: VibenPlugin = {
  name: '@viben/speech',
  version: '1.0.0',
  description: 'Text-to-speech and speech-to-text with pluggable providers',
  essential: false,
  // file-service is needed to persist synthesized audio for adapters that send files
  optionalPluginDependencies: { '@viben/file-service': '^1.0.0' },
  permissions: ['services:register', 'commands:register', 'kernel:access'],
  inheritableKeys: ['ttsProvider', 'ttsVoice'],

  async install(ctx: InstallContext) {
    const { terminal, settings } = ctx
    const pluginsDir = ctx.instanceRoot ? path.join(ctx.instanceRoot, 'plugins') : undefined

    // Interactive setup
    const enableStt = await terminal.confirm({
      message: 'Enable speech-to-text (STT)?',
      initialValue: false,
    })

    let sttProvider: string | null = null
    let groqApiKey = ''

    if (enableStt) {
      sttProvider = await terminal.select({
        message: 'STT provider:',
        options: [{ value: 'groq', label: 'Groq (Whisper)', hint: 'Fast and affordable' }],
      })

      if (sttProvider === 'groq') {
        groqApiKey = await terminal.text({
          message: 'Groq API key:',
          validate: (v) => (!v.trim() ? 'API key cannot be empty' : undefined),
        })
        groqApiKey = groqApiKey.trim()
      }
    }

    const ttsProvider = await terminal.select({
      message: 'TTS provider:',
      options: [
        { value: 'edge-tts', label: 'Edge TTS', hint: 'Free, good quality' },
        { value: 'none', label: 'None (disable TTS)' },
      ],
    })

    let ttsVoice = ''
    if (ttsProvider === 'edge-tts') {
      terminal.log.info('Installing Edge TTS plugin...')
      try {
        await installNpmPlugin(EDGE_TTS_PLUGIN, pluginsDir)
        terminal.log.success('Edge TTS plugin installed')
      } catch (err) {
        terminal.log.warning(`Failed to install Edge TTS plugin: ${err}. You can install it later with: viben plugin install ${EDGE_TTS_PLUGIN}`)
      }

      ttsVoice = await terminal.text({
        message: 'TTS voice (leave blank for default):',
        placeholder: 'e.g. en-US-AriaNeural',
      })
      ttsVoice = ttsVoice.trim()
    }

    await settings.setAll({
      sttProvider,
      groqApiKey,
      ttsProvider: ttsProvider === 'none' ? null : ttsProvider,
      ttsVoice,
    })
    terminal.log.success('Speech settings saved')
  },

  async configure(ctx: InstallContext) {
    const { terminal, settings } = ctx
    const current = await settings.getAll()

    const choice = await terminal.select({
      message: 'What to configure?',
      options: [
        { value: 'stt', label: 'Change STT provider/key' },
        { value: 'tts', label: 'Change TTS provider/voice' },
        { value: 'done', label: 'Done' },
      ],
    })

    if (choice === 'stt') {
      const key = await terminal.text({
        message: 'Groq API key (leave blank to disable STT):',
        defaultValue: (current.groqApiKey as string) ?? '',
      })
      const trimmed = key.trim()
      await settings.set('sttProvider', trimmed ? 'groq' : null)
      await settings.set('groqApiKey', trimmed)
      terminal.log.success('STT settings updated')
    } else if (choice === 'tts') {
      const voice = await terminal.text({
        message: 'TTS voice (leave blank for default):',
        defaultValue: (current.ttsVoice as string) ?? '',
      })
      await settings.set('ttsVoice', voice.trim())
      terminal.log.success('TTS settings updated')
    }
  },

  async uninstall(ctx: InstallContext, opts: { purge: boolean }) {
    if (opts.purge) {
      await ctx.settings.clear()
      ctx.terminal.log.success('Speech settings cleared')
    }
  },

  async setup(ctx) {
    ctx.registerEditableFields([
      { key: 'sttProvider', displayName: 'Speech to Text', type: 'select', scope: 'safe', hotReload: true, options: ['groq'] },
      { key: 'groqApiKey', displayName: 'STT API Key', type: 'string', scope: 'sensitive', hotReload: true },
      { key: 'ttsProvider', displayName: 'Text to Speech', type: 'select', scope: 'safe', hotReload: true, options: ['edge-tts'] },
    ])

    const pluginsDir = ctx.instanceRoot ? path.join(ctx.instanceRoot, 'plugins') : undefined
    const config = ctx.pluginConfig as Record<string, unknown>
    const groqApiKey = config.groqApiKey as string | undefined

    // STT provider is determined solely by whether an API key is present
    const sttProvider = groqApiKey ? 'groq' : null
    const speechConfig: SpeechServiceConfig = {
      stt: {
        provider: sttProvider,
        providers: groqApiKey ? { groq: { apiKey: groqApiKey } } : {},
      },
      tts: {
        provider: (config.ttsProvider as string) ?? 'edge-tts',
        providers: {},
      },
    }

    const service = new SpeechService(speechConfig)

    if (groqApiKey) {
      service.registerSTTProvider('groq', new GroqSTT(groqApiKey))
    }

    // TTS provider is now registered by @viben/msedge-tts-plugin (no EdgeTTS here)

    // Register provider factory for hot-reload (STT only — TTS providers are managed by external plugins)
    service.setProviderFactory((cfg) => {
      const sttMap = new Map()
      const ttsMap = new Map()
      const groqCfg = cfg.stt?.providers?.groq
      if (groqCfg?.apiKey) {
        sttMap.set('groq', new GroqSTT(groqCfg.apiKey, groqCfg.model))
      }
      return { stt: sttMap, tts: ttsMap }
    })

    ctx.registerService('speech', service)

    // Helper to look up the session and set voiceMode
    const setSessionVoiceMode = (pluginCtx: PluginContext, sessionId: string | null, voiceMode: 'off' | 'next' | 'on'): void => {
      if (!sessionId) return
      try {
        const sessionManager = pluginCtx.sessions as { getSession(id: string): Session | undefined }
        const session = sessionManager.getSession(sessionId)
        if (session) {
          session.setVoiceMode(voiceMode)
        }
      } catch {
        // Session lookup may fail if kernel:access is unavailable; silently ignore
      }
    }

    ctx.registerCommand({
      name: 'tts',
      description: 'Toggle text-to-speech',
      usage: 'on|off|next|install',
      category: 'plugin',
      handler: async (args) => {
        const mode = args.raw.trim().toLowerCase()

        // Check if TTS provider is available
        if ((mode === 'on' || mode === '' || mode === 'next') && !service.isTTSAvailable()) {
          return {
            type: 'menu' as const,
            title: 'TTS provider not installed. Install Edge TTS plugin?',
            options: [
              { label: 'Install Edge TTS', command: '/tts install' },
              { label: 'Cancel', command: '/tts off' },
            ],
          }
        }

        if (mode === 'install') {
          try {
            const mod = await installNpmPlugin(EDGE_TTS_PLUGIN, pluginsDir)
            const plugin = mod.default
            if (plugin && ctx.core) {
              // Boot the newly installed plugin without restarting the process
              const lm = (ctx.core as VibenCore).lifecycleManager
              const registry = lm.registry
              if (registry) {
                registry.register(plugin.name, {
                  version: plugin.version,
                  source: 'npm',
                  enabled: true,
                  settingsPath: '',
                  description: plugin.description,
                })
                await registry.save()
              }
              await lm.boot([plugin])
            }
            return { type: 'text' as const, text: 'Edge TTS plugin installed and ready! Use /tts on to enable.' }
          } catch (err) {
            return { type: 'error' as const, message: `Failed to install Edge TTS plugin: ${err}. Try manually: viben plugin install ${EDGE_TTS_PLUGIN}` }
          }
        }

        if (mode === 'on') {
          setSessionVoiceMode(ctx, args.sessionId, 'on')
          return { type: 'text' as const, text: 'Text-to-speech enabled' }
        }
        if (mode === 'off') {
          setSessionVoiceMode(ctx, args.sessionId, 'off')
          return { type: 'text' as const, text: 'Text-to-speech disabled' }
        }
        if (mode === 'next') {
          setSessionVoiceMode(ctx, args.sessionId, 'next')
          return { type: 'text' as const, text: 'Text-to-speech enabled for next message' }
        }
        return { type: 'menu' as const, title: 'Text to Speech', options: [
          { label: 'Enable', command: '/tts on' },
          { label: 'Disable', command: '/tts off' },
          { label: 'Next message only', command: '/tts next' },
        ]}
      },
    })

    ctx.log.info('Speech service ready')
  },
}

export default speechPlugin
