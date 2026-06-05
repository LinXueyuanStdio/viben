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
5. 保证多 workspace、多 tab、多 iframe 同时存在时，action 不会串到错误页面实例。

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
- `register()` 必须先写入 SDK 本地 registry；即使父级尚未发送 `viben-page-init`，也不得丢失注册。
- `register()` 返回一个 unsubscribe 函数，调用后注销该 namespace。
- 每个 action 定义包含：
  - `description: string`
  - `input_schema?: object`
  - `output_schema?: object`
  - `execute: (payload, context) => Promise<ClientToolResult> | ClientToolResult`

SDK 只把 `description`、`input_schema`、`output_schema` 等可序列化元数据发给父级。`execute` 函数留在 iframe 内部执行。

### `VibenPage.actions.list()`

返回当前 iframe SDK 本地 registry 中的 action 元数据，方便页面作者调试。

### `VibenPage.actions.ready`

`Promise<boolean>`，当页面嵌入 Desktop 并完成 `viben-page-init` 后 resolve `true`。独立打开页面时 resolve `false`，不会因为缺少父级而报错；`actions.register()` 仍然只登记本地 registry。

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

`requireApproval()` 的语义为：确认时 resolve `true`；用户取消、父级不可用、超时或父级返回错误时 reject。页面作者不应依赖 resolve `false` 分支。

## Desktop 注册命名

Desktop 桥接层把 iframe action 注册到现有 `ActionStore`。完整 action 名格式：

```
page.<workspace_key>.<page_key>.<namespace>.<action>
```

这里 `page` 是 Desktop 侧系统保留 namespace，禁止普通组件或页面 bridge 以外的代码注册 `useActionProvider("page", ...)`。

- `workspace_key`: 优先使用 `workspaceId`；如果桥接层拿不到 `workspaceId`，使用 `workspacePath` 的稳定短 hash。
- `page_key`: 对 `page.slug` 做稳定编码。slug 可能包含 `/` 等路径字符，不能直接拼入 action 名。编码结果必须只包含 `[a-zA-Z0-9_-]`。
- `namespace` 与 `action` 也必须只包含 `[a-zA-Z0-9_-]`。

例如 workspace key 为 `main`、页面 slug 为 `my-dashboard`，页面内注册：

```js
VibenPage.actions.register("todo", { add_item: { ... } });
```

agent 调用：

```json
{
  "action": "page.main.my-dashboard.todo.add_item",
  "payload": { "text": "Ship action bridge" }
}
```

在 `ActionStore` 内部注册时，namespace 为 `page`，action 短名称为 `<workspace_key>.<page_key>.<namespace>.<action>`。这样能复用现有 `ActionStore` 的 `namespace.name` 解析规则，不需要修改 `ActionStore` 命名模型，同时避免不同 workspace 或不同页面 slug 冲突。

## postMessage 协议

所有消息只在当前 iframe 与父级 Desktop 之间通信。Desktop 必须同时校验：

- `event.origin === gatewayOrigin`
- `event.source === iframeRef.current?.contentWindow`

页面 SDK 继续校验：

- `event.origin === location.origin`
- `event.source === window.parent`

所有 `request_id` 必须由发送方用 `crypto.randomUUID()` 生成；不支持时使用足够随机的 fallback。接收方 pending map 的实际 key 必须至少包含 `iframe_instance_id + request_id`，result/approval result 只能消费一次。超时、reload、unmount 后到达的迟到消息必须忽略。

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
4. action 短名称为 `<workspace_key>.<page_key>.<namespace>.<action>`。
5. 发送 `viben-page-actions-register-result` ack，包含 accepted/rejected action 列表与拒绝原因。

```typescript
interface PageActionsRegisterResultMessage {
  type: "viben-page-actions-register-result";
  request_id: string;
  accepted: string[];
  rejected: Array<{ action: string; reason: string }>;
}
```

父级必须限制注册规模：

- 每个 iframe 最多 50 个 action。
- `description` 最大 2000 字符。
- `input_schema` / `output_schema` JSON 序列化后单个最大 32KB。
- namespace/action/page_key/workspace_key 单段最大 80 字符。
- 无效 action 被拒绝并通过 ack 返回原因，不影响同一消息中其他有效 action。

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
  result: ClientToolResult;
  diagnostic_error?: string;
}
```

父级 `ActionDef.execute()` 等待该结果，并把 `result` 作为普通 action result 返回给 `handleGUIExecute()`。SDK 必须永远返回 `result` 字段；错误也标准化为 `{ content: [...], isError: true }`。`diagnostic_error` 只用于 console/debug，不参与 agent 可见结果。

### ClientToolResult 标准化

iframe SDK 对 action 返回值做以下标准化：

| execute 返回值 | 标准化结果 |
| --- | --- |
| `ClientToolResult` 且 `content` 为数组 | 原样返回，只保留 `content`、`structuredContent`、`isError` |
| `string` | `{ content: [{ type: "text", text: value }] }` |
| 普通对象 | `{ content: [{ type: "text", text: JSON.stringify(value) }], structuredContent: value }` |
| `undefined` / `null` | `{ content: [{ type: "text", text: "ok" }], structuredContent: { ok: true } }` |
| 抛出错误 | `{ content: [{ type: "text", text: "execution_error: <message>" }], isError: true }` |

页面 JS API 使用 camelCase 字段，例如 `structuredContent`、`toolUseId`、`pageSlug`。postMessage payload、Gateway query/file 字段使用 snake_case，例如 `request_id`、`tool_use_id`、`workspace_path`。

`output_schema` 校验对象为 `structuredContent`；如果 action 没有返回 `structuredContent`，则跳过 output schema 校验并在父级 console warn。

### iframe 到父级：approval 请求

```typescript
interface PageActionApprovalRequestMessage {
  type: "viben-page-action-approval-request";
  request_id: string;
  execute_request_id: string;
  message: string;
  options?: ApprovalOptions;
}
```

父级只接受活跃 action execution 内的 approval 请求。`execute_request_id` 必须匹配当前 iframe 的 pending execute request，否则直接返回错误或忽略。父级调用该 execute 对应的 Desktop `ExecutionContext.requireApproval()`，然后回复：

```typescript
interface PageActionApprovalResultMessage {
  type: "viben-page-action-approval-result";
  request_id: string;
  execute_request_id: string;
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

扩展后，SDK 必须在 ready/init 前缓存注册请求；收到 init 后必须全量重同步当前 action 元数据，避免父级错过早期注册。

### 独立打开页面

页面不在 iframe 中打开时：

- `VibenPage.actions.register()` 只登记本地 registry，不 postMessage，不报错。
- `VibenPage.actions.unregister()` 更新本地 registry。
- `VibenPage.actions.list()` 正常返回本地 action 元数据。
- `context.requireApproval()` 不可用，调用时 reject `page_action_bridge_unavailable`。
- 不保留任何等待父级响应的 pending request。

### iframe reload

`StaticPagePreview` 的 `iframeKey` 变化会重建 iframe。父级需要：

- 在 iframe load 前清理旧 iframe provider。
- 在组件 unmount 时清理全部由该 iframe 注册的 provider。
- 新 iframe ready 后重新接收注册消息。
- reload/unmount 时立即清理该 iframe instance 的所有 pending execute 与 pending approval，并让等待中的 `ActionDef.execute()` 返回 `page_action_unavailable` 或 `page_action_cancelled`，不能悬挂到 30 秒超时。

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
- 注册消息中 action 被拒绝：父级通过 register ack 返回原因，SDK 在页面 console 输出 namespace/action 和原因。
- action 不存在：iframe 返回 `isError: true`。
- action execute 抛错：SDK 捕获并返回 `execution_error: ...`。
- action 返回非对象结果：SDK 包装为文本结果。
- 父级找不到当前 iframe：Desktop action 返回 `page_action_unavailable`。
- origin/source 校验失败：直接忽略消息，不返回错误。
- `request_id` 重复、已消费或已超时：忽略迟到消息，并在 debug 模式下 console warn。

## 安全约束

1. 只允许当前 `StaticPagePreview` 持有的 iframe 注册 action。
2. 父级不接受 `event.source` 不匹配的消息。
3. 父级 targetOrigin 使用 gateway origin，禁止 `"*"`。
4. SDK targetOrigin 使用 `location.origin`。
5. action 名、namespace、workspace_key、page_key 只接受简单标识符段，必须匹配 `^[a-zA-Z0-9_-]+$`；完整名称由 Desktop 组装，页面不能伪造 `page.<workspace_key>.<page_key>` 前缀。
6. 函数不跨 iframe 传输，只传元数据和执行请求。
7. `page` 是系统保留 namespace。

## 测试策略

### SDK 单元测试

由于 `packages/core/vitest.config.ts` 只包含 `src/**/*.test.ts` 且默认 environment 为 `node`，SDK asset 测试必须放到可执行位置，例如：

- 新增 `packages/core/src/page/sdk/viben-page-sdk.asset.test.ts`
- 测试中用 `jsdom` 或最小 window/document harness 读取并执行 `packages/core/assets/viben-page-sdk.js`
- 单测文件显式标注 `// @vitest-environment jsdom`，或在测试内构造 VM/harness

覆盖：

- register 发送 `viben-page-actions-register`。
- unregister 发送 `viben-page-actions-unregister`。
- execute 消息能调用页面内 action，并返回 `viben-page-action-result`。
- `execute(payload, context)` 能收到 `payload` 和 `context`。
- ready/init 前注册不会丢失，init 后会全量同步。
- standalone 下 register/list/unregister 不报错，`requireApproval()` reject `page_action_bridge_unavailable`。
- `context.requireApproval()` 能发送带 `execute_request_id` 的 approval request，并等待 approval result。
- approval 取消、父级 error、错误 request_id、并发多个 approval request 都有覆盖。
- execute 抛错时返回 `isError: true`。
- `string`、普通对象、`undefined`、错误 `ClientToolResult` 都按标准化表处理。

### Desktop 单元测试

桥接逻辑必须抽成独立可测模块，例如：

- `apps/desktop/src/pages/apps/components/page-action-bridge.ts`

该模块负责 source/origin 校验、provider 注册、execute request/result、approval request/result、timeout、reload/unmount cleanup。React 组件只负责创建 iframe ref、实例化 bridge、转发 message/onLoad/unmount。

桥接模块单测覆盖：

- 只接受当前 iframe source 与 gateway origin。
- 注册消息会调用 `ActionStore.register()`，名称为 `page.<workspace_key>.<page_key>.<namespace>.<action>`。
- slug 含 `/` 等字符时会生成稳定 `page_key`。
- action 数量、description 长度、schema 大小、命名非法时会拒绝并 ack。
- unmount/reload 会 unregister provider。
- unmount/reload during execute 会立即返回 `page_action_unavailable` 或 `page_action_cancelled`，并清理 timer。
- Desktop action execute 会 postMessage 到 iframe，并等待 result。
- 超时返回 error result。
- approval request 必须绑定 active `execute_request_id`。

React 层测试只覆盖：

- `StaticPagePreview` 为 HTML/fallback iframe 时创建 bridge。
- iframe `onLoad` 会清理旧 instance 并重新绑定当前 iframe。
- 组件 unmount 会 dispose bridge。

### 集成验证

手动或 e2e 验证：

1. 创建 static page，引用 `viben-page-sdk.js`。
2. 页面注册一个 `todo.add_item` action。
3. 在 chat popup 中让 agent 调用 `list_actions`。
4. 确认能看到 `page.<workspace_key>.<page_key>.todo.add_item`。
5. 让 agent 使用 `GUI_execute` 调用该 action。
6. 确认页面 DOM 状态更新，并且 agent 收到 action result 后继续回答。

### 验证命令

实现完成后至少运行：

```bash
pnpm --filter @viben/core test
pnpm --filter @viben/desktop test
pnpm --filter @viben/desktop typecheck
pnpm typecheck
```

如果当前工作区已有与本功能无关的 lockfile 或其他包状态导致命令失败，需要记录失败原因，并至少运行本功能相关测试文件的定向命令。

## 影响文件

- `packages/core/assets/viben-page-sdk.js`
- `apps/desktop/src/pages/apps/components/static-page-preview.tsx`
- 必须新增：`apps/desktop/src/pages/apps/components/page-action-bridge.ts`
- 新增测试：`apps/desktop/src/pages/apps/components/page-action-bridge.test.ts`
- 新增测试：`packages/core/src/page/sdk/viben-page-sdk.asset.test.ts`
- 更新 static page 模板：`packages/core/templates/pages/static-html/index.html.hbs`
- 更新 create-page 指导文档或模板说明，确保新生成页面默认知道如何引入 SDK 与注册 action。
- 可选新增测试：`apps/desktop/src/pages/apps/components/static-page-preview.test.tsx`

## 开放决策

本设计固定以下决策：

- action 签名为 `execute(payload, context)`。
- Desktop action 完整名为 `page.<workspace_key>.<page_key>.<namespace>.<action>`。
- 本阶段只支持 static HTML iframe。
- 默认 action 执行超时为 30 秒。
- `page` namespace 为系统保留。
- SDK 测试必须放在现有 test include 能执行的位置，并使用 jsdom 或等价 harness。

暂无待定项。
