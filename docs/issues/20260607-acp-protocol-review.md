# ACP 协议与实现 Review 问题清单

> 来源：2026-06-07 多子智能体只读 review。本文用于跟踪 `/ws/agent/acp` 迁移前需要修复的问题。

## 状态说明

- `[ ]` 未处理
- `[~]` 修复中
- `[x]` 已修复并验证
- `[!]` 暂缓或需重新设计

## Critical

- [x] **queued steer prompt 被标记 consumed 后未注入给 Agent**
  - 影响：运行中追加消息会静默丢失；客户端看到 `session/prompt/consumed` 后也无法再取消。
  - 位置：
    - `/root/viben/packages/core/src/acp/ops/session-manager.ts`
  - 现象：
    - 普通 `session/prompt` 路径消费 queued steer 后仍只发送原始 `request.prompt`。
    - 任意工具结束路径只消费 queued steer，没有把内容交给后端。
    - 客户端工具回填路径消费 queued steer 后只完成工具结果，没有注入 steer。
  - 期望：
    - Agent 每次恢复运行前消费 queued steer 时，必须把 consumed steer 内容注入本次恢复上下文。
  - 修复：
    - 普通 `session/prompt` 执行前会把已消费 steer 合并进本次 backend prompt。
    - 客户端侧工具结果回填前会把已消费 steer 追加到 MCP `CallToolResult.content`。
    - 后端工具结束时如果存在 queued steer，会中断当前 turn，并把 steer 作为最高优先级恢复 prompt；恢复 prompt 真正开始前才标记 consumed。
    - 已补回归测试：
      - `injects queued steer prompts into the next normal agent prompt`
      - `injects queued steer prompts into the client tool result before resuming the agent`
      - `interrupts and resumes with queued steer prompts when a backend tool call finishes with completed/failed`

- [x] **SQLite steer 消费不是原子操作**
  - 影响：多 worker 或并发连接下可能重复发送 consumed 通知，未来注入实现后也可能重复注入。
  - 位置：
    - `/root/viben/packages/core/src/acp/ops/steer-prompt-store.ts`
  - 现象：
    - `SELECT queued ids -> UPDATE -> get` 不是单个原子消费流程；竞争失败方仍可能读到 `consumed` 并误认为自己消费成功。
  - 期望：
    - 只有成功把记录从 `queued` 更新为 `consumed` 的 worker 返回该记录。
  - 修复：
    - SQLite `consumeNext` / `consumeQueued` 会检查 UPDATE `changes`，只有实际完成 `queued -> consumed` 的 worker 返回记录。
    - 已补回归测试：竞争失败时不返回 consumed 记录。

## High

- [x] **example client 的 plan approval 没有闭环到 `session/elicitation`**
  - 影响：旧 `approve/reject plan` 迁移不完整；后端等待 elicitation 时，PlanApproval 按钮不会 resolve 该 JSON-RPC request。
  - 位置：
    - `/root/viben/packages/core/examples/acp-client/src/App.tsx`
    - `/root/viben/packages/core/examples/acp-client/src/acp-chat-adapter.ts`
    - `/root/viben/packages/core/examples/acp-client/src/acp-client.ts`
  - 期望：
    - plan approval 如果来自 elicitation，应通过 elicitation response 返回 accept/decline/cancel 和表单内容。
  - 修复：
    - example client 会把 plan-like `session/elicitation` 转换为 `pendingPlan`。
    - `PlanApproval` approve/reject 会优先 resolve 对应 elicitation；只有非 elicitation 来源的 plan 才回落到 steer 文本。

- [x] **example client 多个 pending server request 会错配 resolver**
  - 影响：并发 permission/elicitation request 到达时，后来的 resolver 覆盖前一个，首个 JSON-RPC request 可能永远不响应。
  - 位置：
    - `/root/viben/packages/core/examples/acp-client/src/App.tsx`
    - `/root/viben/packages/core/examples/acp-client/src/acp-chat-state.ts`
  - 期望：
    - pending request 与 UI step 应有稳定 id 绑定；或至少 queue 化 resolver，保证 UI 显示哪个 pending 就 resolve 哪个 request。
  - 修复：
    - permission / elicitation resolver 改为按 UI pending id 存储，用户操作当前展示的 pending item 时按 id resolve。
    - form-mode elicitation 使用 `elicitationId` 作为稳定 id；无 `elicitationId` 时同一个 request 只生成一次 pending id，避免 UI step 与 resolver 不一致。

- [x] **`session/interrupt` 仍可能卡在 `backend.cancel()`**
  - 影响：如果后端 cancel 不返回，interrupt request 仍会挂住。
  - 位置：
    - `/root/viben/packages/core/src/acp/ops/session-manager.ts`
  - 期望：
    - interrupt request 不等待无界 cancel；应有超时或 fire-and-log 行为。
  - 修复：
    - `session/interrupt` 改为异步触发 backend cancel，并记录失败，不等待无界 cancel。
    - 已补回归测试：`returns from interrupt without waiting for backend cancel to finish`。

- [x] **`_viben/client_tool_call` 文档与实现不一致**
  - 影响：按文档实现的客户端会返回错误 envelope。
  - 位置：
    - `/root/viben/docs/specs/modules/gateway/acp.md`
    - `/root/viben/packages/core/src/acp/types.ts`
    - `/root/viben/packages/core/src/acp/ops/session-manager.ts`
    - `/root/viben/packages/core/examples/acp-client/src/acp-client.ts`
  - 期望：
    - 文档写清请求字段为 `toolCallId`，响应 envelope 为 `{ sessionId, toolCallId, result }`。
  - 修复：
    - `docs/specs/modules/gateway/acp.md` 已同步 `toolCallId` 和响应 envelope。

- [x] **client-side bridge toolCallId 绑定存在并发错配风险**
  - 影响：并发 bridge tool 时，FIFO `shift()` 可能把错误 toolCallId 绑定给另一个工具。
  - 位置：
    - `/root/viben/packages/core/src/acp/ops/session-manager.ts`
  - 期望：
    - pending bridge tool call 按 tool name 或更稳定 key 匹配，不只 FIFO。
  - 修复：
    - pending bridge tool call 优先按 `toolName` 匹配 backend `toolCallId`，找不到时才回落 FIFO。
    - 已补回归测试：GUI/Bash backend tool call 乱序时按 tool name 绑定。

## Medium

- [x] **`session/prompt/cancel` / `session/prompt/view` not found 错误码与文档不一致**
  - 影响：文档写 `-32002 Resource not found`，实现可能返回 `-32603 Internal error`。
  - 位置：
    - `/root/viben/packages/core/src/acp/ops/session-manager.ts`
    - `/root/viben/packages/core/src/gateway/routes/agent-acp.ts`
    - `/root/viben/docs/specs/modules/gateway/acp.md`
  - 修复：
    - ACP route 的扩展方法层将业务层 `not found` 错误映射为 SDK `RequestError.resourceNotFound`，对应 JSON-RPC `-32002`。

- [x] **steer 消费是否按 `agent_id` 过滤不一致**
  - 影响：多智能体共享同一 ACP session 时可能消费错 steer。
  - 位置：
    - `/root/viben/docs/specs/modules/gateway/acp.md`
    - `/root/viben/packages/core/src/acp/ops/session-manager.ts`
    - `/root/viben/packages/core/src/acp/ops/steer-prompt-store.ts`
  - 决策：
    - 当前实现一个 ACP session 绑定一个智能体运行上下文，消费按 `session_id` 限定。
    - `agent_id` 用于审计、列表过滤和未来多智能体共享 session 扩展；未来支持多 Agent 共享 session 时再扩展消费条件为 `session_id + agent_id`。
  - 修复：
    - spec 已明确当前实现边界和未来扩展条件。

- [x] **example client 的 Viben 扩展字段仍使用 camelCase**
  - 影响：新客户端复制错误模式；未来移除兼容时会断。
  - 位置：
    - `/root/viben/packages/core/examples/acp-client/src/acp-client.ts`
  - 期望：
    - `session/prompt/steer` 使用 `agent_id`、`user_id`、`_meta`。
  - 修复：
    - core example ACP client 的 `session/prompt/steer` 已发送 `agent_id`、`user_id`、`_meta`。

- [x] **session id / resume 语义还不清晰**
  - 影响：后续 desktop/web 迁移可能混淆外层 ACP session id、后端 ACP session id、旧 SDK resume id 和 file storage `session_id`。
  - 位置：
    - `/root/viben/docs/specs/modules/gateway/acp.md`
    - `/root/viben/packages/core/src/acp/ops/session-manager.ts`
    - `/root/viben/packages/core/src/gateway/routes/agent-acp.ts`
  - 修复：
    - spec 已明确外层 ACP `sessionId`、后端 ACP session ID、持久化 `session_id` 的边界。
    - spec 已明确当前不实现 `session/resume`，客户端恢复 live connection 使用 `session/load`。

- [x] **缺少 `/ws/agent/acp` route-level 集成测试**
  - 影响：WebSocket JSON-RPC envelope、reverse request、notification 方向等无法被测试捕捉。
  - 覆盖建议：
    - `initialize -> session/new -> session/prompt`
    - `session/prompt/steer -> session/interrupt -> session/prompt/consumed`
    - `session/request_permission`
    - `session/elicitation`
    - `session/cancel`
    - `session/close` / reconnect / `session/load`
  - 修复：
    - 已新增 `/ws/agent/acp` route-level WebSocket JSON-RPC 集成测试，覆盖 `initialize`、`session/new`、`session/prompt/steer`、`session/prompt/view`、`session/prompt/cancel` 和 not-found `-32002` envelope。
    - 尚未覆盖真实 backend prompt 流、反向 `session/request_permission` / `session/elicitation` 和 `session/prompt/consumed` notification，后续可在可注入 fake backend 后补齐。

## Low

- [x] **文档中 `steer_consumed` 与当前实现主路径不一致**
  - 当前实现主路径保证 `session/prompt/consumed` notification；`session/update: steer_consumed` 仅是保留能力或示例。
  - 修复：
    - spec 已标注 `session/update: steer_consumed` 为保留/兼容扩展，主路径以 `session/prompt/consumed` 为准。

- [ ] **`session/prompt/consumed` 测试没有验证真实 JSON-RPC notification envelope**
  - 现有 test double 把 `notifyClient()` 映射成 fake `sessionUpdate` 形态。

- [x] **Esc 在 permission pending 时有键盘处理冲突**
  - 全局 Esc interrupt 与 `ExecApproval enableKeyboard` 的 Escape reject 可能同时触发。
  - 修复：
    - core example chat 模式内联 `ExecApproval` 禁用自身 Escape 监听，由全局 Esc 统一执行 interrupt。

- [x] **ACP 标准字段 camelCase 与 Viben 扩展字段 snake_case 的边界需更明确**
  - 文档应明确：
    - ACP SDK 标准字段保持 camelCase，例如 `sessionId`、`mcpServers`。
    - Gateway 查询参数、文件存储、Viben 扩展字段使用 snake_case。
  - 修复：
    - spec 已补充边界规则和示例字段。

- [x] **SQLite fallback 到 memory store 与文档“必须 SQL”表述不一致**
  - 如果允许 fallback，应在文档标注内存模式不提供跨连接/worker 可靠性。
  - 修复：
    - spec 已标注 SQL 是生产要求，memory fallback 只适合本地示例或降级运行，不提供跨连接/worker/重启可靠性。
