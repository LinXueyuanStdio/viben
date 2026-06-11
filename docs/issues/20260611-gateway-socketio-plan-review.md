# Gateway Client Action Socket.io Plan Review

**Date:** 2026-06-11
**Reviewed Files:**
- spec: `docs/superpowers/specs/2026-06-11-gateway-client-action-socketio-design.md`
- plan: `docs/superpowers/plans/2026-06-11-gateway-client-action-socketio.md`

---

## 1. 架构设计评审

### 关键问题

1. **clientId 设计不明确**
   - 跨设备场景需要 clientId 与设备/会话解耦
   - 建议区分 `workspaceId`（持久）和 `deviceId`（临时），否则同一用户多设备会注册冲突

2. **action 所有权模糊**
   - ActionEntry 只存 `socketId` 不存 `deviceId`
   - socket 断线重连后 action 归属丢失
   - 需加 `clientId + namespace` 联合索引

3. **生命周期缺失**
   - 断线时 action 应保留还是清除未定义
   - 建议：断线 → grace period（30s）→ 超时才清除，避免短暂断线导致 MCP 找不到 action

4. **Map 嵌套扩展性差**
   - `clientStore[clientId].sockets[socketId]` 三层嵌套
   - 多 Gateway 场景无法水平扩展
   - 建议抽象为接口（可换 Redis）

---

## 2. 实现细节评审

### 内存泄漏风险（高优先级）

1. **requestId TTL 60秒**
   - 需要确认是否有定时清理机制
   - 若仅靠手动删除，异常中断时会泄漏
   - 建议用 `setTimeout` + WeakRef 或定期扫描清理过期 requestId

2. **pendingExecutes Map**
   - 执行超时后需确保一定能删除对应条目
   - 应在 finally 块中清理

### 错误处理缺口

1. socket 断开时清理 actions：若断开发生在 action 执行中途，需取消对应 pending promise，否则回调永远不会被调用
2. approval 超时后需主动 reject，不能仅 resolve(false)，调用方需区分"拒绝"和"超时"

### 超时配置

- 30秒硬编码不合理，不同 action 耗时差异大
- 建议 action 注册时允许传入 `timeout?: number`，缺省值30秒

### 幂等性

- FNV-1a 64位碰撞率在高频场景下可接受
- 但 action hash 应包含 `clientId + actionName + params` 的组合
- 单纯 content hash 可能导致不同客户端相同内容误判为同一 action

---

## 3. 安全性评审

### 高风险

1. **认证机制缺失**
   - `registerClientWithId` 直接接受 client 提供的任意 UUID，无所有权证明
   - 任何知道 `client_desktop_abc` ID 的攻击者可冒充该设备注册恶意 action
   - **缓解**：注册时引入 HMAC 挑战-响应，或使用 Ed25519 密钥对签名对 clientId 进行所有权证明

2. **授权控制缺失**
   - 跨设备调用只靠 `callerClientId` header 自声明
   - Gateway 不验证调用方是否被授权操作目标 clientId
   - **缓解**：跨 client 调用需目标 client 预先声明哪些 clientId 被信任，或引入 capability token

### 中风险

3. **Payload 验证缺失**
   - `payload` 透传给 Page 的 execute 函数，仅靠 Page 自身 schema 校验
   - Gateway 不做强制验证，恶意大 payload 或类型攻击可绕过 Page 防线
   - **缓解**：Gateway 在转发前按 `ActionEntry.inputSchema` 做 JSON Schema 校验并截断超大 payload（建议上限 1MB）

4. **DoS 风险**
   - 无速率限制
   - 单个 socket 可无限循环调用 `action:register` 或高频 emit `action:result`
   - **缓解**：每个 clientId 限制最大 action 数（如 1000），每个 socket 的事件速率限制（如 100 req/s）

### 低风险

5. **敏感数据泄露**
   - `action:approval:request` 的 `message` 字段可能包含敏感信息
   - `client:init` 返回的 `workspacePath` 会暴露给所有连接的 socket
   - **缓解**：approval message 长度限制，workspacePath 仅发给 source=main_window 的 socket

---

## 4. 集成评审

### 关键问题

1. **依赖影响（高风险）**
   - `packages/core` 已有 `@fastify/websocket`，Socket.io server 是独立依赖（约 200KB+）
   - 需确认 socket.io 不会被打包进浏览器端 bundle

2. **测试文件遗漏**
   - `page-action-bridge.ts` 有独立测试文件 `page-action-bridge.test.ts`
   - 删除前必须同步删除测试

3. **初始化顺序**
   - `client-side-mcp-server.ts` 改用 `clientStore` 需要确保 `clientStore` 在 gateway 启动时已初始化
   - `state.ts` 中 `AppState` 的初始化顺序需核查

4. **类型导出**
   - 新的 `ClientState` 类型和 Socket.io 事件类型需加入 `gateway/index.ts` 的导出

---

## 修复优先级

| 优先级 | 问题 | 修复方案 |
|--------|------|----------|
| P0 | clientId 认证 | 使用 Ed25519 签名验证 clientId 所有权 |
| P0 | 内存泄漏 | 添加定时清理和 finally 块保护 |
| P1 | socket 断线处理 | 添加 grace period，取消 pending promises |
| P1 | 超时可配置 | action 注册时支持自定义 timeout |
| P1 | 速率限制 | 添加 action 数量限制和事件速率限制 |
| P2 | payload 校验 | Gateway 层 JSON Schema 校验 |
| P2 | 类型导出 | 补充类型导出 |
