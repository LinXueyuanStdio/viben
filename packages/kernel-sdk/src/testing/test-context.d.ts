import type { PluginContext, CommandDef, CommandResponse, OutgoingMessage, CommandArgs } from '@viben/kernel';
export interface TestContextOpts {
    pluginName: string;
    pluginConfig?: Record<string, unknown>;
    permissions?: string[];
    services?: Record<string, unknown>;
}
export interface TestPluginContext extends PluginContext {
    /** Services registered via registerService() */
    registeredServices: Map<string, unknown>;
    /** Commands registered via registerCommand() */
    registeredCommands: Map<string, CommandDef>;
    /** Middleware registered via registerMiddleware() */
    registeredMiddleware: Array<{
        hook: string;
        opts: unknown;
    }>;
    /** Events emitted via emit() */
    emittedEvents: Array<{
        event: string;
        payload: unknown;
    }>;
    /** Messages sent via sendMessage() */
    sentMessages: Array<{
        sessionId: string;
        content: OutgoingMessage;
    }>;
    /** Dispatch a registered command by name */
    executeCommand(name: string, args?: Partial<CommandArgs>): Promise<CommandResponse | void>;
}
/**
 * Creates a test-friendly PluginContext for unit-testing plugins.
 * All state is in-memory, logger is silent, services are pre-populated.
 */
export declare function createTestContext(opts: TestContextOpts): TestPluginContext;
//# sourceMappingURL=test-context.d.ts.map
