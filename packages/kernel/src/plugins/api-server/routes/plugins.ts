import path from 'node:path'
import type { FastifyInstance } from 'fastify'
import type { RouteDeps } from './types.js'
import { requireScopes } from '../middleware/auth.js'
import { corePlugins } from '../../../plugins/core-plugins.js'
import { RegistryClient } from '../../../core/plugin/registry-client.js'

// Singleton so the 1-minute TTL cache is shared across requests to avoid
// hammering the remote registry on every marketplace page load.
const registryClient = new RegistryClient()

/**
 * Plugin management routes under `/api/v1/plugins`.
 *
 * All routes require `system:admin` scope.
 * - `GET /` — lists installed plugins with their runtime state (loaded, failed, essential).
 * - `GET /marketplace` — proxies the remote plugin registry, annotated with installed status.
 * - `POST /:name/enable` — hot-loads a disabled plugin without restarting the server.
 * - `POST /:name/disable` — gracefully unloads an active plugin; blocks essential plugins.
 * - `DELETE /:name` — uninstalls an npm/local plugin; builtin plugins cannot be removed.
 */
export async function pluginRoutes(
  app: FastifyInstance,
  deps: RouteDeps,
): Promise<void> {
  const { lifecycleManager } = deps
  const admin = [requireScopes('system:admin')]

  // GET /plugins — list all installed plugins with runtime state
  app.get('/', { preHandler: admin }, async () => {
    if (!lifecycleManager?.registry) return { plugins: [] }

    const registry = lifecycleManager.registry
    // Reload from disk so CLI-installed plugins appear without a server restart.
    // The polling flow in the App depends on this being up-to-date.
    await registry.load()
    const loadedSet = new Set(lifecycleManager.loadedPlugins)
    const failedSet = new Set(lifecycleManager.failedPlugins)
    const loadOrderMap = new Map(lifecycleManager.plugins.map((p) => [p.name, p]))
    const coreMap = new Map(corePlugins.map((p) => [p.name, p]))

    const plugins = Array.from(registry.list().entries()).map(([name, entry]) => {
      const def = loadOrderMap.get(name) ?? coreMap.get(name)
      return {
        name,
        version: entry.version,
        description: entry.description,
        source: entry.source,
        enabled: entry.enabled,
        loaded: loadedSet.has(name),
        failed: failedSet.has(name),
        essential: def?.essential ?? false,
        hasConfigure: typeof def?.configure === 'function',
      }
    })

    return { plugins }
  })

  // GET /plugins/marketplace — proxy to RegistryClient with installed flag
  app.get('/marketplace', { preHandler: admin }, async (_req, reply) => {
    try {
      const data = await registryClient.getRegistry()

      const installedNames = new Set(
        lifecycleManager?.registry
          ? Array.from(lifecycleManager.registry.list().keys())
          : [],
      )

      const plugins = data.plugins.map((p) => ({
        ...p,
        installed: installedNames.has(p.name) || installedNames.has(p.npm),
      }))

      return { plugins, categories: data.categories }
    } catch {
      return reply.status(503).send({ error: 'Marketplace unavailable' })
    }
  })

  // POST /plugins/:name/enable — hot-load a disabled plugin
  app.post('/:name/enable', { preHandler: admin }, async (req, reply) => {
    if (!lifecycleManager?.registry) {
      return reply.status(503).send({ error: 'Plugin manager unavailable' })
    }

    const name = (req.params as { name: string }).name
    const registry = lifecycleManager.registry
    const entry = registry.get(name)

    if (!entry) {
      return reply.status(404).send({ error: `Plugin "${name}" not found` })
    }

    // Idempotent — already loaded
    if (lifecycleManager.loadedPlugins.includes(name)) {
      registry.setEnabled(name, true)
      await registry.save()
      return { ok: true }
    }

    // Resolve plugin definition
    let pluginDef = lifecycleManager.plugins.find((p) => p.name === name)

    if (!pluginDef) {
      if (entry.source === 'builtin') {
        pluginDef = corePlugins.find((p) => p.name === name)
      } else {
        // npm / local — dynamic import
        const { importFromDir } = await import('../../../core/plugin/plugin-installer.js')
        const instanceRoot = lifecycleManager.instanceRoot!
        const pluginsDir = path.join(instanceRoot, 'plugins')
        try {
          const mod = await importFromDir(name, pluginsDir)
          pluginDef = mod.default ?? mod
        } catch {
          return reply
            .status(500)
            .send({ error: 'Plugin module could not be loaded. Try restarting the server.' })
        }
      }
    }

    if (!pluginDef) {
      return reply.status(500).send({ error: `Plugin definition not found for "${name}"` })
    }

    registry.setEnabled(name, true)
    await registry.save()

    await lifecycleManager.boot([pluginDef])

    if (lifecycleManager.failedPlugins.includes(name)) {
      return reply.status(500).send({ error: `Plugin "${name}" failed to start` })
    }

    return { ok: true }
  })

  // POST /plugins/:name/disable — unload and disable a plugin
  app.post('/:name/disable', { preHandler: admin }, async (req, reply) => {
    if (!lifecycleManager?.registry) {
      return reply.status(503).send({ error: 'Plugin manager unavailable' })
    }

    const name = (req.params as { name: string }).name
    const registry = lifecycleManager.registry
    const entry = registry.get(name)

    if (!entry) {
      return reply.status(404).send({ error: `Plugin "${name}" not found` })
    }

    // Check essential — look in loadOrder first, fall back to corePlugins
    const def =
      lifecycleManager.plugins.find((p) => p.name === name) ??
      corePlugins.find((p) => p.name === name)

    if (def?.essential) {
      return reply.status(409).send({ error: 'Essential plugins cannot be disabled' })
    }

    await lifecycleManager.unloadPlugin(name)
    registry.setEnabled(name, false)
    await registry.save()

    return { ok: true }
  })

  // DELETE /plugins/:name — uninstall (remove from registry, unload)
  app.delete('/:name', { preHandler: admin }, async (req, reply) => {
    if (!lifecycleManager?.registry) {
      return reply.status(503).send({ error: 'Plugin manager unavailable' })
    }

    const name = (req.params as { name: string }).name
    const registry = lifecycleManager.registry
    const entry = registry.get(name)

    if (!entry) {
      return reply.status(404).send({ error: `Plugin "${name}" not found` })
    }

    if (entry.source === 'builtin') {
      return reply
        .status(400)
        .send({ error: 'Builtin plugins cannot be uninstalled. Use disable instead.' })
    }

    await lifecycleManager.unloadPlugin(name)
    registry.remove(name)
    await registry.save()

    return { ok: true }
  })

}
