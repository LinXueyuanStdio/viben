// Public API surface for the `@viben/kernel` package.
//
// Most exports come from `core/index.ts` which provides the full set of
// core modules, plugin types, and adapter primitives for plugin authors.
// The exports below supplement that with top-level package-specific symbols.

export * from './core/index.js'

/** Full product guide text injected into the assistant's system prompt at runtime. */
export { PRODUCT_GUIDE } from './data/product-guide.js'

/**
 * Telegram adapter implementation.
 *
 * Re-exported here for consumers who need to reference the class directly
 * (e.g., in tests or custom adapter setups) without importing from the deep plugin path.
 */
export { TelegramAdapter } from './plugins/telegram/adapter.js'

/**
 * Manages the local catalog of installed agents (read/write to agents.json).
 *
 * Plugin authors building agent-aware features should use this to query
 * which agents are installed and their configurations.
 */
export { AgentCatalog } from "./core/agents/agent-catalog.js";

/**
 * Low-level persistent store for agent records.
 *
 * AgentCatalog is the preferred higher-level interface; AgentStore is
 * exported for advanced use cases that require direct record access.
 */
export { AgentStore } from "./core/agents/agent-store.js";

/** Agent-related types shared across the public API. */
export type { InstalledAgent, RegistryAgent, AgentListItem } from "./core/types.js";
