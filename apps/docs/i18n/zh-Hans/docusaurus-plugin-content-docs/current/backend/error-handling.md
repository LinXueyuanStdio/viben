---
sidebar_position: 4
---

# Error Handling

> Error handling conventions for the Viben project

---

## Overview

Viben uses a unified error handling pattern to ensure API response consistency and user experience.

---

## Error Response Format

### Standard Error Response

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

| Field | Type | Description |
|-------|------|-------------|
| error | string | User-friendly error message |
| code | string | Error code (optional) |
| details | object | Additional error details (optional) |

### HTTP Status Codes

| Status Code | Purpose |
|-------------|---------|
| 400 | Bad request parameters |
| 401 | Unauthenticated |
| 403 | Forbidden |
| 404 | Resource not found |
| 409 | Resource conflict |
| 500 | Internal server error |

---

## Error Types

### Business Errors

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `NOT_FOUND` | 404 | Resource not found |
| `ALREADY_EXISTS` | 409 | Resource already exists |
| `INVALID_INPUT` | 400 | Invalid input parameters |
| `UNAUTHORIZED` | 401 | Unauthorized access |
| `FORBIDDEN` | 403 | Access forbidden |

### System Errors

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `INTERNAL_ERROR` | 500 | Internal server error |
| `DATABASE_ERROR` | 500 | Database error |
| `EXTERNAL_SERVICE_ERROR` | 502 | External service error |
| `TIMEOUT` | 504 | Request timeout |

---

## Error Handling Patterns

### TypeScript (Gateway API)

```typescript
import { Context } from 'hono';

// Unified error response
function errorResponse(c: Context, status: number, message: string, code?: string) {
  return c.json({
    error: message,
    code: code,
  }, status);
}

// Route example
app.get('/api/agent/:id', async (c) => {
  const { id } = c.req.param();

  try {
    const agent = await agentService.getAgent(id);

    if (!agent) {
      return errorResponse(c, 404, 'Agent not found', 'NOT_FOUND');
    }

    return c.json(agent);
  } catch (error) {
    console.error('Failed to get agent:', error);
    return errorResponse(c, 500, 'Internal server error', 'INTERNAL_ERROR');
  }
});
```

### Next.js API Routes

```typescript
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const data = await fetchData();
    return NextResponse.json(data);
  } catch (error) {
    console.error('API error:', error);

    if (error instanceof NotFoundError) {
      return NextResponse.json(
        { error: 'Resource not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Python (browse-mcp)

```python
from loguru import logger

class SearchError(Exception):
    """Base search error."""
    pass

class APIError(SearchError):
    """API request failed."""
    pass

class NotFoundError(SearchError):
    """Resource not found."""
    pass

def search(query: str):
    try:
        result = api.search(query)
        return result
    except APIError as e:
        logger.error(f"API error: {e}")
        return f"Error: {e}"
    except Exception as e:
        logger.exception(f"Unexpected error: {e}")
        raise
```

---

## Error Logging

### Log Levels

| Level | Purpose |
|-------|---------|
| `error` | Errors and exceptions |
| `warn` | Warning messages |
| `info` | General information |
| `debug` | Debug information |

### Log Content

```typescript
// Include context when logging errors
logger.error({
  error: error.message,
  stack: error.stack,
  userId: user.id,
  action: 'createAgent',
  input: requestBody,
}, 'Failed to create agent');
```

---

## Frontend Error Handling

### API Calls

```typescript
async function fetchAgent(id: string) {
  const response = await fetch(`/api/agent/${id}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Unknown error');
  }

  return response.json();
}
```

### User Notifications

```typescript
import { toast } from 'sonner';

try {
  await createAgent(data);
  toast.success('Agent created successfully');
} catch (error) {
  toast.error(error.message || 'Failed to create agent');
}
```

---

## Forbidden Patterns

### Don't Swallow Errors

```typescript
// Wrong
try {
  await riskyOperation();
} catch (error) {
  // Silently ignoring error
}

// Correct
try {
  await riskyOperation();
} catch (error) {
  console.error('Operation failed:', error);
  throw error; // Or return appropriate error response
}
```

### Don't Return Vague Errors

```typescript
// Wrong
return { error: 'Something went wrong' };

// Correct
return { error: 'Failed to connect to database', code: 'DATABASE_ERROR' };
```

### Don't Expose Sensitive Information

```typescript
// Wrong
return { error: error.stack }; // Exposing stack trace

// Correct
console.error('Internal error:', error); // Server-side log
return { error: 'Internal server error' }; // Client response
```

---

## Related Documentation

- [Logging Guidelines](./logging-guidelines.md)
- [Quality Guidelines](./quality-guidelines.md)
