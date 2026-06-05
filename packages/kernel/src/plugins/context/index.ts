import * as path from 'node:path'
import type { VibenPlugin, InstallContext } from '../../core/plugin/types.js'
import type { SessionRecord } from '../../core/types.js'
import { ContextManager } from './context-manager.js'
import { EntireProvider } from './entire/entire-provider.js'
import { HistoryProvider } from './history/history-provider.js'
import { HistoryRecorder } from './history/history-recorder.js'
import { HistoryStore } from './history/history-store.js'
import { Hook } from '../../core/events.js'

/**
 * Context plugin — records conversation history and injects it into agent prompts.
 *
 * Setup wires up five middleware hooks that together keep a rolling history of every
 * session on disk and prepend it to the next agent prompt via `agent:beforePrompt`.
 * Two providers are registered in priority order:
 *   1. HistoryProvider (local) — always available, covers live/recent sessions
 *   2. EntireProvider — available when the repo has the Entire checkpoint branch
 */
const contextPlugin: VibenPlugin = {
  name: '@viben/context',
  version: '1.0.0',
  description: 'Conversation context management with pluggable providers',
  essential: false,
  permissions: ['services:register', 'middleware:register', 'kernel:access'],

  async install(ctx: InstallContext) {
    const { settings, terminal } = ctx

    // No interactive prompts needed — save defaults
    await settings.setAll({ enabled: true })
    terminal.log.success('Context defaults saved')
  },

  async configure(ctx: InstallContext) {
    const { terminal, settings } = ctx
    const current = await settings.getAll()

    const toggle = await terminal.confirm({
      message: `Context service is ${current.enabled !== false ? 'enabled' : 'disabled'}. Toggle?`,
      initialValue: false,
    })
    if (toggle) {
      const newState = current.enabled === false
      await settings.set('enabled', newState)
      terminal.log.success(`Context service ${newState ? 'enabled' : 'disabled'}`)
    }
  },

  async uninstall(ctx: InstallContext, opts: { purge: boolean }) {
    if (opts.purge) {
      await ctx.settings.clear()
      ctx.terminal.log.success('Context settings cleared')
    }
  },

  async setup(ctx) {
    // History recording and context
    const historyDir = path.join(ctx.instanceRoot, 'history')
    const store = new HistoryStore(historyDir)
    const recorder = new HistoryRecorder(store)

    // Access session records via SessionManager (kernel:access)
    const sessionManager = ctx.sessions as { listRecords(): SessionRecord[] }
    const getRecords = () => sessionManager.listRecords()

    // Register providers — local first (priority), entire as fallback
    const cachePath = path.join(ctx.instanceRoot, 'cache', 'entire')
    const manager = new ContextManager(cachePath)
    manager.register(new HistoryProvider(store, getRecords))
    manager.register(new EntireProvider())
    manager.setHistoryStore(store)
    manager.registerFlusher((sessionId) => recorder.flush(sessionId))
    ctx.registerService('context', manager)

    // Middleware: capture user prompts
    ctx.registerMiddleware(Hook.AGENT_BEFORE_PROMPT, {
      priority: 200,
      handler: async (payload, next) => {
        recorder.onBeforePrompt(payload.sessionId, payload.text, payload.attachments, payload.sourceAdapterId, payload.meta as Record<string, unknown> | undefined)
        return next()
      },
    })

    // Middleware: capture agent events
    ctx.registerMiddleware(Hook.AGENT_AFTER_EVENT, {
      priority: 200,
      handler: async (payload, next) => {
        recorder.onAfterEvent(payload.sessionId, payload.event)
        return next()
      },
    })

    // Middleware: finalize turn and write to disk
    ctx.registerMiddleware(Hook.TURN_END, {
      priority: 200,
      handler: async (payload, next) => {
        await recorder.onTurnEnd(payload.sessionId, payload.stopReason)
        return next()
      },
    })

    // Middleware: capture permission resolutions
    ctx.registerMiddleware(Hook.PERMISSION_AFTER_RESOLVE, {
      priority: 200,
      handler: async (payload, next) => {
        recorder.onPermissionResolved(payload.sessionId, payload.requestId, payload.decision)
        return next()
      },
    })

    // Middleware: flush in-progress turn and clean up on session destroy
    ctx.registerMiddleware(Hook.SESSION_AFTER_DESTROY, {
      priority: 200,
      handler: async (payload, next) => {
        await recorder.onSessionDestroy(payload.sessionId)
        return next()
      },
    })

    ctx.log.info('Context service ready (local history + entire providers)')
  },
}

export default contextPlugin
