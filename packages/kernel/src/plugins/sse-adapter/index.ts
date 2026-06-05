import type { VibenPlugin } from '../../core/plugin/types.js';
import type { VibenCore } from '../../core/core.js';
import type { ApiServerService } from '../api-server/service.js';
import type { CommandRegistry } from '../../core/command-registry.js';
import { ConnectionManager } from './connection-manager.js';
import { EventBuffer } from './event-buffer.js';
import { SSEAdapter } from './adapter.js';
import { sseRoutes } from './routes.js';
import { BusEvent } from '../../core/events.js';

// Module-level references held for teardown — the plugin lifecycle doesn't
// pass instances between setup() and teardown(), so we store them here.
let _adapter: SSEAdapter | null = null;
let _connectionManager: ConnectionManager | null = null;

const plugin: VibenPlugin = {
  name: '@viben/sse-adapter',
  version: '1.0.0',
  description: 'SSE-based messaging adapter for app clients',
  pluginDependencies: {
    '@viben/api-server': '^1.0.0',
    '@viben/security': '^1.0.0',
    '@viben/notifications': '^1.0.0',
  },
  permissions: ['services:register', 'services:use', 'kernel:access', 'events:read'],

  async setup(ctx) {
    const core = ctx.core as VibenCore;
    const apiServer = ctx.getService<ApiServerService>('api-server');

    if (!apiServer) {
      ctx.log.warn('API server not available, SSE adapter disabled');
      return;
    }

    const connectionManager = new ConnectionManager({ maxPerSession: 10, maxTotal: 100 });
    const eventBuffer = new EventBuffer(100);
    const adapter = new SSEAdapter(connectionManager, eventBuffer);

    _adapter = adapter;
    _connectionManager = connectionManager;

    // Register adapter as a service so main.ts wires it into core
    ctx.registerService('adapter:sse', adapter);

    // Get command registry for command execution in routes
    const commandRegistry = ctx.getService<CommandRegistry>('command-registry');

    // Clean up event buffer when a session ends or is deleted to prevent unbounded memory growth
    ctx.on(BusEvent.SESSION_DELETED, (data: unknown) => {
      const { sessionId } = data as { sessionId: string };
      eventBuffer.cleanup(sessionId);
    });
    ctx.on(BusEvent.SESSION_ENDED, (data: unknown) => {
      const { sessionId } = data as { sessionId: string };
      eventBuffer.cleanup(sessionId);
    });

    // Register SSE routes on the api-server
    apiServer.registerPlugin('/api/v1/sse', async (app) => {
      await sseRoutes(app, {
        core,
        connectionManager,
        eventBuffer,
        commandRegistry: commandRegistry ?? undefined,
      });
    }, { auth: true });

    ctx.log.info('SSE adapter registered');
  },

  async teardown() {
    if (_adapter) {
      await _adapter.stop();
      _adapter = null;
    }
    if (_connectionManager) {
      _connectionManager.cleanup();
      _connectionManager = null;
    }
  },
};

export default plugin;
