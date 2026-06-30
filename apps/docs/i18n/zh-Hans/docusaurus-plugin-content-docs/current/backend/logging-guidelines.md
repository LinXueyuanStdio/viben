---
sidebar_position: 5
---

# Logging Guidelines

> How logging is done in this project.

## Overview

This project uses a unified logging system based on **Pino** with OpenTelemetry integration.

The logging infrastructure is located in `packages/core/src/telemetry/`:
- `logger.ts` - Logger interface and Pino implementation
- `global-logger.ts` - Global logger singleton with lazy binding

### Key Principles

1. **Use the telemetry logger for all debug/service logs** - Never use `console.log` for internal debugging
2. **Use structured logging** - Pass context as object, message as string
3. **Use module-level child loggers** - Create a child logger at module scope for consistent context

### Two Types of Console Output

| Type | When to Use | Implementation |
|------|-------------|----------------|
| **CLI User Output** | Direct user-facing messages in CLI commands | `packages/core/src/cli/lib/output.ts` functions (`output()`, `outputTable()`, `outputSuccess()`) |
| **Debug/Service Logs** | Internal state, errors, debugging | Telemetry logger (`log.info()`, `log.error()`, etc.) |

## Log Levels

| Level | Usage | Example |
|-------|-------|---------|
| `trace` | Very detailed diagnostic information | Internal state dumps, loop iterations |
| `debug` | Diagnostic information useful for debugging | Function entry/exit, intermediate values |
| `info` | General operational information | Server started, request completed, connection established |
| `warn` | Potentially problematic situations | Deprecated API usage, retry attempts, missing optional config |
| `error` | Error events that might still allow operation | Failed requests, caught exceptions, validation failures |
| `fatal` | Severe errors causing process termination | Unrecoverable errors, startup failures |

### Mapping from console

| Before | After |
|--------|-------|
| `console.log()` | `log.info()` or `log.debug()` |
| `console.warn()` | `log.warn()` |
| `console.error()` | `log.error()` |

## Structured Logging

### Module-Level Child Logger Pattern

Every module should create a child logger at the top level:

```typescript
import { logger as globalLogger } from "../telemetry";

// Create module-level child logger
const log = globalLogger.child({ module: "my-module-name" });

// Use throughout the module
log.info({ userId: "123" }, "Processing request");
log.error({ err: error, context: { userId: "123" } }, "Failed to process");
```

### Structured Log Format

Always pass context as the first parameter (object), message as the second (string):

```typescript
// Correct - structured logging
log.info({ userId, action: "login" }, "User authenticated");
log.error({ err: error, requestId }, "Request failed");

// Incorrect - avoid string interpolation
log.info(`User ${userId} authenticated`);  // Don't do this
```

### Error Logging Pattern

Always use `err` as the key for error objects (Pino convention):

```typescript
try {
  await doSomething();
} catch (error) {
  log.error({ err: error, context: { userId } }, "Operation failed");
}
```

## What to Log

### Always Log

- Service startup/shutdown
- Connection established/lost (database, WebSocket, external services)
- Authentication events (success/failure)
- Significant state changes
- Request completion with timing
- Error conditions with context

### Example Patterns

```typescript
// Service lifecycle
log.info({ port: 3000 }, "Server started");
log.info("Server stopping...");

// Connections
log.info({ channelName: "telegram" }, "Connected to channel");
log.warn({ channelName: "discord", retryIn: 5000 }, "Connection lost, reconnecting...");

// Operations
log.info({ taskId, duration: 1234 }, "Task completed");
log.debug({ messageId, from: senderId }, "Message received");

// Errors
log.error({ err: error, taskId }, "Task execution failed");
```

## What NOT to Log

### Never Log

- **Passwords and authentication tokens** (API keys, JWT tokens, session secrets)
- **Personal Identifiable Information (PII)** in production (email addresses, phone numbers, full names)
- **Credit card or financial data**
- **Full request/response bodies** containing sensitive data
- **Environment variables** that may contain secrets

### Automatic PII Redaction

The telemetry logger automatically redacts sensitive fields:

- `password`, `secret`, `token`, `apiKey`, `api_key`
- `authorization`, `cookie`
- Fields matching patterns like `*token`, `*secret`, `*key`

### Safe Logging Examples

```typescript
// Safe - log ID references, not sensitive data
log.info({ userId: user.id }, "User authenticated");

// Unsafe - don't log tokens
log.debug({ token: authToken }); // Don't do this!

// Safe alternative
log.debug({ tokenPrefix: authToken.slice(0, 8) + "..." }, "Token issued");
```

## Best Practices

### 1. Consistent Module Naming

Use kebab-case for module names matching the file name:

```typescript
// In telegram-poller.ts
const log = globalLogger.child({ module: "telegram-poller" });

// In preview.ts
const log = globalLogger.child({ module: "preview" });
```

### 2. Avoid Over-Logging

- Use `debug` level for verbose output that's only useful during development
- Use `info` level sparingly - only for significant events
- Never log in tight loops without throttling

### 3. Include Actionable Context

Log enough context to debug issues without looking at source code:

```typescript
// Good - includes context for debugging
log.error({
  err: error,
  taskId,
  attempt: retryCount,
  maxAttempts: 3
}, "Task execution failed");

// Poor - missing context
log.error("Task failed");
```

### 4. Use Appropriate Levels for Different Environments

- Development: `debug` level
- Production: `info` level (or `warn` for high-volume services)

The log level is configured via the `LOG_LEVEL` environment variable.

## Log Storage

```
~/.viben/telemetry/logs/
└── YYYY-MM-DD.jsonl     # Aggregated by date
```

## Migration Checklist

When migrating a file from `console.log` to the telemetry logger:

1. Add import: `import { logger as globalLogger } from "../telemetry";`
2. Create child logger: `const log = globalLogger.child({ module: "module-name" });`
3. Replace each `console` call:
   - `console.log("message")` -> `log.info("message")`
   - `` console.log(`value: ${x}`) `` -> `log.info({ x }, "value")`
   - `console.error("error:", err)` -> `log.error({ err }, "error")`
4. Verify with `pnpm typecheck` and `pnpm build`

## Forbidden Patterns

### Using console.log

```typescript
// Wrong
console.log('User created:', user);

// Correct
logger.info({ userId: user.id }, 'User created');
```

## Related Documentation

- [Error Handling](./error-handling.md)
- [Telemetry Guidelines](./telemetry-guidelines.md)
