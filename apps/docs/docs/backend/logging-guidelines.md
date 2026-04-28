---
sidebar_position: 5
---

# Logging Guidelines

> Logging conventions for the Viben project

---

## Overview

Viben uses structured logging with JSON format output, facilitating log analysis and monitoring.

---

## Logging Libraries

### TypeScript (packages/core)

Use **Pino** for logging:

```typescript
import { createLogger, createDualLogger } from "@viben/core/telemetry";

// Create logger
const logger = process.env.NODE_ENV === "production"
  ? createLogger(config)
  : createDualLogger(config);  // Output to both file and console
```

### Python (browse-mcp)

Use **loguru** for logging:

```python
from loguru import logger

logger.info("Starting search")
logger.error(f"Search failed: {error}")
```

---

## Log Levels

| Level | TypeScript | Python | Purpose |
|-------|------------|--------|---------|
| trace | `logger.trace()` | `logger.trace()` | Very detailed debug information |
| debug | `logger.debug()` | `logger.debug()` | Debug information (development) |
| info | `logger.info()` | `logger.info()` | General information (production default) |
| warn | `logger.warn()` | `logger.warning()` | Warning messages |
| error | `logger.error()` | `logger.error()` | Error messages |
| fatal | `logger.fatal()` | `logger.critical()` | Fatal errors |

### Level Selection Guide

| Scenario | Recommended Level |
|----------|-------------------|
| Request start/end | info |
| External API calls | debug |
| Parameter validation failure | warn |
| Exception caught | error |
| System crash | fatal |

---

## Structured Logging

### Module-Level Child Logger Pattern

Every module should create a child logger at the top level for consistent context:

```typescript
import { logger as globalLogger } from "../telemetry";

// Create module-level child logger
const log = globalLogger.child({ module: "my-module-name" });

// Use throughout the module
log.info({ userId: "123" }, "Processing request");
log.error({ err: error, context: { userId: "123" } }, "Failed to process");
```

### Basic Format

```typescript
// Structured logging (recommended)
logger.info({
  userId: user.id,
  action: 'createAgent',
  agentId: agent.id,
}, 'Agent created successfully');

// Simple message
logger.info('Server started');
```

### Required Fields

| Field | Description |
|-------|-------------|
| message | Log message |
| timestamp | Timestamp (auto-added) |
| level | Log level (auto-added) |

### Recommended Fields

| Field | Description |
|-------|-------------|
| userId | User ID |
| sessionId | Session ID |
| traceId | Trace ID |
| action | Operation name |
| duration | Operation duration |

---

## What to Log

### Request/Response

```typescript
// Request start
logger.info({
  method: 'POST',
  path: '/api/agent',
  body: requestBody,
}, 'API request received');

// Request completed
logger.info({
  method: 'POST',
  path: '/api/agent',
  status: 200,
  duration: '150ms',
}, 'API request completed');
```

### Business Operations

```typescript
// Important business operations
logger.info({
  userId: user.id,
  agentId: agent.id,
  action: 'spawn',
}, 'Agent spawned');

// Status changes
logger.info({
  taskId: task.id,
  oldStatus: 'pending',
  newStatus: 'running',
}, 'Task status changed');
```

### Errors and Exceptions

```typescript
// Error logging
logger.error({
  error: error.message,
  stack: error.stack,
  userId: user.id,
  action: 'createAgent',
}, 'Failed to create agent');
```

---

## What Not to Log

### Sensitive Data

| Do Not Log | Reason |
|------------|--------|
| Passwords | Security risk |
| API keys | Security risk |
| Tokens | Security risk |
| Personally Identifiable Information (PII) | Privacy compliance |

### Automatic Redaction

The telemetry logger automatically redacts sensitive fields:

- `password`, `secret`, `token`, `apiKey`, `api_key`
- `authorization`, `cookie`
- Fields matching patterns like `*token`, `*secret`, `*key`

### Example

```typescript
// Wrong - logging sensitive information
logger.info({
  user: {
    email: 'user@example.com',
    password: 'secret123',  // Never log
    apiKey: 'sk-xxx',       // Never log
  },
}, 'User login');

// Correct - sanitized data
logger.info({
  userId: user.id,
  email: maskEmail(user.email),  // Sanitized
  action: 'login',
}, 'User login');
```

### Safe Logging Examples

```typescript
// Safe - log ID references, not sensitive data
log.info({ userId: user.id }, "User authenticated");

// Unsafe - don't log tokens
log.debug({ token: authToken }); // Don't do this!

// Safe alternative
log.debug({ tokenPrefix: authToken.slice(0, 8) + "..." }, "Token issued");
```

---

## Log Storage

### File Storage Structure

```
~/.viben/telemetry/logs/
└── YYYY-MM-DD.jsonl     # Aggregated by date
```

### Log Format (JSONL)

```json
{"level":"info","time":1705312200000,"msg":"Server started","pid":12345}
{"level":"info","time":1705312201000,"msg":"Request received","method":"POST","path":"/api/agent"}
```

---

## Log Configuration

### Pino Configuration

```typescript
const config = {
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
};
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| LOG_LEVEL | Log level | info |
| LOG_FORMAT | Log format | json |

---

## Debugging Tips

### Enable Debug Logging

```bash
# Development environment
LOG_LEVEL=debug pnpm dev

# View specific module
DEBUG=viben:* pnpm dev
```

### View Log Files

```bash
# View latest logs
tail -f ~/.viben/telemetry/logs/$(date +%Y-%m-%d).jsonl

# Format with jq
tail -f ~/.viben/telemetry/logs/*.jsonl | jq .
```

---

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

---

## Migration Checklist

When migrating a file from `console.log` to the telemetry logger:

1. Add import: `import { logger as globalLogger } from "../telemetry";`
2. Create child logger: `const log = globalLogger.child({ module: "module-name" });`
3. Replace each `console` call:
   - `console.log("message")` -> `log.info("message")`
   - `` console.log(`value: ${x}`) `` -> `log.info({ x }, "value")`
   - `console.error("error:", err)` -> `log.error({ err }, "error")`
4. Verify with `pnpm typecheck` and `pnpm build`

---

## Forbidden Patterns

### Using console.log

```typescript
// Wrong
console.log('User created:', user);

// Correct
logger.info({ userId: user.id }, 'User created');
```

### Using print (Python)

```python
# Wrong
print(f"Search result: {result}")

# Correct
logger.info(f"Search completed: {len(result)} results")
```

---

## Related Documentation

- [Error Handling](./error-handling.md)
