import type { preHandlerHookHandler } from 'fastify';
import type { VibenCore } from '../../../core/core.js';
import type { TopicManager } from '../../telegram/topic-manager.js';
import type { CommandRegistry } from '../../../core/command-registry.js';
import type { ContextManager } from '../../context/context-manager.js';
import type { LifecycleManager } from '../../../core/plugin/lifecycle-manager.js';

/**
 * Dependencies injected into Fastify route plugins.
 * Each route plugin receives these via its options parameter.
 */
export interface RouteDeps {
  core: VibenCore;
  topicManager?: TopicManager;
  startedAt: number;
  getVersion: () => string;
  /** Unique ID of this instance — included in health response for instance verification. */
  instanceId: string;
  commandRegistry?: CommandRegistry;
  /** Auth pre-handler for routes registered without global auth (e.g. system routes). */
  authPreHandler?: preHandlerHookHandler;
  /** Context manager for reading session conversation history. */
  contextManager?: ContextManager;
  /** LifecycleManager for plugin state queries and hot-load operations. */
  lifecycleManager?: LifecycleManager;
}
