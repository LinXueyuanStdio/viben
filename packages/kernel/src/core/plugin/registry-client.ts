/** URL of the public Viben plugin registry (hosted on GitHub). */
const REGISTRY_URL = 'https://raw.githubusercontent.com/Viben/plugin-registry/main/registry.json'
/** Registry data is cached for 1 minute to reduce network requests during repeated lookups. */
const CACHE_TTL = 60 * 1000

/** Metadata for a plugin listed in the public Viben plugin registry. */
export interface RegistryPlugin {
  name: string
  displayName?: string
  description: string
  npm: string
  version: string
  minCliVersion: string
  category: string
  tags: string[]
  icon: string
  author: string
  repository: string
  license: string
  verified: boolean
  featured: boolean
}

/** The full registry manifest, fetched as a single JSON file. */
export interface Registry {
  version: number
  generatedAt: string
  pluginCount: number
  plugins: RegistryPlugin[]
  categories: Array<{ id: string; name: string; icon: string }>
}

/**
 * Client for the public Viben plugin registry.
 *
 * The registry is a static JSON file on GitHub — no API server needed.
 * Results are cached in memory for 1 minute to avoid redundant fetches
 * during CLI operations like search + install.
 */
export class RegistryClient {
  private cache: { data: Registry; fetchedAt: number } | null = null
  private registryUrl: string

  constructor(registryUrl?: string) {
    this.registryUrl = registryUrl ?? REGISTRY_URL
  }

  /** Fetch the registry, returning cached data if still fresh. */
  async getRegistry(): Promise<Registry> {
    if (this.cache && Date.now() - this.cache.fetchedAt < CACHE_TTL) {
      return this.cache.data
    }
    const res = await fetch(this.registryUrl)
    if (!res.ok) throw new Error(`Failed to fetch registry: ${res.status}`)
    const data = await res.json() as Registry
    this.cache = { data, fetchedAt: Date.now() }
    return data
  }

  /** Search plugins by name, description, or tags (case-insensitive substring match). */
  async search(query: string): Promise<RegistryPlugin[]> {
    const registry = await this.getRegistry()
    const q = query.toLowerCase()
    return registry.plugins.filter(p => {
      const text = `${p.name} ${p.displayName ?? ''} ${p.description} ${p.tags?.join(' ') ?? ''}`.toLowerCase()
      return text.includes(q)
    })
  }

  /** Resolve a registry plugin name to its npm package name. Returns null if not found. */
  async resolve(name: string): Promise<string | null> {
    const registry = await this.getRegistry()
    const plugin = registry.plugins.find(p => p.name === name)
    return plugin?.npm ?? null
  }

  /** Force next getRegistry() call to refetch from network. */
  clearCache(): void {
    this.cache = null
  }
}
