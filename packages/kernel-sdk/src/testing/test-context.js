/**
 * Creates a test-friendly PluginContext for unit-testing plugins.
 * All state is in-memory, logger is silent, services are pre-populated.
 */
export function createTestContext(opts) {
    const storageData = new Map();
    const eventHandlers = new Map();
    const registeredServices = new Map();
    const registeredCommands = new Map();
    const registeredMiddleware = [];
    const emittedEvents = [];
    const sentMessages = [];
    // Pre-populate services from opts
    if (opts.services) {
        for (const [name, impl] of Object.entries(opts.services)) {
            registeredServices.set(name, impl);
        }
    }
    const storage = {
        async get(key) {
            return storageData.get(key);
        },
        async set(key, value) {
            storageData.set(key, value);
        },
        async delete(key) {
            storageData.delete(key);
        },
        async list() {
            return Array.from(storageData.keys());
        },
        getDataDir() {
            return '/tmp/viben-test-data';
        },
    };
    const silentLog = {
        trace() { },
        debug() { },
        info() { },
        warn() { },
        error() { },
        fatal() { },
        child() { return silentLog; },
    };
    const ctx = {
        pluginName: opts.pluginName,
        pluginConfig: opts.pluginConfig ?? {},
        // Events
        on(event, handler) {
            if (!eventHandlers.has(event)) {
                eventHandlers.set(event, new Set());
            }
            eventHandlers.get(event).add(handler);
        },
        off(event, handler) {
            eventHandlers.get(event)?.delete(handler);
        },
        emit(event, payload) {
            emittedEvents.push({ event, payload });
            const handlers = eventHandlers.get(event);
            if (handlers) {
                for (const handler of handlers) {
                    handler(payload);
                }
            }
        },
        // Actions
        registerMiddleware(hook, opts) {
            registeredMiddleware.push({ hook, opts });
        },
        registerService(name, implementation) {
            registeredServices.set(name, implementation);
        },
        getService(name) {
            return registeredServices.get(name);
        },
        registerCommand(def) {
            registeredCommands.set(def.name, def);
        },
        storage,
        log: silentLog,
        async sendMessage(sessionId, content) {
            sentMessages.push({ sessionId, content });
        },
        // Kernel access stubs
        sessions: {},
        config: {},
        eventBus: {},
        core: {},
        // Test-specific
        registeredServices,
        registeredCommands,
        registeredMiddleware,
        emittedEvents,
        sentMessages,
        async executeCommand(name, args) {
            const cmd = registeredCommands.get(name);
            if (!cmd) {
                throw new Error(`Command not found: ${name}`);
            }
            const defaultArgs = {
                raw: '',
                sessionId: null,
                channelId: 'test',
                userId: 'test-user',
                async reply() { },
                ...args,
            };
            return cmd.handler(defaultArgs);
        },
    };
    return ctx;
}
//# sourceMappingURL=test-context.js.map