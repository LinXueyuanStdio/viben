import fs from 'node:fs'
import path from 'node:path'
import type { PluginStorage } from './types.js'

/**
 * File-backed key-value store for a single plugin.
 *
 * Data is stored at `~/.viben/plugins/<name>/kv.json`. Each plugin gets its
 * own instance, providing namespace isolation.
 *
 * Write operations are serialized through a promise chain (`writeChain`) to
 * prevent concurrent writes from corrupting the JSON file.
 */
export class PluginStorageImpl implements PluginStorage {
  private readonly kvPath: string
  private readonly dataDir: string
  /** Serializes writes to prevent concurrent file corruption */
  private writeChain: Promise<void> = Promise.resolve()

  constructor(baseDir: string) {
    this.dataDir = path.join(baseDir, 'data')
    this.kvPath = path.join(baseDir, 'kv.json')
    fs.mkdirSync(baseDir, { recursive: true })
  }

  private readKv(): Record<string, unknown> {
    try {
      const raw = fs.readFileSync(this.kvPath, 'utf-8')
      return JSON.parse(raw) as Record<string, unknown>
    } catch {
      return {}
    }
  }

  private writeKv(data: Record<string, unknown>): void {
    fs.writeFileSync(this.kvPath, JSON.stringify(data), 'utf-8')
  }

  async get<T>(key: string): Promise<T | undefined> {
    const data = this.readKv()
    return key in data ? (data[key] as T) : undefined
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.writeChain = this.writeChain.then(() => {
      const data = this.readKv()
      data[key] = value
      this.writeKv(data)
    })
    return this.writeChain
  }

  async delete(key: string): Promise<void> {
    this.writeChain = this.writeChain.then(() => {
      const data = this.readKv()
      delete data[key]
      this.writeKv(data)
    })
    return this.writeChain
  }

  async list(): Promise<string[]> {
    return Object.keys(this.readKv())
  }

  async keys(prefix?: string): Promise<string[]> {
    const all = Object.keys(this.readKv())
    return prefix ? all.filter((k) => k.startsWith(prefix)) : all
  }

  async clear(): Promise<void> {
    this.writeChain = this.writeChain.then(() => {
      this.writeKv({})
    })
    return this.writeChain
  }

  /** Returns the plugin's data directory, creating it lazily on first access. */
  getDataDir(): string {
    fs.mkdirSync(this.dataDir, { recursive: true })
    return this.dataDir
  }

  /**
   * Creates a namespaced storage instance scoped to a session.
   * Keys are prefixed with `session:{sessionId}:` to isolate session data
   * from global plugin storage in the same backing file.
   */
  forSession(sessionId: string): PluginStorage {
    const prefix = `session:${sessionId}:`
    // Proxy that transparently prepends the session prefix to all key operations
    return {
      get: <T>(key: string) => this.get<T>(`${prefix}${key}`),
      set: <T>(key: string, value: T) => this.set(`${prefix}${key}`, value),
      delete: (key: string) => this.delete(`${prefix}${key}`),
      list: async () => {
        const all = await this.keys(prefix)
        return all.map((k) => k.slice(prefix.length))
      },
      keys: async (p?: string) => {
        const full = p ? `${prefix}${p}` : prefix
        const all = await this.keys(full)
        return all.map((k) => k.slice(prefix.length))
      },
      clear: async () => {
        this.writeChain = this.writeChain.then(() => {
          const data = this.readKv()
          for (const key of Object.keys(data)) {
            if (key.startsWith(prefix)) delete data[key]
          }
          this.writeKv(data)
        })
        return this.writeChain
      },
      getDataDir: () => this.getDataDir(),
      forSession: (nestedId: string) => this.forSession(`${sessionId}:${nestedId}`),
    }
  }
}
