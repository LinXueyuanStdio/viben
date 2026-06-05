import type { InstallContext, TerminalIO, SettingsAPI } from '@viben/kernel'

export interface TestInstallContextOpts {
  pluginName: string
  terminalResponses?: Record<string, unknown[]>
}

interface TerminalCall {
  method: string
  args: unknown
}

/**
 * Creates a test-friendly InstallContext for unit-testing plugin install/configure/uninstall.
 * Terminal prompts are auto-answered from the provided responses map.
 * Settings are stored in-memory.
 */
export function createTestInstallContext(opts: TestInstallContextOpts): InstallContext & {
  terminalCalls: TerminalCall[]
  settingsData: Map<string, unknown>
} {
  const settingsData = new Map<string, unknown>()
  const terminalCalls: TerminalCall[] = []
  const responseQueues = new Map<string, unknown[]>()

  // Deep-copy response queues so we don't mutate caller's arrays
  if (opts.terminalResponses) {
    for (const [method, responses] of Object.entries(opts.terminalResponses)) {
      responseQueues.set(method, [...responses])
    }
  }

  function getNextResponse(method: string, args: unknown): unknown {
    terminalCalls.push({ method, args })
    const queue = responseQueues.get(method)
    if (queue && queue.length > 0) {
      return queue.shift()
    }
    // Default responses by method type
    switch (method) {
      case 'text': return ''
      case 'password': return ''
      case 'confirm': return false
      case 'select': return undefined
      case 'multiselect': return []
      default: return undefined
    }
  }

  const terminal: TerminalIO = {
    async text(promptOpts: any) {
      return getNextResponse('text', promptOpts) as string
    },
    async select(promptOpts: any) {
      return getNextResponse('select', promptOpts) as any
    },
    async confirm(promptOpts: any) {
      return getNextResponse('confirm', promptOpts) as boolean
    },
    async password(promptOpts: any) {
      return getNextResponse('password', promptOpts) as string
    },
    async multiselect(promptOpts: any) {
      return getNextResponse('multiselect', promptOpts) as any[]
    },
    log: {
      info() {},
      success() {},
      warning() {},
      error() {},
      step() {},
    },
    spinner() {
      return {
        start() {},
        stop() {},
        fail() {},
      }
    },
    note() {},
    cancel() {},
  }

  const settings: SettingsAPI = {
    async get<T = unknown>(key: string): Promise<T | undefined> {
      return settingsData.get(key) as T | undefined
    },
    async set<T = unknown>(key: string, value: T): Promise<void> {
      settingsData.set(key, value)
    },
    async getAll(): Promise<Record<string, unknown>> {
      return Object.fromEntries(settingsData)
    },
    async setAll(allSettings: Record<string, unknown>): Promise<void> {
      settingsData.clear()
      for (const [k, v] of Object.entries(allSettings)) {
        settingsData.set(k, v)
      }
    },
    async delete(key: string): Promise<void> {
      settingsData.delete(key)
    },
    async clear(): Promise<void> {
      settingsData.clear()
    },
    async has(key: string): Promise<boolean> {
      return settingsData.has(key)
    },
  }

  const silentLog = {
    trace() {},
    debug() {},
    info() {},
    warn() {},
    error() {},
    fatal() {},
    child() { return silentLog },
  }

  return {
    pluginName: opts.pluginName,
    terminal,
    settings,
    dataDir: '/tmp/viben-test-data',
    log: silentLog,
    // Test-specific
    terminalCalls,
    settingsData,
  }
}
