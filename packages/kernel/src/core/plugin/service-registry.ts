/**
 * Central service discovery for the plugin system.
 *
 * Plugins register service implementations by string key (e.g., 'security', 'speech').
 * Core and other plugins retrieve them via typed accessors:
 *   `registry.get<SecurityService>('security')`
 *
 * Each service key is unique — registering a duplicate throws unless `registerOverride` is used.
 * Services are tracked by the owning plugin name so they can be bulk-removed on plugin unload.
 */
export class ServiceRegistry {
  private services = new Map<string, { implementation: unknown; pluginName: string }>()

  /**
   * Register a service. Throws if the service name is already taken.
   * Use `registerOverride` to intentionally replace an existing service.
   */
  register<T>(name: string, implementation: T, pluginName: string): void {
    if (this.services.has(name)) {
      const existing = this.services.get(name)!
      throw new Error(`Service '${name}' already registered by ${existing.pluginName}. Plugin ${pluginName} cannot register it without override.`)
    }
    this.services.set(name, { implementation, pluginName })
  }

  /** Register a service, replacing any existing registration (used by override plugins). */
  registerOverride<T>(name: string, implementation: T, pluginName: string): void {
    this.services.set(name, { implementation, pluginName })
  }

  /** Retrieve a service by name. Returns undefined if not registered. */
  get<T>(name: string): T | undefined {
    return this.services.get(name)?.implementation as T | undefined
  }

  /** Check whether a service is registered. */
  has(name: string): boolean {
    return this.services.has(name)
  }

  /** List all registered services with their owning plugin names. */
  list(): Array<{ name: string; pluginName: string }> {
    return [...this.services.entries()].map(([name, { pluginName }]) => ({ name, pluginName }))
  }

  /** Remove a single service by name. */
  unregister(name: string): void {
    this.services.delete(name)
  }

  /** Remove all services owned by a specific plugin (called during plugin unload). */
  unregisterByPlugin(pluginName: string): void {
    for (const [name, entry] of this.services) {
      if (entry.pluginName === pluginName) {
        this.services.delete(name)
      }
    }
  }
}
