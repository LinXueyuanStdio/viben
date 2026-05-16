# GUI Action System Design

> 端侧通用工具体系，供 agent 通过 `GUI_execute` 调用桌面应用的 UI 能力。

## 概述

将现有 presentation 专用的 client-side tool 管道泛化为通用的 GUI action 系统。不同页面/组件通过 `action_provider` 注册可用 action，框架在 app 最外层聚合所有 action，agent 通过 `GUI_execute` MCP tool 调用。

## 核心接口

### MCP Tool 定义

```
GUI_execute(GUI_id: str, action: str, payload: dict) → result
```

- `GUI_id`: 标识目标 GUI 实例（当前版本为单客户端，值固定为 session_id）
- `action`: 完整 action 名称（含 namespace 前缀，如 `chat.send_message`）
- `payload`: action 的输入参数

### 内置 Action（始终可用，无 namespace 前缀）

| Action | 签名 | 说明 |
|--------|------|------|
| `list_actions` | `() → ActionInfo[]` | 返回当前所有已注册 action 的 name + description |
| `get_action_detail` | `(action: str) → ActionDetail` | 返回指定 action 的完整定义（input_schema, output_schema） |
| `read_window` | `() → { screenshot: base64 }` | 截图当前界面 |
| `navigate_to` | `(url: str) → { success: bool }` | 路由跳转到指定页面（url 为应用内部路由路径，如 `/workspace/abc/chat`） |

### 自定义 Action 注册

```typescript
// 页面/组件通过 hook 注册
useActionProvider('chat', {
  send_message: {
    description: '发送消息到当前对话',
    input_schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
    execute: async (payload, ctx) => {
      // ... 执行逻辑
      return { success: true, data: { messageId: '...' } };
    },
  },
});

// agent 调用: GUI_execute(id, 'chat.send_message', { text: 'hello' })
```

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│  App Root                                                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  ActionStore (Zustand)                               │    │
│  │  ┌─────────────────────────────────────────────┐    │    │
│  │  │  registry: Map<namespace, ActionDef[]>       │    │    │
│  │  │  builtins: list_actions, get_action_detail,  │    │    │
│  │  │            read_window, navigate_to          │    │    │
│  │  └─────────────────────────────────────────────┘    │    │
│  │  execute(action, payload) → Promise<ActionResult>    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐   │
│  │  ChatPage     │ │  AgentPage   │ │  PresentationProv│   │
│  │  useAction-   │ │  useAction-  │ │  useAction-      │   │
│  │  Provider     │ │  Provider    │ │  Provider(global)│   │
│  │  ('chat',..） │ │  ('agent',..)│ │  ('presentation')│   │
│  └──────────────┘ └──────────────┘ └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
         ↕ SSE / POST
┌─────────────────────────────────────────────────────────────┐
│  Gateway (packages/core)                                     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  MCP Tool: GUI_execute                               │    │
│  │  → clientToolCompletionRegistry.waitForClient()      │    │
│  │  → SSE tool_use event → 前端 ActionExecutor 执行     │    │
│  │  → POST /api/client-tools/complete                   │    │
│  │  → resolve → 返回结果给 Agent                        │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## 模块设计

### 1. ActionStore (`apps/desktop/src/stores/action-store.ts`)

```typescript
import { create } from 'zustand';
import type { ClientToolResult } from '@/lib/client-side-tool/types';

interface ActionDef {
  name: string;           // 不含 namespace 前缀的短名称
  description: string;
  input_schema?: JSONSchema7;
  output_schema?: JSONSchema7;
  execute: (payload: unknown, ctx: ExecutionContext) => Promise<ClientToolResult>;
}

interface ActionInfo {
  name: string;           // 完整名称（namespace.name）
  description: string;
}

interface ActionDetail extends ActionInfo {
  input_schema?: JSONSchema7;
  output_schema?: JSONSchema7;
}

interface ActionStoreState {
  // 注册表: namespace → ActionDef[]
  registry: Map<string, ActionDef[]>;

  // 获取所有 action 信息（含 namespace 前缀）
  listActions: () => ActionInfo[];

  // 获取指定 action 详情
  getActionDetail: (fullName: string) => ActionDetail | null;

  // 执行 action
  execute: (fullName: string, payload: unknown, ctx: ExecutionContext) => Promise<ClientToolResult>;

  // 注册/注销
  register: (namespace: string, actions: ActionDef[]) => void;
  unregister: (namespace: string) => void;
}
```

**返回类型**: action 的 `execute` 直接返回 `ClientToolResult`（来自 `apps/desktop/src/lib/client-side-tool/types.ts`），与现有 client-tool 管道完全对齐。`ClientToolResult` 包含 `content: (TextContent | ImageContent)[]` 和可选的 `structuredContent`、`isError`。

**内置 action** 在 store 内部实现，不通过 registry：
- `list_actions`: 遍历 registry 生成列表，返回 `{ content: [{ type: 'text', text: JSON.stringify(actions) }] }`
- `get_action_detail`: 查找 registry 返回 schema
- `read_window`: 调用 `html-to-image` 截图，返回 `{ content: [{ type: 'image', data: base64, mimeType: 'image/png' }] }`
- `navigate_to`: 调用 router.navigate()

### 2. useActionProvider Hook (`apps/desktop/src/hooks/use-action-provider.ts`)

```typescript
function useActionProvider(namespace: string, actions: Record<string, Omit<ActionDef, 'name'>>) {
  const register = useActionStore(s => s.register);
  const unregister = useActionStore(s => s.unregister);

  useEffect(() => {
    const defs: ActionDef[] = Object.entries(actions).map(([name, def]) => ({
      name,
      ...def,
    }));
    register(namespace, defs);
    return () => unregister(namespace);
  }, [namespace, actions, register, unregister]);
}
```

**注意**: `actions` 对象引用稳定性。使用者应该用 `useMemo` 或模块级常量定义 actions，避免每次渲染都触发重新注册。

### 3. ExecutionContext (`apps/desktop/src/lib/action-system/execution-context.ts`)

```typescript
interface ApprovalOptions {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface ExecutionContext {
  /** 弹出确认对话框，用户确认返回 true，取消抛出 UserCancelledException */
  requireApproval: (message: string, options?: ApprovalOptions) => Promise<boolean>;

  /** 当前 session ID */
  sessionId: string;

  /** 当前 tool_use_id（用于关联日志） */
  toolUseId: string;
}
```

`requireApproval` 实现：
- 通过 Zustand store 或 event 触发一个确认 Dialog
- Dialog 的确认/取消通过 Promise resolve/reject 传回
- 用户取消时抛出 `UserCancelledException`，executor 捕获后返回 `{ success: false, error: 'user_cancelled' }`

### 4. Action Executor (`apps/desktop/src/lib/action-system/action-executor.ts`)

在前端 SSE 处理逻辑中，当收到 `GUI_execute` 的 tool_use event：

```typescript
import type { ClientToolResult } from '@/lib/client-side-tool/types';

async function handleGUIExecute(toolUseId: string, sessionId: string, input: {
  action: string;
  payload?: unknown;
}) {
  const store = useActionStore.getState();
  const ctx = createExecutionContext(sessionId, toolUseId);

  let result: ClientToolResult;
  try {
    result = await store.execute(input.action, input.payload ?? {}, ctx);
  } catch (err) {
    if (err instanceof UserCancelledException) {
      result = { content: [{ type: 'text', text: 'User cancelled the action' }], isError: true };
    } else {
      result = { content: [{ type: 'text', text: String(err) }], isError: true };
    }
  }

  // 通过现有管道回传结果（类型已完全对齐）
  await getGatewayClient().completeClientTool({
    tool_use_id: toolUseId,
    session_id: sessionId,
    result,
  });
}
```

### 5. 后端 MCP Tool (`packages/core/src/executors/chat/sdk-mcp-servers/gui-action.ts`)

```typescript
registerSdkMcpServer('gui_action', (server) => {
  server.tool('GUI_execute', {
    description: '执行桌面应用的 GUI action',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: '完整 action 名称' },
        payload: { type: 'object', description: 'action 输入参数' },
      },
      required: ['action'],
    },
  }, async (input, extra) => {
    const sessionId = extra.sessionId;
    // 复用 client-tool 管道
    const result = await clientToolCompletionRegistry.waitForClient(sessionId);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  });
});
```

注册为 client-side tool，前端识别 tool name `GUI_execute` 后路由到 action executor。

### 6. Presentation Provider 改造

现有 presentation 系统改造为全局 action_provider：

```typescript
// apps/desktop/src/components/overlay/layers/presentation-provider.tsx
function PresentationActionProvider() {
  const actions = useMemo(() => ({
    draw: {
      description: '在画布上绘制形状',
      input_schema: { /* DrawInput schema */ },
      execute: async (payload, ctx) => { /* 现有 draw 逻辑 */ },
    },
    spotlight: { /* ... */ },
    callout: { /* ... */ },
    walkthrough: { /* ... */ },
    compare: { /* ... */ },
    clear: { /* ... */ },
    stop: { /* ... */ },
  }), []);

  useActionProvider('presentation', actions);
  return null;
}
```

挂载在 OverlayRoot 中，始终可用。

## 数据流

### Agent 调用 action 完整流程

```
1. Agent → 调用 MCP tool `GUI_execute`
2. Gateway → 识别为 client-side tool，enqueue 到 registry
3. SSE → 推送 tool_use event 到前端
4. 前端 SSE handler → 识别 GUI_execute，调用 action-executor
5. action-executor → 从 ActionStore 查找 action
6. action-executor → 创建 ExecutionContext，调用 action.execute(payload, ctx)
7. action 内部 → 可能调用 ctx.requireApproval() 弹出确认框
8. 用户确认 → action 继续执行，返回 result
9. action-executor → POST /api/client-tools/complete 回传结果
10. Gateway → resolve waitForClient() Promise
11. MCP tool handler → 返回结果给 Agent
```

### navigate_to 后 action 列表变化

```
1. Agent → GUI_execute(id, 'navigate_to', { url: '/workspace/abc/chat' })
2. 路由切换 → 旧页面组件 unmount → useActionProvider cleanup → action 从 store 移除
3. 新页面组件 mount → useActionProvider 注册新 action → store 更新
4. 返回 navigate_to 结果: { success: true }
5. Agent → GUI_execute(id, 'list_actions', {})
6. 返回新页面的 action 列表
```

## 文件结构

```
apps/desktop/src/
├── stores/
│   └── action-store.ts              # Zustand action 注册表
├── hooks/
│   └── use-action-provider.ts       # 组件注册 hook
├── lib/
│   └── action-system/
│       ├── index.ts
│       ├── types.ts                 # ActionDef, ActionResult, ExecutionContext 等类型
│       ├── action-executor.ts       # 执行引擎（处理 SSE event）
│       ├── execution-context.ts     # ctx 工厂函数
│       ├── builtins.ts              # 内置 action 实现
│       └── errors.ts                # UserCancelledException 等
├── components/
│   └── overlay/
│       └── layers/
│           └── presentation-provider.tsx  # Presentation 改造为 action_provider
│
packages/core/src/
├── executors/chat/
│   └── sdk-mcp-servers/
│       └── gui-action.ts            # GUI_execute MCP tool
```

## 错误处理

所有错误通过 `ClientToolResult` 的 `isError: true` 标记，错误信息放在 `content[0].text` 中：

| 场景 | 返回 |
|------|------|
| action 不存在 | `{ content: [{ type: 'text', text: 'action_not_available: chat.submit is not registered' }], isError: true }` |
| action 在执行期间被注销 | `{ content: [{ type: 'text', text: 'action_unavailable_during_execution' }], isError: true }` |
| 用户取消审批 | `{ content: [{ type: 'text', text: 'user_cancelled' }], isError: true }` |
| action 执行超时 | clientToolCompletionRegistry 内置超时机制，超时返回 timeout error |
| payload 不符合 input_schema | `{ content: [{ type: 'text', text: 'validation_error: missing required field "text"' }], isError: true }` |

## 约束与边界

- **单客户端假设**: 当前 GUI_id 等价于 session_id，未来多客户端时扩展
- **同步执行**: 一个 session 同时只能有一个 GUI_execute 在等待（复用现有 FIFO 队列）
- **引用稳定性**: useActionProvider 的 actions 参数需要引用稳定（useMemo），否则每帧重新注册
- **不做 schema 自动生成**: action 的 input_schema 由开发者手写，不从 TypeScript 类型自动推导
