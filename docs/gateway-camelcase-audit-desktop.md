# Gateway API 驼峰命名审计报告 - apps/desktop

> 审计日期: 2026-02-26
> 更新日期: 2026-03-10
>
> 根据 CLAUDE.md 规范，所有 Gateway API 查询参数和请求体字段应使用 **snake_case** 格式

---

## 摘要

~~Desktop 应用在 **gateway client (gateway.ts)** 的接口定义中已正确使用 snake_case，但在 **直接 fetch 调用** 中存在 camelCase 违规。~~

**更新 (2026-03-10)**: 大部分违规已修复。同时完成了命名重构：`agentPath` → `agentConfigPath`，语义更明确。

---

## 1. 违规位置 - 请求体字段 (Request Body)

### 文件: `hooks/use-agent-conversation.ts`

#### POST `/api/agent/run` (Lines 436-456)

**当前代码:** ✅ 已修复
```typescript
const requestBody: Record<string, unknown> = {
  prompt: content,
  agent_config_path: agentConfigPath || undefined,  // ✅ 已修复
  agent_config: agentConfigPath ? undefined : ...,  // ✅ 已修复
  session_id: persistSessionId || undefined,        // ✅ 已修复
  task_id: currentTaskId,                           // ✅ 已修复
};
```

| 字段 | 状态 |
|------|------|
| `agent_config_path` | ✅ 已修复 |
| `agent_config` | ✅ 已修复 |
| `session_id` | ✅ 已修复 |
| `task_id` | ✅ 已修复 |

---

#### POST `/api/agent/answer/{questionId}` (Lines 870-877)

**当前代码:** ✅ 已修复
```typescript
body: JSON.stringify({
  answers: flatAnswers,
  agent_config_path: agentConfigPath,  // ✅ 已修复
  workspace_path: workspaceId,         // ✅ 已修复
}),
```

| 字段 | 状态 |
|------|------|
| `agent_config_path` | ✅ 已修复 |
| `workspace_path` | ✅ 已修复 |

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
  session_id?: string;           // ✅ snake_case
  prompt?: string;
  task_id?: string;              // ✅ snake_case
  agent_config_path?: string;    // ✅ snake_case (renamed from agent_path)
  agent_config?: Record<string, unknown>;  // ✅ snake_case
  workspace_path?: string;       // ✅ snake_case
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

| 文件 | 状态 | 类型 | 说明 |
|------|------|------|------|
| `use-agent-conversation.ts` | ✅ 已修复 | Request Body | 使用 `agent_config_path` |
| `use-background-tasks.ts` | 🔄 待确认 | Path Parameter | 需确认路径参数规范 |

**原始违规: 7 处 → 已修复: 6 处**

---

## 5. 修复建议

### 高优先级 - Request Body 字段 ✅ 已完成

`use-agent-conversation.ts` 中的请求体字段已修复:

1. ✅ `agent_config_path` (原 `agentPath` → `agent_path` → `agent_config_path`)
2. ✅ `agent_config`
3. ✅ `session_id`
4. ✅ `task_id`
5. ✅ `workspace_path`

**命名变更说明**: `agentPath` 已重命名为 `agentConfigPath` (TypeScript) / `agent_config_path` (API)，语义更明确：
- `agentConfigPath` - 指向配置文件路径 (e.g., `/path/to/agents/myagent/AGENTS.md`)
- `agentDir` - 指向智能体目录路径 (e.g., `/path/to/agents/myagent/`)

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
