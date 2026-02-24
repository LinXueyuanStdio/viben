# Gateway API 驼峰命名审计报告 - apps/desktop

> 审计日期: 2026-02-26
>
> 根据 CLAUDE.md 规范，所有 Gateway API 查询参数和请求体字段应使用 **snake_case** 格式

---

## 摘要

Desktop 应用在 **gateway client (gateway.ts)** 的接口定义中已正确使用 snake_case，但在 **直接 fetch 调用** 中存在 camelCase 违规。

---

## 1. 违规位置 - 请求体字段 (Request Body)

### 文件: `hooks/use-agent-conversation.ts`

#### POST `/api/agent/run` (Lines 436-456)

**当前代码:**
```typescript
const requestBody: Record<string, unknown> = {
  prompt: content,
  agentPath: agentPath || undefined,           // ❌ 应为 agent_path
  agentConfig: agentPath ? undefined : ...,    // ❌ 应为 agent_config
  sessionId: persistSessionId || undefined,    // ❌ 应为 session_id
  taskId: currentTaskId,                       // ❌ 应为 task_id
};
```

**应修改为:**
```typescript
const requestBody: Record<string, unknown> = {
  prompt: content,
  agent_path: agentPath || undefined,
  agent_config: agentPath ? undefined : ...,
  session_id: persistSessionId || undefined,
  task_id: currentTaskId,
};
```

| 行号 | 当前命名 | 应改为 |
|------|----------|--------|
| 438 | `agentPath` | `agent_path` |
| 439 | `agentConfig` | `agent_config` |
| 441 | `sessionId` | `session_id` |
| 442 | `taskId` | `task_id` |

---

#### POST `/api/agent/answer/{questionId}` (Lines 870-877)

**当前代码:**
```typescript
body: JSON.stringify({
  answers: flatAnswers,
  agentPath,              // ❌ 应为 agent_path
  workspacePath: workspaceId,   // ❌ 应为 workspace_path
}),
```

**应修改为:**
```typescript
body: JSON.stringify({
  answers: flatAnswers,
  agent_path: agentPath,
  workspace_path: workspaceId,
}),
```

| 行号 | 当前命名 | 应改为 |
|------|----------|--------|
| 875 | `agentPath` | `agent_path` |
| 876 | `workspacePath` | `workspace_path` |

---

## 2. 违规位置 - URL 路径参数 (Path Parameters)

### 文件: `hooks/use-background-tasks.ts`

#### POST `/api/agent/tasks/:taskId/stop` (Line 181)

**当前代码:**
```typescript
const response = await fetch(`${gatewayUrl}/api/agent/tasks/${taskId}/stop`, {
```

| 行号 | 当前路径 | 应改为 |
|------|----------|--------|
| 181 | `/api/agent/tasks/:taskId/stop` | `/api/agent/tasks/:task_id/stop` |

**注意:** 路径参数修改需要前后端同步更改。

---

## 3. 符合规范的部分

### gateway.ts - 接口定义 ✅

所有接口已正确使用 snake_case:

```typescript
// ✅ 正确
export interface SpawnAgentRequest {
  prompt: string;
  workdir: string;
  session_id?: string;  // ✅ snake_case
  config?: ExecutorConfig;
}

export interface CreateFileSessionRequest {
  session_id?: string;      // ✅ snake_case
  prompt?: string;
  task_id?: string;         // ✅ snake_case
  agent_path?: string;      // ✅ snake_case
  agent_config?: Record<string, unknown>;  // ✅ snake_case
  workspace_path?: string;  // ✅ snake_case
}
```

### gateway.ts - 查询参数转换 ✅

函数参数使用 camelCase (JS 惯例)，转换为 snake_case 发送:

```typescript
// ✅ 正确的模式
async getExecutors(options?: {
  workspacePath?: string;       // camelCase TypeScript 参数
  includeGlobal?: boolean;
}): Promise<ExecutorsResponse> {
  const params = new URLSearchParams();
  if (options?.workspacePath) {
    params.set("workspace_path", options.workspacePath);  // ✅ snake_case 发送
  }
  if (options?.includeGlobal !== undefined) {
    params.set("include_global", String(options.includeGlobal));  // ✅ snake_case 发送
  }
}
```

### use-channel-instances.ts ✅

Channel 相关 API 调用已使用 snake_case:

```typescript
body: JSON.stringify({ channel_type: channelType, config })  // ✅
body: JSON.stringify({ channel_type, config, chat_id, message })  // ✅
```

### use-cron.ts ✅

Cron 相关 API 调用使用正确的 snake_case 类型。

---

## 4. 修复汇总

| 文件 | 违规数量 | 类型 | 优先级 |
|------|----------|------|--------|
| `use-agent-conversation.ts` | 6 | Request Body | **高** |
| `use-background-tasks.ts` | 1 | Path Parameter | 中 |

**总计: 7 处违规**

---

## 5. 修复建议

### 高优先级 - Request Body 字段

修改 `use-agent-conversation.ts` 中的请求体字段命名:

1. Line 438: `agentPath` → `agent_path`
2. Line 439: `agentConfig` → `agent_config`
3. Line 441: `sessionId` → `session_id`
4. Line 442: `taskId` → `task_id`
5. Line 875: `agentPath` → `agent_path`
6. Line 876: `workspacePath` → `workspace_path`

### 中优先级 - Path Parameters

路径参数需要与 packages/core 端点同步修改:

- `/api/agent/tasks/:taskId/stop` → `/api/agent/tasks/:task_id/stop`

---

## 6. 依赖关系

Desktop 修复需要与 packages/core 同步:

| Desktop 文件 | Core 端点 | 需同步修改 |
|--------------|----------|------------|
| `use-agent-conversation.ts` | `routes/agent-run.ts` | 是 |
| `use-background-tasks.ts` | `routes/tasks.ts` | 是 |

建议顺序:
1. 先修改 packages/core 端点接受 snake_case
2. 再修改 apps/desktop 发送 snake_case
3. 可考虑在后端增加兼容层，同时接受两种格式过渡
