---
sidebar_position: 5
---

# 日志指南

> Viben 项目日志记录约定

---

## 概述

Viben 使用结构化日志，支持 JSON 格式输出，便于日志分析和监控。

---

## 日志库

### TypeScript (packages/core)

使用 **Pino** 进行日志记录：

```typescript
import { createLogger, createDualLogger } from "@viben/core/telemetry";

// 创建 logger
const logger = process.env.NODE_ENV === "production"
  ? createLogger(config)
  : createDualLogger(config);  // 同时输出到文件和控制台
```

### Python (browse-mcp)

使用 **loguru** 进行日志记录：

```python
from loguru import logger

logger.info("Starting search")
logger.error(f"Search failed: {error}")
```

---

## 日志级别

| 级别 | TypeScript | Python | 用途 |
|------|------------|--------|------|
| trace | `logger.trace()` | `logger.trace()` | 非常详细的调试信息 |
| debug | `logger.debug()` | `logger.debug()` | 调试信息（开发环境） |
| info | `logger.info()` | `logger.info()` | 一般信息（生产环境默认） |
| warn | `logger.warn()` | `logger.warning()` | 警告信息 |
| error | `logger.error()` | `logger.error()` | 错误信息 |
| fatal | `logger.fatal()` | `logger.critical()` | 致命错误 |

### 级别选择指南

| 场景 | 推荐级别 |
|------|----------|
| 请求开始/结束 | info |
| 外部 API 调用 | debug |
| 参数验证失败 | warn |
| 异常捕获 | error |
| 系统崩溃 | fatal |

---

## 结构化日志

### 基本格式

```typescript
// 结构化日志（推荐）
logger.info({
  userId: user.id,
  action: 'createAgent',
  agentId: agent.id,
}, 'Agent created successfully');

// 简单消息
logger.info('Server started');
```

### 必需字段

| 字段 | 说明 |
|------|------|
| message | 日志消息 |
| timestamp | 时间戳（自动添加） |
| level | 日志级别（自动添加） |

### 推荐字段

| 字段 | 说明 |
|------|------|
| userId | 用户 ID |
| sessionId | 会话 ID |
| traceId | 追踪 ID |
| action | 操作名称 |
| duration | 操作耗时 |

---

## 应该记录的内容

### 请求/响应

```typescript
// 请求开始
logger.info({
  method: 'POST',
  path: '/api/agents',
  body: requestBody,
}, 'API request received');

// 请求完成
logger.info({
  method: 'POST',
  path: '/api/agents',
  status: 200,
  duration: '150ms',
}, 'API request completed');
```

### 业务操作

```typescript
// 重要业务操作
logger.info({
  userId: user.id,
  agentId: agent.id,
  action: 'spawn',
}, 'Agent spawned');

// 状态变更
logger.info({
  taskId: task.id,
  oldStatus: 'pending',
  newStatus: 'running',
}, 'Task status changed');
```

### 错误和异常

```typescript
// 错误日志
logger.error({
  error: error.message,
  stack: error.stack,
  userId: user.id,
  action: 'createAgent',
}, 'Failed to create agent');
```

---

## 不应该记录的内容

### 敏感数据

| 不记录 | 原因 |
|--------|------|
| 密码 | 安全风险 |
| API 密钥 | 安全风险 |
| 令牌 | 安全风险 |
| 个人身份信息 (PII) | 隐私合规 |

### 示例

```typescript
// 错误 - 记录敏感信息
logger.info({
  user: {
    email: 'user@example.com',
    password: 'secret123',  // 绝不记录
    apiKey: 'sk-xxx',       // 绝不记录
  },
}, 'User login');

// 正确 - 脱敏处理
logger.info({
  userId: user.id,
  email: maskEmail(user.email),  // 脱敏
  action: 'login',
}, 'User login');
```

---

## 日志存储

### 文件存储结构

```
~/.viben/telemetry/logs/
└── YYYY-MM-DD.jsonl     # 按日期聚合
```

### 日志格式 (JSONL)

```json
{"level":"info","time":1705312200000,"msg":"Server started","pid":12345}
{"level":"info","time":1705312201000,"msg":"Request received","method":"POST","path":"/api/agents"}
```

---

## 日志配置

### Pino 配置

```typescript
const config = {
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
};
```

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| LOG_LEVEL | 日志级别 | info |
| LOG_FORMAT | 日志格式 | json |

---

## 调试技巧

### 启用调试日志

```bash
# 开发环境
LOG_LEVEL=debug pnpm dev

# 查看特定模块
DEBUG=viben:* pnpm dev
```

### 查看日志文件

```bash
# 查看最新日志
tail -f ~/.viben/telemetry/logs/$(date +%Y-%m-%d).jsonl

# 使用 jq 格式化
tail -f ~/.viben/telemetry/logs/*.jsonl | jq .
```

---

## 禁止的模式

### 使用 console.log

```typescript
// 错误
console.log('User created:', user);

// 正确
logger.info({ userId: user.id }, 'User created');
```

### 使用 print (Python)

```python
# 错误
print(f"Search result: {result}")

# 正确
logger.info(f"Search completed: {len(result)} results")
```

---

## 相关文档

- [遥测指南](./gateway/telemetry.md)
- [错误处理](./error-handling.md)
