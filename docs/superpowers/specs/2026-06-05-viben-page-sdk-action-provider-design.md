# Viben Page SDK Action Provider 设计

> 扩展现有 `viben-page-sdk.js`，让 workspace static page 可以在 iframe 内注册 GUI action，并允许 agent 通过 `GUI_execute` 操作页面内部状态。

## 背景

当前 Desktop 已有通用 GUI action 系统：

- Desktop 组件通过 `useActionProvider(namespace, actions)` 注册 action。
- `GUI_execute` MCP tool 会把 tool_use 事件交给前端执行。
- 前端 `handleGUIExecute()` 优先执行内置 action，否则调用 `ActionStore.execute()`。
- action 执行结果通过 `/api/client-tools/complete` 回传 gateway，再返回给 agent。

workspace static page 目前通过 `StaticPagePreview` iframe 加载 gateway 的 `/api/page/serve`，页面端 SDK `/api/page/_sdk/v1/viben-page-sdk.js` 只支持主题同步和 ready/init 通信。缺口是：iframe 内部页面无法把自身可操作能力暴露给 Desktop 的 action registry。

## 目标

1. 扩展现有 `viben-page-sdk.js`，提供页面端 action 注册 API。
2. 让 iframe 内注册的 action 自动桥接到 Desktop 的 `ActionStore`。
3. 让 agent 可以通过 `GUI_execute` 调用这些页面 action，从而操作新生成页面的内部状态。
4. 保持当前 `GUI_execute`、`useActionProvider`、`ActionStore` 和 client-tool completion 管道不变。

## 非目标

- 不新增独立 npm workspace 包。
- 不改变 `GUI_execute` MCP tool 的入参结构。
- 不允许跨 origin 或非当前 iframe 注册/执行 action。
- 不为 server/proxy page 做完整桥接；本阶段聚焦现有 static HTML iframe。

## 页面端 API

页面作者通过现有 SDK 全局对象注册 action：

```html
<script src="/api/page/_sdk/v1/viben-page-sdk.js"></script>
<script>
  VibenPage.actions.register("todo", {
    add_item: {
      description: "Add an item to the todo list",
      input_schema: {
        type: "object",
        properties: {
          text: { type: "string" }
        },
        required: ["text"]
      },
      execute: async (payload, context) => {
        await context.requireApproval('Add "' + payload.text + '"?');
        addTodo(payload.text);
        return {
          content: [{ type: "text", text: "added" }],
          structuredContent: { ok: true }
        };
      }
    }
  });
</script>
```

### `VibenPage.actions.register(namespace, actions)`

- `namespace`: 页面内 namespace，必须是非空字符串。
- `actions`: action 名到定义的映射。
- 每个 action 定义包含：
  - `description: string`
  - `input_schema?: object`
  - `output_schema?: object`
  - `execute: (payload, context) => Promise<ClientToolResult> | ClientToolResult`

SDK 只把 `description`、`input_schema`、`output_schema` 等可序列化元数据发给父级。`execute` 函数留在 iframe 内部执行。

### `VibenPage.actions.unregister(namespace?)`

- 传入 `namespace` 时注销该 namespace 下所有 action。
- 不传入时注销当前页面 SDK 注册过的所有 action。
- iframe unload 时 SDK 自动通知父级注销。

### Page Action Context

iframe action 的 `execute(payload, context)` 第二个参数为：

```typescript
interface PageActionContext {
  sessionId: string;
  toolUseId: string;
  action: string;
  namespace: string;
  pageSlug: string;
  workspacePath: string | null;
  requireApproval: (message: string, options?: ApprovalOptions) => Promise<boolean>;
}
```

`requireApproval()` 不直接跨 iframe 传递函数。SDK 内部通过 postMessage 请求父级执行 Desktop 现有 approval dialog，并把确认结果返回给 iframe action。

## Desktop 注册命名

Desktop 桥接层把 iframe action 注册到现有 `ActionStore`。完整 action 名格式：

```
page.<slug>.<namespace>.<action>
```

例如页面 slug 为 `my-dashboard`，页面内注册：

```js
VibenPage.actions.register("todo", { add_item: { ... } });
```

agent 调用：

```json
{
  "action": "page.my-dashboard.todo.add_item",
  "payload": { "text": "Ship action bridge" }
}
```

这里 `page` 是 Desktop 侧统一 namespace，`<slug>.<namespace>.<action>` 是 action 的短名称。这样能复用现有 `ActionStore` 的 `namespace.name` 解析规则，不需要修改 `ActionStore` 命名模型。

## postMessage 协议

所有消息只在当前 iframe 与父级 Desktop 之间通信。Desktop 必须同时校验：

- `event.origin === gatewayOrigin`
- `event.source === iframeRef.current?.contentWindow`

页面 SDK 继续校验：

- `event.origin === location.origin`

### 页面到父级：注册 action

```typescript
interface PageActionsRegisterMessage {
  type: "viben-page-actions-register";
  request_id: string;
  namespace: string;
  actions: Record<string, {
    description: string;
    input_schema?: object;
    output_schema?: object;
  }>;
}
```

父级收到后：

1. 生成 provider id，例如 `page:<slug>:<iframe_instance_id>:<namespace>`。
2. 把每个 action 转换为 `ActionDef`。
3. 注册到 `ActionStore.register(providerId, "page", defs)`。
4. action 短名称为 `<slug>.<namespace>.<action>`。

### 页面到父级：注销 action

```typescript
interface PageActionsUnregisterMessage {
  type: "viben-page-actions-unregister";
  request_id: string;
  namespace?: string;
}
```

父级按 namespace 或 iframe 实例注销相关 provider。

### 父级到页面：执行 action

```typescript
interface PageActionExecuteMessage {
  type: "viben-page-action-execute";
  request_id: string;
  namespace: string;
  action: string;
  payload: unknown;
  context: {
    session_id: string;
    tool_use_id: string;
    full_action: string;
    page_slug: string;
    workspace_path: string | null;
  };
}
```

iframe SDK 收到后：

1. 查找 `namespace/action` 对应的本地 execute 函数。
2. 构造 `PageActionContext`。
3. 调用 `execute(payload, context)`。
4. 将结果标准化为 `ClientToolResult` 后回传。

### 页面到父级：执行结果

```typescript
interface PageActionResultMessage {
  type: "viben-page-action-result";
  request_id: string;
  result?: ClientToolResult;
  error?: string;
}
```

父级 `ActionDef.execute()` 等待该结果，并把它作为普通 action result 返回给 `handleGUIExecute()`。

### iframe 到父级：approval 请求

```typescript
interface PageActionApprovalRequestMessage {
  type: "viben-page-action-approval-request";
  request_id: string;
  message: string;
  options?: ApprovalOptions;
}
```

父级调用 Desktop 现有 `ExecutionContext.requireApproval()`，然后回复：

```typescript
interface PageActionApprovalResultMessage {
  type: "viben-page-action-approval-result";
  request_id: string;
  approved: boolean;
  error?: string;
}
```

如果用户取消，iframe SDK 的 `context.requireApproval()` 抛出错误，页面 action 可以捕获；未捕获时 SDK 将返回 `isError: true`。

## 生命周期

### iframe ready/init

现有流程保持：

1. iframe 加载后发送 `viben-page-ready`。
2. Desktop 回复 `viben-page-init`，包含 theme 与 `workspace_path`。
3. SDK 保存 `workspacePath`。

扩展后，SDK 可以在 ready 前缓存注册请求；收到 init 后再次同步当前 action 元数据，避免父级错过早期注册。

### iframe reload

`StaticPagePreview` 的 `iframeKey` 变化会重建 iframe。父级需要：

- 在 iframe load 前清理旧 iframe provider。
- 在组件 unmount 时清理全部由该 iframe 注册的 provider。
- 新 iframe ready 后重新接收注册消息。

### action 执行超时

父级桥接 action 等待 iframe result 的默认超时为 30 秒。超时返回：

```json
{
  "content": [{ "type": "text", "text": "page_action_timeout: ..." }],
  "isError": true
}
```

SDK 侧也清理 pending request，避免内存泄漏。

## 错误处理

- 注册消息缺少 namespace、action 名或 description：父级忽略该 action，并在 console warn。
- action 不存在：iframe 返回 `isError: true`。
- action execute 抛错：SDK 捕获并返回 `execution_error: ...`。
- action 返回非对象结果：SDK 包装为文本结果。
- 父级找不到当前 iframe：Desktop action 返回 `page_action_unavailable`。
- origin/source 校验失败：直接忽略消息，不返回错误。

## 安全约束

1. 只允许当前 `StaticPagePreview` 持有的 iframe 注册 action。
2. 父级不接受 `event.source` 不匹配的消息。
3. 父级 targetOrigin 使用 gateway origin，禁止 `"*"`。
4. SDK targetOrigin 使用 `location.origin`。
5. action 名只接受简单标识符段，建议正则为 `^[a-zA-Z0-9_-]+$`；完整名称由 Desktop 组装，页面不能伪造 `page.<slug>` 前缀。
6. 函数不跨 iframe 传输，只传元数据和执行请求。

## 测试策略

### SDK 单元测试

新增或扩展 `viben-page-sdk.js` 测试，覆盖：

- register 发送 `viben-page-actions-register`。
- unregister 发送 `viben-page-actions-unregister`。
- execute 消息能调用页面内 action，并返回 `viben-page-action-result`。
- `execute(payload, context)` 能收到 `payload` 和 `context`。
- `context.requireApproval()` 能发送 approval request 并等待 approval result。
- execute 抛错时返回 `isError: true`。

### Desktop 单元测试

覆盖 `StaticPagePreview` 的桥接逻辑：

- 只接受当前 iframe source 与 gateway origin。
- 注册消息会调用 `ActionStore.register()`，名称为 `page.<slug>.<namespace>.<action>`。
- unmount/reload 会 unregister provider。
- Desktop action execute 会 postMessage 到 iframe，并等待 result。
- 超时返回 error result。

### 集成验证

手动或 e2e 验证：

1. 创建 static page，引用 `viben-page-sdk.js`。
2. 页面注册一个 `todo.add_item` action。
3. 在 chat popup 中让 agent 调用 `list_actions`。
4. 确认能看到 `page.<slug>.todo.add_item`。
5. 让 agent 使用 `GUI_execute` 调用该 action。
6. 确认页面 DOM 状态更新，并且 agent 收到 action result 后继续回答。

## 影响文件

- `packages/core/assets/viben-page-sdk.js`
- `apps/desktop/src/pages/apps/components/static-page-preview.tsx`
- 可选新增：`apps/desktop/src/pages/apps/components/page-action-bridge.ts`
- 可选新增测试：`apps/desktop/src/pages/apps/components/static-page-preview.test.tsx`
- 可选新增测试：`packages/core/assets/viben-page-sdk.test.*`

## 开放决策

本设计固定以下决策：

- action 签名为 `execute(payload, context)`。
- Desktop action 完整名为 `page.<slug>.<namespace>.<action>`。
- 本阶段只支持 static HTML iframe。
- 默认 action 执行超时为 30 秒。

暂无待定项。
