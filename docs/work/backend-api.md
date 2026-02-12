# WorkAny 后端 API 端点详解

## API 服务器入口

**文件**: [`workany/src-api/src/index.ts`](/Users/lxy/Documents/GitHub/others/workany/src-api/src/index.ts)

```typescript
// 主要端点路由配置 (行 29-36)
app.route('/health', healthRoutes);
app.route('/agent', agentRoutes);
app.route('/sandbox', sandboxRoutes);
app.route('/preview', previewRoutes);
app.route('/providers', providersRoutes);
app.route('/files', filesRoutes);
app.route('/mcp', mcpRoutes);
```

## 端点详解

### 1. Agent 端点 (`/agent/*`)

**文件**: [`workany/src-api/src/app/api/agent.ts`](/Users/lxy/Documents/GitHub/others/workany/src-api/src/app/api/agent.ts)

#### POST `/agent/plan` - 规划阶段

**描述**: 创建执行计划但不执行任务

**请求体**:
```typescript
interface PlanRequest {
  prompt: string;              // 用户输入的提示词
  modelConfig?: {
    apiKey?: string;           // API 密钥
    baseUrl?: string;          // 自定义 API 端点
    model?: string;            // 模型名称
  };
}
```

**响应**: SSE 流，返回 `AgentMessage` 类型的事件

**实现位置**: 行 48-74

```typescript
// 核心逻辑
agent.post('/plan', async (c) => {
  const body = await c.req.json<AgentRequest>();
  const session = createSession('plan');
  const readable = createSSEStream(
    runPlanningPhase(body.prompt, session, body.modelConfig)
  );
  return new Response(readable, { headers: SSE_HEADERS });
});
```

---

#### POST `/agent/execute` - 执行阶段

**描述**: 执行已批准的计划

**请求体**:
```typescript
interface ExecuteRequest {
  planId: string;              // 计划 ID
  prompt: string;              // 原始提示词
  workDir?: string;            // 工作目录
  taskId?: string;             // 任务 ID
  modelConfig?: ModelConfig;
  sandboxConfig?: SandboxConfig;
  skillsConfig?: {
    enabled: boolean;
    userDirEnabled: boolean;
    appDirEnabled: boolean;
    skillsPath?: string;
  };
  mcpConfig?: {
    enabled: boolean;
    userDirEnabled: boolean;
    appDirEnabled: boolean;
    mcpConfigPath?: string;
  };
}
```

**响应**: SSE 流

**实现位置**: 行 76-137

```typescript
// 核心逻辑
agent.post('/execute', async (c) => {
  const plan = getPlan(body.planId);
  if (!plan) {
    return c.json({ error: 'Plan not found or expired' }, 404);
  }
  const session = createSession('execute');
  const readable = createSSEStream(
    runExecutionPhase(
      body.planId, session, body.prompt, body.workDir,
      body.taskId, body.modelConfig, body.sandboxConfig,
      body.skillsConfig, body.mcpConfig
    )
  );
  return new Response(readable, { headers: SSE_HEADERS });
});
```

---

#### POST `/agent/` - 直接执行模式 (Legacy)

**描述**: 计划和执行合并为一次调用

**请求体**:
```typescript
interface AgentRequest {
  prompt: string;
  sessionId?: string;
  conversation?: ConversationMessage[];
  workDir?: string;
  taskId?: string;
  modelConfig?: ModelConfig;
  sandboxConfig?: SandboxConfig;
  images?: ImageAttachment[];
  skillsConfig?: SkillsConfig;
  mcpConfig?: McpConfig;
}
```

**响应**: SSE 流

**实现位置**: 行 139-197

---

#### POST `/agent/stop/:sessionId` - 停止执行

**描述**: 终止正在运行的智能体会话

**参数**: `sessionId` - 会话 ID

**响应**: `{ status: 'stopped' }` 或 `{ error: 'Session not found' }`

**实现位置**: 行 199-210

---

#### GET `/agent/session/:sessionId` - 获取会话状态

**描述**: 查询会话当前状态

**响应**:
```typescript
{
  id: string;
  createdAt: Date;
  phase: 'planning' | 'executing' | 'idle';
  isAborted: boolean;
}
```

**实现位置**: 行 212-227

---

#### GET `/agent/plan/:planId` - 获取计划详情

**描述**: 获取已存储的执行计划

**响应**: `TaskPlan` 对象或 404 错误

**实现位置**: 行 229-239

---

### 2. SSE 流实现

**文件**: [`workany/src-api/src/app/api/agent.ts`](/Users/lxy/Documents/GitHub/others/workany/src-api/src/app/api/agent.ts) 行 17-46

```typescript
// SSE 流创建器
function createSSEStream(generator: AsyncGenerator<unknown>) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const message of generator) {
          const data = `data: ${JSON.stringify(message)}\n\n`;
          controller.enqueue(encoder.encode(data));
        }
      } catch (error) {
        const errorData = `data: ${JSON.stringify({
          type: 'error',
          message: error instanceof Error ? error.message : String(error),
        })}\n\n`;
        controller.enqueue(encoder.encode(errorData));
      } finally {
        controller.close();
      }
    },
  });
}

// SSE 响应头配置
const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',  // 禁用 Nginx 缓冲
};
```

---

### 3. 消息类型定义

**文件**: [`workany/src-api/src/core/agent/types.ts`](/Users/lxy/Documents/GitHub/others/workany/src-api/src/core/agent/types.ts) 行 25-53

```typescript
type AgentMessageType =
  | 'session'       // 会话创建
  | 'text'          // 文本输出
  | 'tool_use'      // 工具调用
  | 'tool_result'   // 工具结果
  | 'result'        // 最终结果
  | 'error'         // 错误
  | 'done'          // 完成
  | 'plan'          // 计划输出
  | 'direct_answer'; // 直接回答 (无需计划)

interface AgentMessage {
  type: AgentMessageType;
  sessionId?: string;
  content?: string;
  name?: string;        // 工具名称
  id?: string;          // 工具调用 ID
  input?: unknown;      // 工具输入
  cost?: number;        // API 调用费用
  duration?: number;    // 执行时长 (ms)
  toolUseId?: string;   // 工具使用 ID
  output?: string;      // 工具输出
  isError?: boolean;
  plan?: TaskPlan;      // 执行计划
  message?: string;     // 错误消息
}
```

---

### 4. 计划类型定义

**文件**: [`workany/src-api/src/core/agent/types.ts`](/Users/lxy/Documents/GitHub/others/workany/src-api/src/core/agent/types.ts) 行 74-86

```typescript
interface TaskPlan {
  id: string;
  goal: string;           // 任务目标
  steps: PlanStep[];      // 执行步骤
  notes?: string;         // 备注
  createdAt: Date;
}

interface PlanStep {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}
```

---

## API 服务器生命周期

**文件**: [`workany/src-api/src/index.ts`](/Users/lxy/Documents/GitHub/others/workany/src-api/src/index.ts) 行 104-125

```typescript
async function start() {
  console.log(`Server starting on http://localhost:${port}`);

  // 1. 加载配置
  await loadConfig();

  // 2. 初始化 Provider Manager
  await initProviderManager();

  // 3. 启动 HTTP 服务器
  server = serve({
    fetch: app.fetch,
    port,
  });
}
```

**清理流程** (行 73-93):
```typescript
const cleanup = async () => {
  // 停止所有预览服务器
  const previewManager = getPreviewManager();
  await previewManager.stopAll();

  // 关闭 Provider Manager
  await shutdownProviderManager();

  // 关闭 HTTP 服务器
  if (server) {
    server.close();
    server = null;
  }
};
```

## 原始文件引用

- API 入口: [`workany/src-api/src/index.ts`](/Users/lxy/Documents/GitHub/others/workany/src-api/src/index.ts)
- Agent 路由: [`workany/src-api/src/app/api/agent.ts`](/Users/lxy/Documents/GitHub/others/workany/src-api/src/app/api/agent.ts)
- 类型定义: [`workany/src-api/src/core/agent/types.ts`](/Users/lxy/Documents/GitHub/others/workany/src-api/src/core/agent/types.ts)
