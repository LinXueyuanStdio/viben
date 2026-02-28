---
sidebar_position: 4
---

# 错误处理

> Viben 项目错误处理约定

---

## 概述

Viben 使用统一的错误处理模式，确保 API 响应一致性和用户体验。

---

## 错误响应格式

### 标准错误响应

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| error | string | 用户友好的错误消息 |
| code | string | 错误代码（可选） |
| details | object | 额外错误详情（可选） |

### HTTP 状态码

| 状态码 | 用途 |
|--------|------|
| 400 | 请求参数错误 |
| 401 | 未认证 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 409 | 资源冲突 |
| 500 | 服务器内部错误 |

---

## 错误类型

### 业务错误

| 错误代码 | HTTP 状态 | 说明 |
|----------|----------|------|
| `NOT_FOUND` | 404 | 资源不存在 |
| `ALREADY_EXISTS` | 409 | 资源已存在 |
| `INVALID_INPUT` | 400 | 输入参数无效 |
| `UNAUTHORIZED` | 401 | 未授权访问 |
| `FORBIDDEN` | 403 | 禁止访问 |

### 系统错误

| 错误代码 | HTTP 状态 | 说明 |
|----------|----------|------|
| `INTERNAL_ERROR` | 500 | 内部服务器错误 |
| `DATABASE_ERROR` | 500 | 数据库错误 |
| `EXTERNAL_SERVICE_ERROR` | 502 | 外部服务错误 |
| `TIMEOUT` | 504 | 请求超时 |

---

## 错误处理模式

### TypeScript (Gateway API)

```typescript
import { Context } from 'hono';

// 统一错误响应
function errorResponse(c: Context, status: number, message: string, code?: string) {
  return c.json({
    error: message,
    code: code,
  }, status);
}

// 路由示例
app.get('/api/agents/:id', async (c) => {
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

## 错误日志

### 日志级别

| 级别 | 用途 |
|------|------|
| `error` | 错误和异常 |
| `warn` | 警告信息 |
| `info` | 一般信息 |
| `debug` | 调试信息 |

### 日志内容

```typescript
// 记录错误时包含上下文
logger.error({
  error: error.message,
  stack: error.stack,
  userId: user.id,
  action: 'createAgent',
  input: requestBody,
}, 'Failed to create agent');
```

---

## 前端错误处理

### API 调用

```typescript
async function fetchAgent(id: string) {
  const response = await fetch(`/api/agents/${id}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Unknown error');
  }

  return response.json();
}
```

### 用户提示

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

## 禁止的模式

### 不要吞掉错误

```typescript
// 错误
try {
  await riskyOperation();
} catch (error) {
  // 静默忽略错误
}

// 正确
try {
  await riskyOperation();
} catch (error) {
  console.error('Operation failed:', error);
  throw error; // 或返回适当的错误响应
}
```

### 不要返回模糊错误

```typescript
// 错误
return { error: 'Something went wrong' };

// 正确
return { error: 'Failed to connect to database', code: 'DATABASE_ERROR' };
```

### 不要暴露敏感信息

```typescript
// 错误
return { error: error.stack }; // 暴露堆栈信息

// 正确
console.error('Internal error:', error); // 服务端日志
return { error: 'Internal server error' }; // 客户端响应
```

---

## 相关文档

- [日志指南](./logging-guidelines.md)
- [质量指南](./quality-guidelines.md)
