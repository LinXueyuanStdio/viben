# WorkAny 前端集成方案

## 概述

WorkAny 前端通过 `useAgent` Hook 和相关组件实现与后端 API 的通信，使用 Server-Sent Events (SSE) 实现实时更新。

## useAgent Hook

**文件**: [`workany/src/shared/hooks/useAgent.ts`](/Users/lxy/Documents/GitHub/others/workany/src/shared/hooks/useAgent.ts)

### 主要功能

1. **SSE 连接管理**: 建立和维护与后端的 SSE 连接
2. **消息处理**: 解析不同类型的 Agent 消息
3. **状态管理**: 跟踪任务执行状态
4. **后台任务**: 与后台任务管理器集成
5. **数据持久化**: 将消息和结果保存到数据库

### 核心状态

```typescript
// 概念性结构 - 基于实际实现
interface UseAgentState {
  isRunning: boolean;           // 任务是否正在运行
  messages: Message[];          // 消息列表
  currentPlan: TaskPlan | null; // 当前执行计划
  isWaitingApproval: boolean;   // 是否等待计划审批
  error: string | null;         // 错误信息
  cost: number | null;          // API 调用成本
  duration: number | null;      // 执行时长
}
```

### SSE 消息处理流程

```typescript
// 概念性代码 - 基于 useAgent 实现
async function handleSSEStream(response: Response, taskId: string) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value);
    const lines = text.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        await processAgentMessage(data, taskId);
      }
    }
  }
}

async function processAgentMessage(message: AgentMessage, taskId: string) {
  switch (message.type) {
    case 'session':
      // 保存会话 ID 用于后续操作
      setSessionId(message.sessionId);
      break;

    case 'text':
      // 创建文本消息记录
      await createMessage({
        task_id: taskId,
        type: 'text',
        content: message.content,
      });
      break;

    case 'tool_use':
      // 记录工具调用
      await createMessage({
        task_id: taskId,
        type: 'tool_use',
        tool_name: message.name,
        tool_input: JSON.stringify(message.input),
        tool_use_id: message.id,
      });
      break;

    case 'tool_result':
      // 记录工具结果
      await createMessage({
        task_id: taskId,
        type: 'tool_result',
        tool_output: message.output,
        tool_use_id: message.toolUseId,
      });
      break;

    case 'plan':
      // 显示计划审批 UI
      setCurrentPlan(message.plan);
      setIsWaitingApproval(true);
      break;

    case 'direct_answer':
      // 简单问题的直接回答
      await createMessage({
        task_id: taskId,
        type: 'text',
        content: message.content,
      });
      break;

    case 'result':
      // 任务完成
      await updateTaskFromMessage(taskId, 'result', message.content, message.cost, message.duration);
      setCost(message.cost);
      setDuration(message.duration);
      break;

    case 'error':
      // 错误处理
      await createMessage({
        task_id: taskId,
        type: 'error',
        error_message: message.message,
      });
      setError(message.message);
      break;

    case 'done':
      // 任务结束
      setIsRunning(false);
      break;
  }
}
```

### API 调用

```typescript
// 直接执行模式
async function runAgent(prompt: string, options: AgentOptions) {
  const response = await fetch(`${API_BASE_URL}/agent/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      workDir: options.workDir,
      taskId: options.taskId,
      modelConfig: options.modelConfig,
      sandboxConfig: options.sandboxConfig,
      conversation: options.conversation,
      images: options.images,
      skillsConfig: options.skillsConfig,
      mcpConfig: options.mcpConfig,
    }),
    signal: abortController.signal,
  });

  await handleSSEStream(response, options.taskId);
}

// 规划阶段
async function planAgent(prompt: string, options: PlanOptions) {
  const response = await fetch(`${API_BASE_URL}/agent/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      modelConfig: options.modelConfig,
    }),
    signal: abortController.signal,
  });

  await handleSSEStream(response, options.taskId);
}

// 执行阶段
async function executeAgent(planId: string, options: ExecuteOptions) {
  const response = await fetch(`${API_BASE_URL}/agent/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      planId,
      prompt: options.originalPrompt,
      workDir: options.workDir,
      taskId: options.taskId,
      modelConfig: options.modelConfig,
      sandboxConfig: options.sandboxConfig,
      skillsConfig: options.skillsConfig,
      mcpConfig: options.mcpConfig,
    }),
    signal: abortController.signal,
  });

  await handleSSEStream(response, options.taskId);
}

// 停止任务
async function stopAgent(sessionId: string) {
  await fetch(`${API_BASE_URL}/agent/stop/${sessionId}`, {
    method: 'POST',
  });
}
```

---

## PlanApproval 组件

**文件**: [`workany/src/components/task/PlanApproval.tsx`](/Users/lxy/Documents/GitHub/others/workany/src/components/task/PlanApproval.tsx)

### 组件 Props

```typescript
interface PlanApprovalProps {
  plan: TaskPlan;
  isWaitingApproval: boolean;
  onApprove?: () => void;
  onReject?: () => void;
}
```

### UI 状态

| 状态 | 样式 | 描述 |
|------|------|------|
| 等待审批 | `border-primary/30 bg-accent/30` | 显示批准/拒绝按钮 |
| 全部完成 | `border-emerald-500/30 bg-emerald-50/30` | 绿色成功样式 |
| 已取消 | `border-muted-foreground/30 bg-muted/30` | 灰色禁用样式 |

### 步骤状态显示

```typescript
// 行 79-124
{plan.steps.map((step, index) => (
  <div key={step.id} className="flex items-start gap-2.5">
    <div
      className={cn(
        'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border text-xs font-medium',
        step.status === 'completed'
          ? 'bg-primary border-primary text-primary-foreground'
          : step.status === 'in_progress'
            ? 'border-primary bg-primary/10 text-primary'
            : step.status === 'failed'
              ? 'border-destructive bg-destructive/10 text-destructive'
              : step.status === 'cancelled'
                ? 'border-muted-foreground/30 bg-muted text-muted-foreground'
                : 'border-muted-foreground/30 bg-background text-muted-foreground'
      )}
    >
      {step.status === 'completed' ? (
        <Check className="size-3" />
      ) : step.status === 'in_progress' ? (
        <div className="bg-primary size-1.5 animate-pulse rounded-full" />
      ) : step.status === 'cancelled' ? (
        <X className="size-3" />
      ) : (
        index + 1
      )}
    </div>
    <span className={cn('min-w-0 flex-1 text-sm leading-snug', /* ... */)}>
      {step.description}
    </span>
  </div>
))}
```

### 操作按钮

```typescript
// 行 136-153
{isWaitingApproval && onApprove && onReject && (
  <div className="flex items-center justify-end gap-2 pt-2">
    <button
      onClick={onReject}
      className="text-muted-foreground hover:text-foreground hover:bg-accent flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors"
    >
      <X className="size-4" />
      {t.task.cancel}
    </button>
    <button
      onClick={onApprove}
      className="bg-primary text-primary-foreground hover:bg-primary/90 flex cursor-pointer items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm transition-colors"
    >
      <Play className="size-4" />
      {t.task.startExecution}
    </button>
  </div>
)}
```

---

## 后台任务 UI 集成

### 订阅后台任务状态

```typescript
// 概念性代码
import { subscribeToBackgroundTasks, type BackgroundTask } from '@/shared/lib/background-tasks';

function TaskNotifications() {
  const [backgroundTasks, setBackgroundTasks] = useState<BackgroundTask[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToBackgroundTasks((tasks) => {
      setBackgroundTasks(tasks.filter(t => t.isRunning));
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="fixed bottom-4 right-4">
      {backgroundTasks.map(task => (
        <div key={task.taskId} className="bg-background border rounded-lg p-3 mb-2 shadow-lg">
          <div className="flex items-center gap-2">
            <div className="animate-pulse size-2 rounded-full bg-primary" />
            <span className="text-sm truncate max-w-[200px]">{task.prompt}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            运行中: {formatDuration(Date.now() - task.startedAt.getTime())}
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## 错误处理

### 本地化错误消息

```typescript
// 行 34-45: 获取本地化错误消息
function getErrorMessages() {
  const settings = getSettings();
  const lang = (settings.language || 'zh-CN') as Language;
  return (
    translations[lang]?.common?.errors || translations['zh-CN'].common.errors
  );
}

// 行 47-75: 格式化 fetch 错误
function formatFetchError(error: unknown, _endpoint: string): string {
  const err = error as Error;
  const message = err.message || String(error);
  const t = getErrorMessages();

  // 常见错误模式 - 使用友好消息
  if (
    message === 'Load failed' ||
    message === 'Failed to fetch'
  ) {
    return t.connectionFailed;
  }

  // ... 更多错误处理
}
```

### 特殊错误标记处理

后端返回的特殊错误标记会在前端转换为本地化消息：

| 后端标记 | 含义 |
|----------|------|
| `__CLAUDE_CODE_NOT_FOUND__` | Claude Code 未安装 |
| `__API_KEY_ERROR__` | API 密钥错误 |
| `__CUSTOM_API_ERROR__` | 自定义 API 兼容性问题 |
| `__INTERNAL_ERROR__` | 内部错误 |
| `__AGENT_PROCESS_ERROR__` | 智能体进程错误 |

---

## 数据流总结

```
用户输入
    │
    ▼
┌─────────────┐
│  useAgent   │
│   Hook      │
└──────┬──────┘
       │
       │ POST /agent/* (SSE)
       ▼
┌─────────────┐
│ SSE Stream  │
│   Reader    │
└──────┬──────┘
       │
       │ message events
       ▼
┌─────────────┐        ┌─────────────┐
│  Message    │───────►│  Database   │
│  Processor  │        │  (SQLite/   │
└──────┬──────┘        │  IndexedDB) │
       │               └─────────────┘
       │
       │ state updates
       ▼
┌─────────────┐
│    React    │
│    State    │
└──────┬──────┘
       │
       │ re-render
       ▼
┌─────────────┐
│    UI       │
│  Components │
└─────────────┘
```

---

## 配置与环境

### API 端点配置

```typescript
// 开发环境
const API_BASE_URL = 'http://localhost:2026';

// 生产环境 (Tauri)
const API_BASE_URL = 'http://localhost:2620';

// 环境检测
const API_PORT = import.meta.env.PROD ? 2620 : 2026;
```

---

## 原始文件引用

- useAgent Hook: [`workany/src/shared/hooks/useAgent.ts`](/Users/lxy/Documents/GitHub/others/workany/src/shared/hooks/useAgent.ts)
- PlanApproval: [`workany/src/components/task/PlanApproval.tsx`](/Users/lxy/Documents/GitHub/others/workany/src/components/task/PlanApproval.tsx)
- 后台任务: [`workany/src/shared/lib/background-tasks.ts`](/Users/lxy/Documents/GitHub/others/workany/src/shared/lib/background-tasks.ts)
- 数据库操作: [`workany/src/shared/db/database.ts`](/Users/lxy/Documents/GitHub/others/workany/src/shared/db/database.ts)
