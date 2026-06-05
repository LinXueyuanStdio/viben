/**
 * All built-in plugins: services, infrastructure, and adapters.
 * Booted by LifecycleManager in dependency order.
 * Adapter plugins depend on service plugins, so they boot last.
 */
import securityPlugin from './security/index.js'
import identityPlugin from './identity/index.js'
import fileServicePlugin from './file-service/index.js'
import contextPlugin from './context/index.js'
import speechPlugin from './speech/index.js'
import notificationsPlugin from './notifications/index.js'
import tunnelPlugin from './tunnel/index.js'
import apiServerPlugin from './api-server/index.js'
import sseAdapterPlugin from './sse-adapter/index.js'
import telegramPlugin from './telegram/index.js'

/**
 * Ordered list of all bundled plugins, passed to `LifecycleManager.boot()` on startup.
 *
 * Boot order matters: plugins listed earlier are set up first. Dependencies declared
 * via `pluginDependencies` / `optionalPluginDependencies` are enforced by the
 * lifecycle manager, but the order here also determines boot sequence within each
 * dependency tier:
 *
 * 1. **Service plugins** — security, file-service, context, speech, notifications.
 *    These provide services that infrastructure and adapter plugins depend on.
 * 2. **Infrastructure plugins** — tunnel (exposes the local server), api-server (HTTP + SSE).
 * 3. **Adapter plugins** — sse-adapter and telegram. Both depend on api-server, security, and
 *    notifications, so they must boot after those services are ready.
 */
export const corePlugins = [
  // Service plugins (no adapter dependencies)
  securityPlugin,
  fileServicePlugin,
  contextPlugin,
  speechPlugin,
  notificationsPlugin,
  // Infrastructure plugins
  tunnelPlugin,
  apiServerPlugin,
  // Identity boots after api-server so it can register REST routes via
  // apiServer.registerPlugin(). If booted before, ctx.getService('api-server')
  // returns null and the /identity/setup route is never registered.
  // Security is already up at this point, satisfying the priority-100 requirement.
  identityPlugin,
  // Adapter plugins (depend on security, notifications, etc.)
  sseAdapterPlugin,
  telegramPlugin,
]
