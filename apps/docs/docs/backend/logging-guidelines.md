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
