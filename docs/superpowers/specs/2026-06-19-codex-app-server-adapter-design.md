# Codex App Server Adapter 设计

## 背景

Viben 当前的 ACP Chat 路径是桌面端连接 Gateway 的 `/ws/agent/acp`，Gateway 内部通过 `AcpSessionManager` 启动具体 backend。`CODEX` 目前注册为 `codex-acp`，走通用 `SubprocessAcpBackendAdapter` 和 Agent Client Protocol SDK。

目标是当用户选择 Codex backend 时，不再依赖 `codex-acp` 适配层，而是由 Viben 自己启动 `codex app-server`，直接连接 Codex app-server JSON-RPC 协议，并把它适配成 Viben 现有的 ACP backend 接口。

## 目标

- `executor_type: CODEX` 默认启动 `codex app-server` stdio 进程。
- 保持桌面端和 Gateway `/ws/agent/acp` 对外协议不变。
- 复用 `AcpSessionManager` 的 session、prompt queue、steer prompt、取消、持久化和 client tool bridge 逻辑。
- 将 Codex app-server 的 thread、turn、item、approval 事件翻译为现有 ACP `session/update` 和 `requestPermission` 形状。
- 保留旧 `codex-acp` 的逃生入口，避免需要时无法回退。

## 非目标

- 第一版不让桌面端直接连接 Codex app-server。
- 第一版不实现完整 Codex rich-client UI，例如账号登录、模型列表、skills/apps 管理、thread history 管理。
- 第一版不支持 WebSocket 或 Unix socket transport；只支持 Viben 启动 stdio。
- 第一版不引入生成 schema 的构建步骤；类型先由局部 TypeScript union 和 runtime guard 维护。

## 推荐方案

新增一个 Codex app-server 专用 backend session，并让 `createDefaultAcpBackendAdapter()` 在解析到 Codex app-server executor 时走该实现。

保留现有 `AcpBackendAdapter` 接口：

```ts
interface AcpBackendSession {
  readonly backendSessionId: string;
  prompt(request: PromptRequest): Promise<PromptResponse>;
  cancel(): Promise<void>;
  close(): Promise<void>;
}
```

`AcpSessionManager` 不需要理解 Codex app-server。它仍然只调用 `start()`、`prompt()`、`cancel()`、`close()`。Codex adapter 内部负责把这些调用转换成 `thread/*` 和 `turn/*`。

## Executor 选择

- `CODEX`：新默认，启动 `codex app-server`。
- `CODEX_APP_SERVER`：显式选择 app-server，行为同 `CODEX`。
- `CODEX_ACP`：保留旧 `codex-acp` backend。

`agent_config.executor_config` 支持覆盖：

```yaml
executor_type: CODEX
executor_config:
  command: /absolute/path/to/codex
  args: ["app-server"]
  init_timeout_ms: 120000
  client_info:
    name: viben
    title: Viben
    version: 1.0.0
```

默认命令为 `codex app-server`。如果用户只覆盖 `command`，仍自动附加 `app-server`；如果用户覆盖 `args`，使用用户提供的完整 args。

## 组件设计

### `CodexAppServerJsonRpcClient`

职责：

- 启动子进程并用 stdio 读写 JSONL。
- 发送 JSON-RPC request/notification，wire 上不强制写 `jsonrpc: "2.0"`。
- 用递增 id 匹配 response。
- 分发 server notification 和 server-initiated request。
- 收集 stderr ring buffer，用于错误诊断。
- 在关闭时终止子进程并 reject pending request。

### `CodexAppServerBackendSession`

职责：

- 连接后发送 `initialize` request，再发送 `initialized` notification。
- `start()` 时根据 ACP `session/new` 或 `session/load` 调用 `thread/start` 或 `thread/resume`。
- `prompt()` 调用 `turn/start`，等待对应 `turn/completed` 后 resolve。
- `cancel()` 调用 `turn/interrupt`；如果当前 turn id 未知，则只标记本地取消并等待完成事件。
- `close()` 调用 `thread/unsubscribe`，然后关闭子进程。
- 维护 `threadId`、`sessionId`、当前 `turnId`、当前 prompt resolver、item 聚合状态。

### `codex-app-server-event-mapper`

职责：

- 把 Codex notification 转换成 ACP `SessionNotification`。
- 把 server approval request 转发到 `AcpConnection.requestPermission()`。
- 把 Codex turn 完成状态转换成 ACP SDK 支持的 `PromptResponse.stopReason`；失败 turn 走现有 `AcpSessionManager` error path，而不是返回非 ACP 的 `stopReason: "error"`。

## 数据流

1. 桌面端连接 `/ws/agent/acp`。
2. 桌面端发送 `session/new`，包含 `agent_config.executor_type: CODEX`。
3. `AcpSessionManager.ensureBackend()` 调用 default adapter。
4. adapter 识别 Codex app-server executor，启动 `codex app-server`。
5. adapter 发送：
   - `initialize`
   - `initialized`
   - `thread/start`
6. 桌面端发送 `session/prompt`。
7. `AcpSessionManager` 调用 backend `prompt()`。
8. adapter 发送 `turn/start`。
9. Codex app-server 持续发送 `turn/*` 和 `item/*` notification。
10. adapter 翻译为 ACP `session/update`，经 Gateway 推给桌面端。
11. `turn/completed` 到达后，adapter resolve `prompt()`。

## 事件映射

| Codex app-server | ACP update |
| --- | --- |
| `item/agentMessage/delta` | `agent_message_chunk` |
| `item/reasoning/summaryTextDelta` | `agent_thought_chunk` |
| `item/reasoning/textDelta` | `agent_thought_chunk` |
| `turn/plan/updated` | `plan` |
| `item/started` with `commandExecution` | `tool_call` |
| `item/completed` with `commandExecution` | `tool_call_update` |
| `item/started` with `fileChange` | `tool_call` |
| `item/completed` with `fileChange` | `tool_call_update` |
| `item/started` with `mcpToolCall` | `tool_call` |
| `item/completed` with `mcpToolCall` | `tool_call_update` |
| `thread/tokenUsage/updated` | `usage_update` |
| `turn/completed.status: completed` | resolve prompt with `stopReason: "end_turn"` |
| `turn/completed.status: interrupted` | resolve prompt with `stopReason: "cancelled"` |
| `turn/completed.status: failed` | emit `sessionUpdate: "error"` and reject the backend prompt |

未知 item 类型不丢弃，转换为系统文本类 update，方便调试。

## Approval 映射

Codex app-server approval 是 server-initiated JSON-RPC request。第一版支持：

- `item/commandExecution/requestApproval`
- `item/fileChange/requestApproval`

转换到现有 `requestPermission()`：

- `toolCallId` 使用 Codex `itemId`。
- `title` 使用命令、文件变更摘要或 item 类型。
- `options` 根据 Codex `availableDecisions` 生成，至少包含 accept、decline、cancel。
- 用户选择后映射回 Codex decision：
  - allow once -> `accept`
  - allow session -> `acceptForSession`
  - decline -> `decline`
  - cancel -> `cancel`

`acceptWithExecpolicyAmendment` 第一版只在 Codex request 明确提供 `proposedExecpolicyAmendment` 时暴露，否则不主动构造。

## 配置映射

`thread/start` 和 `turn/start` 参数来自 ACP request 与 agent config：

- `model` <- `agent_config.model`
- `cwd` <- session cwd
- `serviceName` <- `viben`
- `approvalPolicy` <- `agent_config.permission_mode` 或 `approval_mode` 的保守映射
- `sandboxPolicy` <- `sandbox_config` 和 workspace cwd
- `input` <- ACP prompt content blocks

ACP text block 映射为 Codex `{ type: "text", text }`。图片和 local image 可以按 Codex 支持的 input item 透传；无法识别的 block 转成文本摘要。

## 错误处理

- spawn 失败附带 command、args、cwd、stderr、PATH、安装提示。
- 初始化超时使用 `init_timeout_ms`。
- JSON parse 失败记录原始 line，并以 backend error 更新当前 session。
- Codex `turn/completed.status: failed` 转为 ACP `sessionUpdate: "error"` 并 reject 当前 backend prompt，由 `AcpSessionManager` 统一返回 JSON-RPC error。
- 子进程异常退出时 reject pending request，并推送错误 update。

## 测试计划

单元测试：

- JSON-RPC client 能匹配 response、分发 notification、处理 server request。
- `thread/start`、`thread/resume`、`turn/start`、`turn/interrupt` 请求参数正确。
- agent message delta、reasoning delta、plan、tool item、usage、error 的事件映射正确。
- approval request 能从 Codex decision 往返映射。
- `turn/completed` 的 completed/interrupted resolve 正确 stopReason，failed 走 error path。

集成测试：

- 用 fake Codex app-server 子进程脚本模拟 JSONL 协议，验证 Gateway ACP session 能完成一次 prompt。
- 验证 cancel 会发送 `turn/interrupt` 并让 prompt 返回 cancelled。

验证命令：

```bash
pnpm --filter @viben/core test -- src/acp/ops
pnpm --filter @viben/core typecheck
pnpm typecheck
```

如果全仓 typecheck 被无关改动阻塞，需要记录具体错误并至少保证 touched package 的测试与 typecheck 通过。

## 风险与约束

- Codex app-server 协议处在 rich-client 集成面，事件形状可能随 Codex 版本变化；第一版使用 defensive runtime guard。
- 现有 ACP UI 的 tool/update 模型比 Codex item union 粗，需要保留 raw payload 到 `_meta` 便于后续增强。
- WebSocket transport 是实验能力，不进入第一版。
- app-server account/auth 能力第一版不接 UI；依赖用户本地 Codex 已经完成认证。

## 交付标准

- `CODEX` backend 能由 Viben 启动 `codex app-server`。
- 桌面 ACP Chat 能发送 prompt、看到流式文本、工具/命令状态、审批请求和完成状态。
- Stop/interrupt 能中断当前 Codex turn。
- 旧 `CODEX_ACP` 仍能指向 `codex-acp`。
- 新增 adapter 有针对性测试，且 `@viben/core` typecheck 通过。
