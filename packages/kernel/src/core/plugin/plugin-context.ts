import type {
  PluginContext,
  PluginPermission,
  CommandDef,
  MiddlewareHook,
  MiddlewareOptions,
  MiddlewarePayloadMap,
  PluginStorage,
  EventBus,
  Logger,
  OutgoingMessage,
  MenuItem,
} from './types.js'
import type { MenuRegistry } from '../menu-registry.js'
import type { AssistantSection } from '../assistant/assistant-registry.js'
import type { AssistantRegistry } from '../assistant/assistant-registry.js'
import { ServiceRegistry } from './service-registry.js'
import { MiddlewareChain } from './middleware-chain.js'
import { ErrorTracker } from './error-tracker.js'
import { PluginStorageImpl } from './plugin-storage.js'

/** Internal options for creating a PluginContext. Passed from LifecycleManager. */
interface CreatePluginContextOpts {
  pluginName: string
  pluginConfig: Record<string, unknown>
  permissions: PluginPermission[]
  serviceRegistry: ServiceRegistry
  middlewareChain: MiddlewareChain
  errorTracker: ErrorTracker
  eventBus: EventBus & {
    on(event: string, handler: (...args: unknown[]) => void): void
    off(event: string, handler: (...args: unknown[]) => void): void
    emit(event: string, payload: unknown): void
  }
  storagePath: string
  sessions: unknown
  config: unknown
  core?: unknown
  log?: Logger
  instanceRoot?: string
}

/** Gate that throws if the plugin's declared permissions don't include the required one. */
function requirePermission(permissions: PluginPermission[], required: PluginPermission, action: string): void {
  if (!permissions.includes(required)) {
    throw new Error(`Plugin does not have '${required}' permission required for ${action}`)
  }
}

/**
 * Factory that creates a scoped, permission-gated PluginContext for a single plugin.
 *
 * Every call to a context method checks the plugin's declared permissions first.
 * The returned object also includes a `cleanup()` method used by LifecycleManager
 * to remove all registrations (listeners, middleware, services, commands) when
 * the plugin is unloaded — ensuring no dangling references.
 */
export function createPluginContext(opts: CreatePluginContextOpts): PluginContext & { cleanup(): void } {
  const {
    pluginName,
    pluginConfig,
    permissions,
    serviceRegistry,
    middlewareChain,
    eventBus,
    storagePath,
    sessions,
    config,
    core,
  } = opts
  const instanceRoot = opts.instanceRoot!

  // Track all registrations so cleanup() can remove them on plugin unload.
  // Without this, unloaded plugins would leave orphaned listeners and middleware.
  const registeredListeners: Array<{ event: string; handler: (...args: unknown[]) => void }> = []
  const registeredCommands: CommandDef[] = []
  const registeredMenuItemIds: string[] = []
  const registeredAssistantSectionIds: string[] = []

  const noopLog: Logger = {
    trace() {},
    debug() {},
    info() {},
    warn() {},
    error() {},
    fatal() {},
    child() { return noopLog },
  }
  const baseLog: Logger = opts.log ?? noopLog
  const log: Logger = typeof baseLog.child === 'function'
    ? baseLog.child({ plugin: pluginName })
    : baseLog

  const storageImpl = new PluginStorageImpl(storagePath)

  // Wrap storage operations with permission checks — plugins without
  // storage:read or storage:write permissions cannot access the filesystem.
  const storage: PluginStorage = {
    async get<T>(key: string): Promise<T | undefined> {
      requirePermission(permissions, 'storage:read', 'storage.get')
      return storageImpl.get<T>(key)
    },
    async set<T>(key: string, value: T): Promise<void> {
      requirePermission(permissions, 'storage:write', 'storage.set')
      return storageImpl.set(key, value)
    },
    async delete(key: string): Promise<void> {
      requirePermission(permissions, 'storage:write', 'storage.delete')
      return storageImpl.delete(key)
    },
    async list(): Promise<string[]> {
      requirePermission(permissions, 'storage:read', 'storage.list')
      return storageImpl.list()
    },
    async keys(prefix?: string): Promise<string[]> {
      requirePermission(permissions, 'storage:read', 'storage.keys')
      return storageImpl.keys(prefix)
    },
    async clear(): Promise<void> {
      requirePermission(permissions, 'storage:write', 'storage.clear')
      return storageImpl.clear()
    },
    getDataDir(): string {
      requirePermission(permissions, 'storage:read', 'storage.getDataDir')
      return storageImpl.getDataDir()
    },
    forSession(sessionId: string): PluginStorage {
      requirePermission(permissions, 'storage:read', 'storage.forSession')
      // Return a permission-wrapped session-scoped storage
      const scoped = storageImpl.forSession(sessionId)
      return {
        get: <T>(key: string) => { requirePermission(permissions, 'storage:read', 'storage.get'); return scoped.get<T>(key) },
        set: <T>(key: string, value: T) => { requirePermission(permissions, 'storage:write', 'storage.set'); return scoped.set(key, value) },
        delete: (key: string) => { requirePermission(permissions, 'storage:write', 'storage.delete'); return scoped.delete(key) },
        list: () => { requirePermission(permissions, 'storage:read', 'storage.list'); return scoped.list() },
        keys: (prefix?: string) => { requirePermission(permissions, 'storage:read', 'storage.keys'); return scoped.keys(prefix) },
        clear: () => { requirePermission(permissions, 'storage:write', 'storage.clear'); return scoped.clear() },
        getDataDir: () => { requirePermission(permissions, 'storage:read', 'storage.getDataDir'); return scoped.getDataDir() },
        forSession: (nestedId: string) => storage.forSession(`${sessionId}:${nestedId}`),
      }
    },
  }

  const ctx: PluginContext & { cleanup(): void } = {
    pluginName,
    pluginConfig,
    log,
    storage,

    on(event: string, handler: (...args: unknown[]) => void): void {
      requirePermission(permissions, 'events:read', 'on()')
      eventBus.on(event, handler)
      registeredListeners.push({ event, handler })
    },

    off(event: string, handler: (...args: unknown[]) => void): void {
      requirePermission(permissions, 'events:read', 'off()')
      eventBus.off(event, handler)
      const idx = registeredListeners.findIndex((l) => l.event === event && l.handler === handler)
      if (idx >= 0) registeredListeners.splice(idx, 1)
    },

    emit(event: string, payload: unknown): void {
      requirePermission(permissions, 'events:emit', 'emit()')
      eventBus.emit(event, payload)
    },

    registerMiddleware<H extends MiddlewareHook>(hook: H, middlewareOpts: MiddlewareOptions<MiddlewarePayloadMap[H]>): void {
      requirePermission(permissions, 'middleware:register', 'registerMiddleware()')
      middlewareChain.add(hook, pluginName, middlewareOpts as { priority?: number; handler: Function })
    },

    registerService<T>(name: string, implementation: T): void {
      requirePermission(permissions, 'services:register', 'registerService()')
      serviceRegistry.register(name, implementation, pluginName)
    },

    getService<T>(name: string): T | undefined {
      requirePermission(permissions, 'services:use', 'getService()')
      return serviceRegistry.get<T>(name)
    },

    registerCommand(def: CommandDef): void {
      requirePermission(permissions, 'commands:register', 'registerCommand()')
      registeredCommands.push(def)
      const registry = serviceRegistry.get<{ register(def: CommandDef, pluginName: string): void }>('command-registry')
      if (registry && typeof registry.register === 'function') {
        registry.register(def, pluginName)
        log.debug(`Command '/${def.name}' registered`)
      }
    },

    async sendMessage(_sessionId: string, _content: OutgoingMessage): Promise<void> {
      requirePermission(permissions, 'services:use', 'sendMessage()')
      // Delegate to message routing service
      const router = serviceRegistry.get<{ send(sessionId: string, content: OutgoingMessage): Promise<void> }>('message-router')
      if (router) {
        await router.send(_sessionId, _content)
      }
    },

    notify(
      target: { identityId: string } | { userId: string } | { channelId: string; platformId: string },
      message: { type: 'text'; text: string },
      options?: any,
    ): void {
      requirePermission(permissions, 'notifications:send', 'notify()')
      const svc = serviceRegistry.get<{ notifyUser(t: any, m: any, o: any): Promise<void> }>('notifications')
      if (svc?.notifyUser) {
        // Fire-and-forget — don't await, swallow errors
        svc.notifyUser(target, message, options).catch(() => {})
      }
    },

    defineHook(_name: string): void {
      // MiddlewareChain creates hook entries lazily on first add(), so no pre-registration is needed.
      // This method exists to let plugins declare intent — documentation/discoverability only.
    },

    async emitHook<T extends Record<string, unknown>>(name: string, payload: T): Promise<T | null> {
      // Auto-prefix prevents hook name collisions between plugins.
      const qualifiedName = `plugin:${pluginName}:${name}`
      // Pass identity as core handler — plugin hooks have no core behavior, only middleware side effects.
      return middlewareChain.execute(qualifiedName, payload, (p) => p) as Promise<T | null>
    },

    async getSessionInfo(sessionId: string) {
      requirePermission(permissions, 'sessions:read', 'getSessionInfo()')
      const sessionMgr = serviceRegistry.get<{
        getSessionInfo(id: string): Promise<{
          id: string
          status: import('../types.js').SessionStatus
          name?: string
          promptCount: number
          channelId: string
          agentName: string
        } | undefined>
      }>('session-info')
      if (!sessionMgr) return undefined
      return sessionMgr.getSessionInfo(sessionId)
    },

    registerMenuItem(item: MenuItem): void {
      requirePermission(permissions, 'commands:register', 'registerMenuItem()')
      const menuRegistry = serviceRegistry.get('menu-registry') as MenuRegistry | undefined
      if (!menuRegistry) return
      // Namespace menu item IDs with plugin name to prevent collisions
      const qualifiedId = `${pluginName}:${item.id}`
      menuRegistry.register({ ...item, id: qualifiedId })
      registeredMenuItemIds.push(qualifiedId)
    },

    unregisterMenuItem(id: string): void {
      requirePermission(permissions, 'commands:register', 'unregisterMenuItem()')
      const menuRegistry = serviceRegistry.get('menu-registry') as MenuRegistry | undefined
      if (!menuRegistry) return
      menuRegistry.unregister(`${pluginName}:${id}`)
    },

    registerAssistantSection(section: AssistantSection): void {
      requirePermission(permissions, 'commands:register', 'registerAssistantSection()')
      const assistantRegistry = serviceRegistry.get('assistant-registry') as AssistantRegistry | undefined
      if (!assistantRegistry) return
      // Namespace section IDs with plugin name to prevent collisions
      const qualifiedId = `${pluginName}:${section.id}`
      assistantRegistry.register({ ...section, id: qualifiedId })
      registeredAssistantSectionIds.push(qualifiedId)
    },

    unregisterAssistantSection(id: string): void {
      requirePermission(permissions, 'commands:register', 'unregisterAssistantSection()')
      const assistantRegistry = serviceRegistry.get('assistant-registry') as AssistantRegistry | undefined
      if (!assistantRegistry) return
      assistantRegistry.unregister(`${pluginName}:${id}`)
    },

    registerEditableFields(fields: import('./types.js').FieldDef[]): void {
      requirePermission(permissions, 'commands:register', 'registerEditableFields()')
      const registry = serviceRegistry.get<{ register(pluginName: string, fields: import('./types.js').FieldDef[]): void }>('field-registry')
      if (registry && typeof registry.register === 'function') {
        registry.register(pluginName, fields)
        log.debug(`Registered ${fields.length} editable field(s) for ${pluginName}`)
      }
    },

    get sessions() {
      requirePermission(permissions, 'kernel:access', 'sessions')
      return sessions as any
    },

    get config() {
      requirePermission(permissions, 'kernel:access', 'config')
      return config as any
    },

    get eventBus() {
      requirePermission(permissions, 'kernel:access', 'eventBus')
      return eventBus as any
    },

    get core() {
      requirePermission(permissions, 'kernel:access', 'core')
      return core
    },

    instanceRoot,

    /**
     * Called by LifecycleManager during plugin teardown.
     * Unregisters all event handlers, middleware, commands, and services
     * registered by this plugin, preventing leaks across reloads.
     */
    cleanup(): void {
      // Remove all event listeners registered by this plugin
      for (const { event, handler } of registeredListeners) {
        eventBus.off(event, handler)
      }
      registeredListeners.length = 0

      // Remove all middleware registered by this plugin
      middlewareChain.removeAll(pluginName)

      // Unregister services owned by this plugin
      serviceRegistry.unregisterByPlugin(pluginName)

      // Unregister commands from CommandRegistry
      const cmdRegistry = serviceRegistry.get<{ unregisterByPlugin(name: string): void }>('command-registry')
      if (cmdRegistry && typeof cmdRegistry.unregisterByPlugin === 'function') {
        cmdRegistry.unregisterByPlugin(pluginName)
      }

      // Unregister menu items
      const menuRegistry = serviceRegistry.get('menu-registry') as MenuRegistry | undefined
      if (menuRegistry) {
        for (const id of registeredMenuItemIds) {
          menuRegistry.unregister(id)
        }
      }
      registeredMenuItemIds.length = 0

      // Unregister assistant sections
      const assistantRegistry = serviceRegistry.get('assistant-registry') as AssistantRegistry | undefined
      if (assistantRegistry) {
        for (const id of registeredAssistantSectionIds) {
          assistantRegistry.unregister(id)
        }
      }
      registeredAssistantSectionIds.length = 0

      // Clear commands
      registeredCommands.length = 0
    },
  }

  return ctx
}
