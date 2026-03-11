# Logger 可观测性增强设计

> 日期：2026-03-11
> 状态：已批准
> 范围：packages/core/src/telemetry

## 背景

当前 packages/core 已使用 Pino 作为日志库，并与 OpenTelemetry 集成。但存在以下问题：

- 83 个文件仍使用 `console.log`，未统一
- 缺少全局 logger 单例，依赖注入困难
- 无日志采样能力（高流量场景）
- 无敏感信息脱敏（API keys、tokens）
- Logs 与 Traces 关联不够紧密

## 设计方案

采用 **渐进式统一 + 增强** 方案：保持现有 Pino 架构，添加全局单例 + 增强功能 + 逐步迁移。

### 1. 全局 Logger 单例架构

**文件结构：**

```
telemetry/
├── logger.ts           # 现有，保留
├── global-logger.ts    # 新增：全局单例管理
├── redact.ts           # 新增：敏感信息脱敏
├── sampling.ts         # 新增：日志采样
└── context.ts          # 新增：Trace Context 注入
```

**使用方式：**

```typescript
import { logger } from "@viben/core/telemetry";

// 模块级使用 - 自动带模块名上下文
const log = logger.child({ module: "gateway" });
log.info({ userId: "123" }, "Request received");
```

**输出示例：**

```json
{
  "level": "info",
  "time": "2024-03-11T10:00:00.000Z",
  "service": "viben-gateway",
  "module": "gateway",
  "traceId": "abc123",
  "spanId": "def456",
  "userId": "123",
  "msg": "Request received"
}
```

**初始化时机：** 在 `initTelemetry()` 时自动设置全局实例，未初始化时使用 console fallback。

### 2. 敏感信息自动脱敏

使用 Pino 内置的 `redact` 功能，配置敏感字段路径：

```typescript
// redact.ts
export const REDACT_PATHS = [
  // API Keys & Tokens
  "apiKey", "api_key", "apikey",
  "token", "accessToken", "access_token", "refreshToken",
  "authorization", "Authorization",
  "secret", "secretKey", "secret_key",

  // 认证信息
  "password", "passwd", "pwd",
  "credential", "credentials",

  // 嵌套路径
  "headers.authorization",
  "headers.Authorization",
  "config.apiKey",
  "*.apiKey",
  "*.token",

  // 个人信息 (可选)
  "email", "phone", "ssn"
];
```

**自定义脱敏函数：** 支持部分遮蔽（如只显示 key 前 4 位）

```typescript
redact: {
  paths: REDACT_PATHS,
  censor: (value, path) => {
    if (typeof value === 'string' && value.length > 8) {
      return value.slice(0, 4) + '****';
    }
    return '[REDACTED]';
  }
}
```

**脱敏后输出：**

```json
{
  "apiKey": "sk-p****",
  "headers": {
    "Authorization": "[REDACTED]"
  }
}
```

### 3. 日志采样策略

**采样规则定义：**

```typescript
// sampling.ts
export interface SamplingRule {
  /** 匹配条件：模块名或消息模式 */
  match: string | RegExp;
  /** 采样率：0.0-1.0，1.0 = 全部保留 */
  rate: number;
  /** 最小间隔（毫秒）：同类日志的最小输出间隔 */
  minIntervalMs?: number;
}

export const DEFAULT_SAMPLING_RULES: SamplingRule[] = [
  // 心跳日志：每 60 秒最多 1 条
  { match: /heartbeat|ping|health/i, rate: 0.1, minIntervalMs: 60000 },

  // 轮询日志：10% 采样
  { match: /polling|poll/i, rate: 0.1 },

  // WebSocket 消息：高频场景 20% 采样
  { match: "ws:message", rate: 0.2 },

  // 错误日志：永远不采样
  { match: /error|fatal/i, rate: 1.0 },
];
```

**采样后日志标记：**

```json
{
  "msg": "Heartbeat OK",
  "_sampled": true,
  "_sampleRate": 0.1,
  "_suppressed": 9
}
```

### 4. Trace Context 自动注入

使用 OpenTelemetry Context API + Pino mixin：

```typescript
// context.ts
import { context, trace } from "@opentelemetry/api";

export function traceContextMixin(): Record<string, unknown> {
  const span = trace.getSpan(context.active());

  if (!span) return {};

  const spanContext = span.spanContext();
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
    traceFlags: spanContext.traceFlags,
  };
}

// Logger 配置中使用
pino({
  mixin: traceContextMixin,
});
```

### 5. console.log 迁移策略

**ESLint 规则阻止新增：**

```javascript
// .eslintrc.js
rules: {
  "no-console": ["error", {
    allow: ["assert", "clear", "Console"]
  }]
}
```

**迁移示例：**

```typescript
// 迁移前
console.log("Starting server on port", port);
console.error("Failed to connect:", error);

// 迁移后
log.info({ port }, "Starting server");
log.error({ err: error }, "Failed to connect");
```

**分批迁移优先级：**

| 优先级 | 模块 | 文件数 | 原因 |
|-------|------|-------|------|
| P0 | gateway/ | ~15 | 核心服务，需要可观测性 |
| P1 | executors/ | ~20 | Agent 执行链路追踪 |
| P2 | cli/commands/ | ~25 | 用户交互，需区分 stdout/日志 |
| P3 | 其他 | ~23 | 低频模块 |

**CLI 特殊处理：**

```typescript
// CLI 区分用户输出 vs 日志
console.log("✓ Agent created");           // 用户看到的
log.debug({ agentId }, "Agent created");  // 日志记录的
```

## 配置扩展

```typescript
interface TelemetryConfig {
  // 现有配置...
  log?: {
    level?: string;
    // 新增
    redact?: {
      paths?: string[];
      censor?: 'full' | 'partial';
    };
    sampling?: {
      enabled?: boolean;
      rules?: SamplingRule[];
    };
  };
}
```

## 实现阶段

| 阶段 | 内容 | 依赖 |
|-----|------|-----|
| 1 | 全局单例 + redact + context mixin | 无 |
| 2 | 采样模块 | 阶段 1 |
| 3 | ESLint 规则 + P0 迁移 (gateway) | 阶段 1 |
| 4 | P1-P3 迁移 | 阶段 3 |

## 文件变更清单

```
packages/core/src/telemetry/
├── logger.ts              # 修改：集成 redact + mixin
├── global-logger.ts       # 新增：全局单例管理
├── redact.ts              # 新增：脱敏配置
├── sampling.ts            # 新增：采样规则
├── context.ts             # 新增：Trace Context mixin
├── index.ts               # 修改：导出新模块
└── types.ts               # 修改：扩展配置类型
```

## 验收标准

- [ ] `logger` 全局单例可用
- [ ] 敏感信息自动脱敏
- [ ] 高频日志采样生效
- [ ] 日志自动携带 traceId/spanId
- [ ] ESLint 阻止新增 console.log
- [ ] gateway 模块完成迁移
