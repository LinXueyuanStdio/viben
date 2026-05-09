# `useAgentConversation` Hook 设计评审报告

> 日期: 2026-05-09
> 文件: `apps/desktop/src/pages/conversation/hooks/use-agent-conversation.ts`
> 行数: 2439 行
> 审查方法: 4 个并行子 Agent 从架构/性能/可靠性/API 设计四个维度独立评审
> 参考项目: [AionUi](file:///Users/lxy/Documents/GitHub/others/AionUi) — 成熟的 AI 对话 UI 框架

---

## 综合评估

这是一个典型的 **God Hook** 反模式。2439 行代码承担了至少 10 个独立职责，严重违反单一职责原则。

### 关键数字

- **13 个 `useState`** — 过多独立状态点，相关状态未归组
- **12 个 `useRef`** — 大量用于绕过闭包问题的"逃逸舱"
- **377 行的 `handleSSEMessage`** — 巨型 switch-case，混合协议解析/状态更新/副作用
- **37 个返回字段** — 暴露内部实现细节，消费端需从中筛选
- **3 套传输实现** — SSE + WebSocket + Mock 完整重复
- **0 个纯函数提取** — 所有逻辑内联在 hook 中，无法独立测试

### 核心风险

| 风险等级 | 数量 | 说明 |
|----------|------|------|
| P0 (有 Bug) | 3 | fetch 缺 signal、并发无保护、WS 断连状态泄漏 |
| P1 (性能) | 3 | 流式高频 re-render、artifact 双重渲染、O(n) 消息扫描 |
| P2 (可维护性) | 4 | Transport 三路分叉、状态散乱、工具拦截紧耦合 |
| P3 (健壮性) | 4 | 重连策略弱、无 visibility 处理、task 孤儿化 |

---

## 一、架构与职责 (Architecture)

### 当前职责清单

| # | 职责 | 行号范围 | 建议拆分为 |
|---|------|---------|-----------|
| 1 | Gateway 连接管理 | L335-385 | `useGatewayConnection()` |
| 2 | SSE 流解析与消息分发 | L391-768 | `useSSEMessageHandler()` |
| 3 | WebSocket 连接生命周期 | L770-967 | `useWebSocketConnection()` |
| 4 | WebSocket 消息收发 | L972-1251 | 合并入 WS 连接 |
| 5 | SSE 模式发送逻辑 | L1276-1441 | `useSSETransport()` |
| 6 | Mock 模式 | L1446-1610 | `useMockConversation()` |
| 7 | Plan 审批/拒绝 | L1642-1766 | `usePlanApproval()` |
| 8 | 问题回答 + Exec Approval | L1779-1826 | `useInteractiveApproval()` |
| 9 | 后台任务管理 | L1973-2145 | `useBackgroundTaskManager()` |
| 10 | Artifact 提取 | L2151-2395 | 纯函数 + `useMemo` |
| 11 | Presentation tool 拦截 | L551-623 | 中间件模式 |
| 12 | Command Queue 集成 | L1919-1939 | 已是独立 hook |

### 核心架构问题

#### 问题 1: `handleSSEMessage` 巨型 switch-case (L391-768)

377 行的 `useCallback`，混合了三层逻辑：

```
协议解析层 → 状态更新层 → 副作用触发层
  (JSON解析)    (setState)    (overlay store操作、网络调用)
```

以 `tool_use` 分支为例 (L519-624)：

```typescript
case "tool_use": {
  // 1. 协议解析 (✓ 应该在这里)
  const toolId = data.id || generateId();
  const toolInput = (data.input || {}) as Record<string, unknown>;

  // 2. 状态更新 (✓ 应该在这里)
  setMessages((prev) => [...prev, toolMsg]);
  setToolUsages((prev) => [...prev, toolUsage]);

  // 3. 副作用: Presentation 拦截 (✗ 不应该在这里 - Feature Envy)
  if (isClientSidePresentationTool(toolName)) {
    const store = useOverlayStore.getState();        // 直接引用外部 store
    store.actions.startPresentation(sessionId);       // 触发 UI 副作用
    completeClientSideToolOnce(toolId, sessionId, { // 发起网络请求
      content: [{ type: "text", text: "..." }],
    });
  }

  // 4. 副作用: GUI Action (✗ 不应该在这里)
  if (isGUIExecuteTool(toolName)) {
    handleGUIExecute(toolId, sessionIdRef.current || "", { ... });
  }
}
```

**问题本质**：消息处理器承担了"知道所有 tool 如何拦截"的职责，每新增一种 client-side tool 都要修改这个 377 行函数。

#### 问题 2: 传输层三路分叉

每个用户操作都有 3 套实现：

| 操作 | SSE 路径 | WebSocket 路径 | Mock 路径 |
|------|----------|---------------|-----------|
| sendMessage | `sendMessageReal` (L1276) | `sendMessageWebSocket` (L1006) | `sendMessageMock` (L1446) |
| approvePlan | L1642 (`fetch /api/agent/approve`) | `approvePlanWebSocket` (L1180) | L1688 (`mockDelay`) |
| rejectPlan | L1715 (`fetch /api/agent/reject`) | `rejectPlanWebSocket` (L1202) | — |
| answerQuestions | L1779 (`sendMessageReal`) | `answerQuestionsWebSocket` (L1131) | — |
| cancel | L1831 (`client.stopAgent`) | `cancelWebSocket` (L1244) | — |

路由在 `sendMessage` (L1615-1637) 中完成：

```typescript
const sendMessage = useCallback(async (content, attachments) => {
  if (mockMode) return sendMessageMock(content, attachments);
  if (useWebSocket) return sendMessageWebSocket(content, attachments);
  const connected = gatewayConnected ?? (await checkGatewayConnection());
  if (connected) return sendMessageReal(content, attachments);
  else return sendMessageMock(content, attachments);  // fallback
}, [...]);
```

**违反开闭原则**：新增传输方式（如 gRPC-web）需要修改所有 5+ 个函数。

#### 问题 3: Presentation/GUI 拦截紧耦合

当前工具拦截的常量定义 (L140-174) 和处理逻辑 (L551-623) 都内联在 hook 文件中：

```typescript
// L140-166: 这些 Set 属于 Presentation 模块的 domain knowledge
const PRESENTATION_CLIENT_SIDE_TOOLS = new Set([
  "presentation_draw", "mcp__presentation__presentation_draw",
  "presentation_spotlight", "mcp__presentation__presentation_spotlight",
  // ... 12 个 tool name
]);

// L616-623: GUI Action 拦截也直接内联
if (isGUIExecuteTool(toolName)) {
  handleGUIExecute(data.id || toolId, sessionIdRef.current || "", {
    action: (toolInput as { action?: string }).action || "",
    payload: (toolInput as { payload?: unknown }).payload,
  }).catch((err) => { console.error("[GUI_execute] Failed:", err); });
}
```

**问题**：每新增一类 client-side tool（比如 "browser_navigate"），都需要：
1. 在 L140 附近添加新 Set
2. 在 L551-623 之间插入新 if 分支
3. 这些修改都发生在 2400 行文件的中间

---

## 二、性能问题 (Performance)

| 问题 | 严重度 | 影响量化 | 建议 |
|------|--------|---------|------|
| 流式传输期间 `messages` 高频 setState | **高** | 每秒 20-50 次 re-render | ref 累积 + rAF/setTimeout 节流 |
| Artifact `useEffect` 触发双重渲染 | **中高** | 每次 messages 变化 +1 次额外 render | 改为 `useMemo` + 纯函数 |
| O(n) 消息查找 (`findIndex`) | **中** | 100 条消息时每次 text chunk ~0.1ms | WeakMap/Map 索引 O(1) 查找 |
| `TextEncoder.encode()` 重复调用 | **中** | 50KB 文件每次 ~1-2ms | 用 `content.length` 近似 |
| Hook 返回 37 个字段扁平对象 | **中** | 任一字段变化 → 所有消费组件 re-render | 分组或拆 store |

### 问题 A: 流式文本高频 setState

**当前代码** (L444-489):

```typescript
case "text":
  if (data.content) {
    const currentStreamId = streamingMessageIdRef.current;
    if (currentStreamId) {
      setMessages((prev) => {
        // O(n) 线性扫描找到目标消息
        const existingIndex = prev.findIndex(m => m.id === currentStreamId && m.type === "text");
        if (existingIndex !== -1) {
          const updated = [...prev];                    // 每次都复制整个数组
          updated[existingIndex] = {
            ...updated[existingIndex],
            content: (updated[existingIndex].content || "") + data.content, // 拼接
          };
          return updated;
        }
        // ...
      });
    } else {
      const newId = generateId();
      streamingMessageIdRef.current = newId;
      setMessages((prev) => [...prev, { id: newId, type: "text", content: data.content }]);
    }
  }
```

**问题链**:
1. Claude 流式输出约 50 tokens/s → 每个 token 产生 1 个 SSE `text` 事件
2. 每个事件触发 `setMessages` → React 安排 1 次 re-render
3. 虽然 React 18 会合并同一微任务内的 setState，但不同的 `reader.read()` 之间不合并
4. 实际效果：**每秒 20-50 次** messages 数组变化 → 消息列表组件每帧都重渲染

**量化影响**：

```
SSE text chunk → setMessages → 触发 render
                            → artifacts useEffect 运行 (240 行)
                            → setArtifacts → 再触发 render  (双重渲染!)
```

### 问题 B: Artifact 提取的双重渲染

**当前代码** (L2151-2395): 用 `useEffect` + `setArtifacts` 做派生计算。

```typescript
// 每次 messages 变化都会：
// 1. 触发 render (因为 messages 是 state)
// 2. render 后 effect 运行 → 遍历所有消息 → 正则匹配 → TextEncoder
// 3. setArtifacts(extracted) → 又触发一次 render
useEffect(() => {
  const extractedArtifacts: Artifact[] = [];
  messages.forEach((msg) => {
    if (msg.type === "tool_use" && msg.name === "Write") {
      // L2262: 对每个 Write 工具的内容计算字节大小
      const fileSize = content ? new TextEncoder().encode(content).length : 0;
      // ↑ 如果 content 是 50KB，每次都要编码一次
    }
    // L2362-2392: 正则 matchAll 在所有 text/tool_result 上运行
  });
  setArtifacts(extractedArtifacts); // 额外的 re-render!
}, [messages]);
```

**修复方案**: 改为 `useMemo`（同一 render 内完成，无额外渲染）：

```typescript
const artifacts = useMemo(() => extractArtifacts(messages), [messages]);
```

### 问题 C: 返回值过大导致的级联 re-render

```typescript
// 当前：37 个字段扁平返回
return {
  messages, phase, isStreaming, pendingPlan, pendingQuestions, pendingExecApproval,
  artifacts, toolUsages, error, sessionId, traceId, gatewayConnected, connectionStatus,
  contextUsage, sendMessage, steerMessage, approvePlan, rejectPlan, answerQuestions,
  approveExec, cancel, clearMessages, loadMessages, checkGatewayConnection,
  switchTask, moveToBackground, hasRunningBackgroundTask, commandQueue,
  connectWebSocket, disconnectWebSocket,
};
```

任何一个字段变化都会重建这个对象引用。如果消费组件这样用：
```typescript
const conversation = useAgentConversation(workspaceId, options);
// conversation 每次都是新引用 → 如果传给子组件作为 prop → 子组件每次都 re-render
```

### 流式文本节流方案（推荐实现）

```typescript
// 方案: pending buffer + setTimeout(0) 批量刷新（参考 AionUi）
const pendingTextRef = useRef<string>("");
const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

// 在 handleSSEMessage 的 text case 中：
pendingTextRef.current += data.content;
if (!flushTimerRef.current) {
  flushTimerRef.current = setTimeout(() => {
    flushTimerRef.current = null;
    const text = pendingTextRef.current;
    pendingTextRef.current = "";
    // 一次性 flush 累积的所有 text
    setMessages((prev) => {
      const idx = indexRef.current.get(streamingMessageIdRef.current!);
      if (idx !== undefined) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], content: (updated[idx].content || "") + text };
        return updated;
      }
      return prev;
    });
  }, 0); // setTimeout(0) = 下一帧执行，合并同一帧内所有 chunk
}
```

**效果**：将每秒 20-50 次 setState 降为 ~16 次（与浏览器帧率对齐）。

---

## 三、可靠性问题 (Resilience)

| 问题 | 严重度 | 位置 | 触发场景 |
|------|--------|------|---------|
| **SSE fetch 未传入 signal，cancel 无效** | **P0** | L1353 | 用户点取消后流仍在后台接收 |
| **无并发请求保护** | **P0** | `sendMessageReal` | 快速双击发送 → 消息交叉 |
| **WS 断开后 `isStreaming` 不重置** | **P0** | `onclose` L911 | 网络抖动 → 永久"加载中" |
| 缺少指数退避 | **中** | L932 | gateway 重启 → 5 次 30s 放弃 |
| 心跳失败不触发重连 | **中** | L797 | 半死连接 → 发消息无响应 |
| 无 `visibilitychange` 处理 | **中** | 全局缺失 | 切标签页 → 回来连接已断 |
| Background task 无 TTL 清理 | **中** | `moveToBackground` | 长时间不恢复 → 内存泄漏 |
| CLOSING 状态轮询泄漏 | **低** | L836-851 | 组件在 3s 内卸载 |

### Bug 1: SSE fetch 缺少 AbortController signal

**当前代码** (L1291, L1353):

```typescript
// L1291: 创建了 AbortController
abortControllerRef.current = new AbortController();

// L1353: 但 fetch 没有传入 signal !!!
const response = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
  body: JSON.stringify(requestBody),
  // ← 缺少: signal: abortControllerRef.current.signal
});
```

**后果**：`cancel()` 函数 (L1839) 调用 `abortControllerRef.current.abort()` 不会中断 HTTP 连接。用户点击取消后，SSE 流仍在后台接收数据、调用 `handleSSEMessage`、更新 state。

**修复** (1 行):
```typescript
const response = await fetch(url, {
  method: "POST",
  headers: { ... },
  body: JSON.stringify(requestBody),
  signal: abortControllerRef.current.signal,  // ← 加这一行
});
```

### Bug 2: 无并发请求保护

**当前代码** (L1291):

```typescript
const sendMessageReal = useCallback(async (content, attachments) => {
  // 直接覆盖旧的 controller，但不 abort 旧请求!
  abortControllerRef.current = new AbortController();
  // ...
  const response = await fetch(url, { ... }); // 新请求开始
  // 此时旧请求仍在 while(true) 循环中读取数据
  // 两个流同时调用 handleSSEMessage → 消息交叉混乱
```

**触发场景**：用户在 agent 回复时快速发送第二条消息。

**修复**:
```typescript
const sendMessageReal = useCallback(async (content, attachments) => {
  // 先 abort 旧请求
  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
  }
  abortControllerRef.current = new AbortController();
  // ...
```

### Bug 3: WebSocket 断开后状态不一致

**当前代码** (L911-936): `onclose` 回调只做重连，不重置 streaming 状态：

```typescript
ws.onclose = (event) => {
  stopHeartbeat();
  // ← 如果此时 isStreaming=true（agent 正在回复），不会重置
  // ← 用户看到的是永久"加载中"状态

  if (event.code !== 1000 && wsReconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
    // 尝试重连...但不会恢复正在进行的请求
  }
};
```

**修复**:
```typescript
ws.onclose = (event) => {
  stopHeartbeat();

  // 如果非正常关闭且正在 streaming，重置状态
  if (event.code !== 1000 && isRunningRef.current) {
    setIsStreaming(false);
    setPhase("error");
    setError("Connection lost during streaming");
    isRunningRef.current = false;
    streamingMessageIdRef.current = null;
  }

  // 重连逻辑...
};
```

### 问题 4: WebSocket 重连策略不足

**当前** (L932): 线性退避，最多 5 次，总耗时约 30s：

```typescript
// 延迟 = 2000ms × attempts (线性: 2s, 4s, 6s, 8s, 10s = 总 30s)
wsReconnectTimeoutRef.current = setTimeout(() => {
  connectWebSocketRef.current();
}, RECONNECT_DELAY_MS * wsReconnectAttemptsRef.current);
```

**推荐**: 指数退避 + jitter + 更多重试：

```typescript
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;

const delay = Math.min(BASE_DELAY_MS * Math.pow(2, attempts), MAX_DELAY_MS);
const jitter = delay * 0.2 * Math.random(); // 20% 随机抖动
setTimeout(reconnect, delay + jitter);
// 重试序列: 1s, 2s, 4s, 8s, 16s, 30s, 30s, 30s, 30s, 30s = 总 ~2.5 min
```

### 问题 5: 心跳不检测 pong 超时

**当前** (L791-801): 只发 ping，发送失败只打 warn：

```typescript
wsHeartbeatIntervalRef.current = setInterval(() => {
  if (wsRef.current?.readyState === WebSocket.OPEN) {
    try {
      wsRef.current.send(JSON.stringify({ type: "ping" }));
    } catch (e) {
      console.warn("[useAgent] Heartbeat send failed:", e); // 只打日志！
    }
  }
}, HEARTBEAT_INTERVAL_MS);
```

**问题**: WebSocket 可能处于"半死"状态 — `readyState` 仍为 OPEN，但数据无法传输。发 ping 不报错但 pong 永远不回来。

**修复**: 实现 pong 超时检测：

```typescript
let lastPongTime = Date.now();

// 收到 pong 时更新
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === "pong") { lastPongTime = Date.now(); return; }
  // ...
};

// 心跳检测 pong 超时
setInterval(() => {
  if (Date.now() - lastPongTime > HEARTBEAT_INTERVAL_MS * 2) {
    console.warn("[useAgent] Pong timeout, closing connection");
    ws.close(4000, "Pong timeout"); // 非 1000 会触发重连
  }
  ws.send(JSON.stringify({ type: "ping" }));
}, HEARTBEAT_INTERVAL_MS);
```

---

## 四、API 设计 (Interface)

| 维度 | 评分 | 关键问题 |
|------|------|---------|
| 返回值设计 | 5/10 | 37 个字段扁平暴露，泄漏 `connectWebSocket`/`disconnectWebSocket` |
| 类型安全 | 5/10 | `SSEMessageData` 应为 discriminated union；多处 unsafe cast |
| 可组合性 | 4/10 | 2400 行单体 hook，不可独立测试 |
| Options 接口 | 7/10 | `sessionId` 命名歧义；`useWebSocket` 应自动推导 |
| 命名规范 | 7/10 | `clearMessages` 实际重置全部状态，应叫 `resetConversation` |

### 问题 1: SSEMessageData 是"大杂烩 interface"

**当前** (L179-237): 所有消息类型的所有字段堆在一起：

```typescript
interface SSEMessageData {
  type: "session" | "sdk_session" | "status" | "text" | "thinking" | "tool_use" | ...;
  // 以下字段对所有 type 都"合法"，TypeScript 无法收窄
  approval_id?: string;        // 只在 exec_approval 时有意义
  content?: string;            // 只在 text/thinking 时有意义
  id?: string;                 // 在 tool_use/question 中含义不同
  name?: string;               // 只在 tool_use 时有意义
  plan?: { ... };              // 只在 plan 时有意义
  questions?: Array<...>;      // 只在 question 时有意义
  // snake_case/camelCase 双字段兼容
  sessionId?: string;
  session_id?: string;         // 后端可能发任一种
  toolUseId?: string;
  tool_use_id?: string;
}
```

**后果**: `switch(data.type)` 后 TypeScript 不会自动收窄字段，代码中充斥 `data.content || ""`、`data.id || generateId()` 等防御性写法。

**应改为 Discriminated Union**:

```typescript
// 基础接口
interface SSEBase { type: string }

// 每种消息类型独立定义
interface SSESession extends SSEBase {
  type: "session";
  session_id: string;
  trace_id?: string;
}
interface SSEText extends SSEBase {
  type: "text";
  content: string;
}
interface SSEThinking extends SSEBase {
  type: "thinking";
  content: string;
}
interface SSEToolUse extends SSEBase {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}
interface SSEToolResult extends SSEBase {
  type: "tool_result";
  tool_use_id: string;
  output: string;
  is_error?: boolean;
}
interface SSEPlan extends SSEBase {
  type: "plan";
  plan: { id: string; goal: string; steps: Array<{ id: string; description: string; status: string }> };
}
interface SSEQuestion extends SSEBase {
  type: "question";
  id: string;
  questions: Array<{ header: string; question: string; options: Array<{ label: string }>; multiSelect: boolean }>;
}
interface SSEExecApproval extends SSEBase {
  type: "exec_approval";
  approval_id: string;
  tool_call: { title?: string; kind?: string; command?: string };
  options: Array<{ id: string; label: string }>;
}
interface SSEResult extends SSEBase {
  type: "result";
  cost?: number;
  duration?: number;
}
interface SSEError extends SSEBase {
  type: "error";
  message: string;
}
interface SSEDone extends SSEBase { type: "done" }
interface SSEContextUsage extends SSEBase {
  type: "context_usage";
  used: number;
  total: number;
}

// 总联合类型
type SSEMessageData =
  | SSESession | SSEText | SSEThinking | SSEToolUse | SSEToolResult
  | SSEPlan | SSEQuestion | SSEExecApproval | SSEResult | SSEError
  | SSEDone | SSEContextUsage;

// 使用时 TypeScript 自动收窄：
switch (data.type) {
  case "text":
    data.content; // ✓ TypeScript 知道这是 string，不需要 || ""
    break;
  case "tool_use":
    data.name;    // ✓ TypeScript 知道这是 string
    data.input;   // ✓ TypeScript 知道这是 Record<string, unknown>
    break;
}
```

**snake_case 兼容**: 添加一个 normalizer 层，在 JSON.parse 后立即统一格式：

```typescript
function normalizeSSEData(raw: unknown): SSEMessageData {
  const obj = raw as Record<string, unknown>;
  // 统一 snake_case → camelCase（只在入口处做一次）
  if (obj.session_id && !obj.sessionId) obj.sessionId = obj.session_id;
  if (obj.tool_use_id && !obj.toolUseId) obj.toolUseId = obj.tool_use_id;
  if (obj.is_error !== undefined && obj.isError === undefined) obj.isError = obj.is_error;
  return obj as SSEMessageData;
}
```

### 问题 2: Options 接口的命名歧义

```typescript
// Options 中：sessionId 指 "persistence session ID"（存盘用）
export interface UseAgentConversationOptions {
  sessionId?: string;  // ← persistence
}

// 返回值中：sessionId 指 "gateway session ID"（运行时）
return {
  sessionId,  // ← gateway runtime session
};
```

消费者很容易混淆。建议改名：

```typescript
export interface UseAgentConversationOptions {
  persistenceSessionId?: string;  // 明确语义
  // 或更好：
  persistence?: { sessionId: string; taskId?: string };
}
```

### 问题 3: `useWebSocket` 不应暴露给消费端

当前消费端需要判断 executor 类型来决定传输方式：

```typescript
// use-workspace-chat.ts 中：
const conversation = useAgentConversation(workspacePath, {
  useWebSocket: executorType === "OPENCLAW",  // 消费端不应该知道这个细节
});
```

应该封装在 hook 内部自动推导：

```typescript
// hook 内部根据 executor_type 自动选择
const shouldUseWebSocket = agentConfig?.executor_type?.toUpperCase() === "OPENCLAW";
```

### 问题 4: 不安全类型断言清单

| 位置 | 断言 | 风险 |
|------|------|------|
| L531 | `(data.input \|\| {}) as Record<string, unknown>` | 低 — 防御性 fallback |
| L618 | `(toolInput as { action?: string }).action` | **中** — 无运行时验证 |
| L619 | `(toolInput as { payload?: unknown }).payload` | **中** — 无运行时验证 |
| L1075 | `agentConfig.executor_config as { gateway?: ... }` | **中** — 绕过类型系统 |
| L1085 | 同上（runtime cache 路径） | **中** — 同上 |

---

## 五、优先修复建议与实施计划

### P0 (必须修复 - 有 Bug) — 预计 1-2 小时

这些是可以直接在当前文件中原地修复的问题，不需要大规模重构。

#### Fix 1: `fetch` 加 `signal`

```diff
 // L1353
 const response = await fetch(url, {
   method: "POST",
   headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
   body: JSON.stringify(requestBody),
+  signal: abortControllerRef.current.signal,
 });
```

#### Fix 2: 并发请求保护

```diff
 // L1291 之前加入
 const sendMessageReal = useCallback(async (content, attachments) => {
+  // Abort 旧请求（防止并发流交叉）
+  if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
+    abortControllerRef.current.abort();
+  }
   abortControllerRef.current = new AbortController();
```

#### Fix 3: WebSocket `onclose` 重置 streaming 状态

```diff
 // L911 ws.onclose 内部
 ws.onclose = (event) => {
   clearTimeout(timeout);
   stopHeartbeat();
   wsConnectPromiseRef.current = null;
+
+  // 非正常关闭 + 正在 streaming → 重置状态
+  if (event.code !== 1000 && isRunningRef.current) {
+    setIsStreaming(false);
+    setPhase("error");
+    setError(`WebSocket closed unexpectedly (code: ${event.code})`);
+    isRunningRef.current = false;
+    streamingMessageIdRef.current = null;
+  }

   // 重连逻辑...
 };
```

---

### P1 (高优先级) — 预计 4-6 小时

这些可以在不改变公共 API 的情况下完成。

#### Fix 4: 流式文本节流

在 `handleSSEMessage` 的 `text` case 中实现 pending buffer:

```typescript
// 新增 ref
const pendingTextRef = useRef<string>("");
const textFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

// 替换原来的 text case
case "text":
  if (data.content) {
    // 清除 connection status（低频操作，直接 setState）
    setMessages((prev) => {
      if (prev[prev.length - 1]?.id === "__connection_status__") return prev.slice(0, -1);
      return prev;
    });

    if (!streamingMessageIdRef.current) {
      // 首条: 创建新消息
      const newId = generateId();
      streamingMessageIdRef.current = newId;
      setMessages((prev) => [...prev, { id: newId, type: "text", content: data.content }]);
    } else {
      // 后续: 累积到 buffer，延迟刷新
      pendingTextRef.current += data.content;
      if (!textFlushTimerRef.current) {
        textFlushTimerRef.current = setTimeout(() => {
          textFlushTimerRef.current = null;
          const text = pendingTextRef.current;
          if (!text) return;
          pendingTextRef.current = "";
          const sid = streamingMessageIdRef.current;
          setMessages((prev) => {
            const idx = prev.findIndex(m => m.id === sid);
            if (idx === -1) return prev;
            const updated = [...prev];
            updated[idx] = { ...updated[idx], content: (updated[idx].content || "") + text };
            return updated;
          });
        }, 0);
      }
    }
  }
  break;
```

#### Fix 5: Artifact 提取改 `useMemo`

```typescript
// 提取为纯函数（可独立测试）
function extractArtifacts(messages: AgentMessage[]): Artifact[] {
  // ... 原 L2155-2393 的逻辑，但用 content.length 替代 TextEncoder
}

// Hook 中替换 useEffect 为 useMemo
const artifacts = useMemo(() => extractArtifacts(messages), [messages]);
// 删除原来的 useState<Artifact[]>([]) 和 useEffect
```

#### Fix 6: SSEMessageData discriminated union

见第四节的完整类型定义。实施步骤：
1. 在 `lib/conversation/types.ts` 中定义新类型
2. 在 JSON.parse 后加 `normalizeSSEData()` 转换
3. 更新 `handleSSEMessage` 的 switch-case（TypeScript 会自动提示缺失字段）

---

### P2 (中优先级) — 预计 2-3 天

这些涉及文件拆分和 API 变更。

#### Fix 7: Transport 抽象

详见第七节的 `AgentStreamTransport` 接口定义和实现。

#### Fix 8: `useReducer` 状态机

```typescript
// use-stream-state.ts
type StreamPhase = "idle" | "running" | "awaiting_approval" | "awaiting_input" | "completed" | "error";

interface StreamState {
  phase: StreamPhase;
  isStreaming: boolean;
  error: string | null;
  pendingPlan: TaskPlan | null;
  pendingQuestions: PendingQuestion | null;
  pendingExecApproval: PendingExecApproval | null;
  connectionStatus: string | null;
  contextUsage: { used: number; total: number } | null;
}

type StreamAction =
  | { type: "START_STREAMING" }
  | { type: "STOP_STREAMING" }
  | { type: "SET_ERROR"; error: string }
  | { type: "SET_PLAN"; plan: TaskPlan }
  | { type: "CLEAR_PLAN" }
  | { type: "SET_QUESTIONS"; questions: PendingQuestion }
  | { type: "CLEAR_QUESTIONS" }
  | { type: "SET_EXEC_APPROVAL"; approval: PendingExecApproval }
  | { type: "CLEAR_EXEC_APPROVAL" }
  | { type: "SET_PHASE"; phase: StreamPhase }
  | { type: "SET_CONNECTION_STATUS"; status: string | null }
  | { type: "SET_CONTEXT_USAGE"; used: number; total: number }
  | { type: "RESET" };

function streamReducer(state: StreamState, action: StreamAction): StreamState {
  switch (action.type) {
    case "START_STREAMING":
      return { ...state, phase: "running", isStreaming: true, error: null };
    case "STOP_STREAMING":
      return { ...state, isStreaming: false };
    case "SET_ERROR":
      return { ...state, phase: "error", isStreaming: false, error: action.error };
    case "SET_PLAN":
      return { ...state, phase: "awaiting_approval", pendingPlan: action.plan };
    case "CLEAR_PLAN":
      return { ...state, pendingPlan: null };
    case "SET_QUESTIONS":
      return { ...state, phase: "awaiting_input", isStreaming: false, pendingQuestions: action.questions };
    case "CLEAR_QUESTIONS":
      return { ...state, pendingQuestions: null };
    // ...
    case "RESET":
      return initialState;
    default:
      return state;
  }
}
```

**优点**: 状态转换集中在一处，不可能出现 `phase="running"` 但 `isStreaming=false` 的不一致状态。

#### Fix 9: 工具拦截中间件

详见第七节的 `ToolInterceptor` 接口。

#### Fix 10: 清理返回值

```diff
 return {
-  connectWebSocket,      // ← 内部实现细节，不应暴露
-  disconnectWebSocket,   // ← 内部实现细节，不应暴露
+  // 按职责分组
+  state: { messages, phase, isStreaming, error, contextUsage },
+  pending: { plan: pendingPlan, questions: pendingQuestions, execApproval: pendingExecApproval },
+  connection: { sessionId, traceId, gatewayConnected, connectionStatus },
+  derived: { artifacts, toolUsages },
+  actions: { sendMessage, steerMessage, approvePlan, rejectPlan, answerQuestions, approveExec, cancel, resetConversation, loadMessages },
+  background: { switchTask, moveToBackground, hasRunningBackgroundTask },
+  commandQueue,
 };
```

---

### P3 (低优先级) — 可随时穿插

| # | 改进 | 实现要点 |
|---|------|---------|
| 11 | 指数退避 | `Math.min(1000 * 2^n, 30000) + jitter` |
| 12 | visibilitychange | 页面恢复可见时 ping 检测连接存活性 |
| 13 | Background task TTL | 5 分钟无活动自动清除 + warn log |
| 14 | Pong 超时 | 2 个心跳周期无 pong → 主动断开重连 |

---

## 六、推荐重构架构

### 文件结构

```
pages/conversation/hooks/
├── use-agent-conversation.ts          # 门面 hook（< 200 行）— 只做组合
├── use-stream-state.ts                # useReducer 状态机（< 150 行）
├── use-message-list.ts                # 消息列表管理（< 200 行）— WeakMap 索引 + 批量节流
├── use-agent-transport.ts             # Transport 选择器 hook（< 100 行）
├── use-background-tasks.ts            # 后台任务管理（< 200 行）
├── use-tool-interceptors.ts           # 工具拦截管道（< 100 行）
├── use-plan-approval.ts               # Plan 审批/拒绝（< 100 行）
├── use-command-queue.ts               # [已存在] 命令队列
└── use-mock-conversation.ts           # Mock（仅 dev，< 150 行）

lib/gateway/
├── agent-stream.ts                    # Transport 接口定义 + 工厂函数
├── sse-transport.ts                   # SSE 实现（< 200 行）— 连接 + 缓冲区解析
├── ws-transport.ts                    # WebSocket 实现（< 300 行）— 连接 + 重连 + 心跳
└── stream-normalizer.ts               # SSE 数据归一化（snake_case → camelCase）

lib/conversation/
├── types.ts                           # SSEMessageData discriminated union + AgentMessage 类型
├── message-handler.ts                 # 共享消息处理器（< 200 行）— SSE/WS 共用
├── message-composer.ts                # 按类型合并消息的纯函数（< 100 行）
├── artifact-extractor.ts              # Artifact 提取纯函数（< 150 行）
├── runtime-check.ts                   # mismatch 检查 + availability check
└── attachment-formatter.ts            # formatAttachmentsForPrompt 等工具

lib/presentation/
└── tool-interceptor.ts                # Presentation tool 拦截（从 hook 解耦）

lib/action-system/
└── tool-interceptor.ts                # GUI Action 拦截（从 hook 解耦）
```

### 各文件职责详解

#### `use-agent-conversation.ts` — 门面 (< 200 行)

**唯一职责**: 组合子 hook，暴露统一接口。不包含任何业务逻辑。

```typescript
export function useAgentConversation(workspaceId: string, options?: UseAgentConversationOptions) {
  const { agentConfig, mockMode = false } = options || {};

  // 1. 状态机
  const [state, dispatch] = useStreamState();

  // 2. 消息列表（带索引 + 批量节流）
  const messageList = useMessageList();

  // 3. 工具拦截管道
  const interceptors = useToolInterceptors();

  // 4. 消息处理回调（SSE/WS 消息到达时调用）
  const handleMessage = useCallback((data: SSEMessageData) => {
    processAgentMessage(data, {
      dispatch,
      messageList,
      interceptors,
    });
  }, [dispatch, messageList, interceptors]);

  // 5. 传输层（自动选择 SSE/WS/Mock）
  const transport = useAgentTransport(workspaceId, {
    ...options,
    onMessage: handleMessage,
    mockMode,
  });

  // 6. 后台任务管理
  const background = useBackgroundTasks({
    transport,
    messageList,
    isRunning: state.isStreaming,
  });

  // 7. Artifact 提取（纯 useMemo，无额外渲染）
  const artifacts = useMemo(
    () => extractArtifacts(messageList.messages),
    [messageList.messages]
  );

  // 8. 命令队列
  const commandQueue = useCommandQueue({
    conversationId: options?.sessionId || workspaceId,
    enabled: transport.mode === "websocket",
    isBusy: state.isStreaming,
    supportsSteer: agentConfig?.executor_type?.toUpperCase() !== "OPENCLAW",
    onSend: transport.send,
    onSteer: transport.steer,
  });

  // 分组返回
  return {
    state: {
      messages: messageList.messages,
      phase: state.phase,
      isStreaming: state.isStreaming,
      error: state.error,
      contextUsage: state.contextUsage,
    },
    pending: {
      plan: state.pendingPlan,
      questions: state.pendingQuestions,
      execApproval: state.pendingExecApproval,
    },
    connection: {
      sessionId: transport.sessionId,
      traceId: transport.traceId,
      connected: transport.connected,
      connectionStatus: state.connectionStatus,
    },
    derived: { artifacts, toolUsages: messageList.toolUsages },
    actions: {
      sendMessage: transport.send,
      steerMessage: transport.steer,
      approvePlan: transport.approvePlan,
      rejectPlan: transport.rejectPlan,
      answerQuestions: transport.answerQuestions,
      approveExec: transport.approveExec,
      cancel: transport.cancel,
      resetConversation: messageList.clear,
      loadMessages: messageList.load,
    },
    background,
    commandQueue,
  };
}
```

#### `lib/gateway/agent-stream.ts` — Transport 接口

```typescript
export interface ConnectParams {
  workspacePath: string;
  agentConfigPath?: string;
  agentDir?: string;
  agentConfig?: AgentConfig;
  persistSessionId?: string;
  persistTaskId?: string;
  sandboxConfig?: SandboxConfig;
}

export interface AgentStreamTransport {
  // 连接管理
  connect(params: ConnectParams): Promise<void>;
  disconnect(): void;
  readonly connected: boolean;
  readonly mode: "sse" | "websocket" | "mock";

  // 会话信息
  readonly sessionId: string | null;
  readonly sdkSessionId: string | null;
  readonly traceId: string | null;

  // 发送操作（统一接口，不再区分 SSE/WS）
  send(content: string, attachments?: MessageAttachment[]): Promise<void>;
  steer(message: string): Promise<void>;
  approvePlan(): void;
  rejectPlan(): void;
  answerQuestions(answers: Record<string, string[]>): void;
  approveExec(decision: string): void;
  cancel(): void;

  // 事件订阅
  onMessage(handler: (data: SSEMessageData) => void): () => void;
}

// 工厂函数
export function createAgentTransport(
  mode: "sse" | "websocket" | "mock",
  params: ConnectParams
): AgentStreamTransport {
  switch (mode) {
    case "websocket": return new WebSocketTransport(params);
    case "sse":       return new SSETransport(params);
    case "mock":      return new MockTransport(params);
  }
}
```

#### `lib/conversation/message-handler.ts` — 消息处理器

```typescript
import type { SSEMessageData } from "./types";
import type { StreamAction } from "@/pages/conversation/hooks/use-stream-state";
import type { MessageListActions } from "@/pages/conversation/hooks/use-message-list";
import type { ToolInterceptor } from "@/pages/conversation/hooks/use-tool-interceptors";

interface MessageHandlerContext {
  dispatch: (action: StreamAction) => void;
  messageList: MessageListActions;
  interceptors: ToolInterceptor[];
}

/**
 * 纯逻辑函数：处理一条 SSE/WS 消息
 * 无 React 依赖，可独立单测
 */
export function processAgentMessage(data: SSEMessageData, ctx: MessageHandlerContext): void {
  const { dispatch, messageList, interceptors } = ctx;

  switch (data.type) {
    case "text":
      dispatch({ type: "CLEAR_CONNECTION_STATUS" });
      messageList.appendText(data.content);
      break;

    case "thinking":
      dispatch({ type: "CLEAR_CONNECTION_STATUS" });
      messageList.appendThinking(data.content);
      break;

    case "tool_use":
      messageList.endTextStream();
      messageList.addToolUse(data.id, data.name, data.input);
      // 工具拦截管道
      for (const interceptor of interceptors) {
        if (interceptor.match(data.name)) {
          interceptor.handle({ toolUseId: data.id, input: data.input });
          break;
        }
      }
      break;

    case "tool_result":
      messageList.endTextStream();
      messageList.addToolResult(data.tool_use_id, data.output, data.is_error);
      break;

    case "plan":
      dispatch({ type: "SET_PLAN", plan: data.plan });
      messageList.addPlan(data.plan);
      break;

    case "question":
      dispatch({ type: "SET_QUESTIONS", questions: { id: data.id, questions: data.questions } });
      break;

    case "exec_approval":
      dispatch({ type: "SET_EXEC_APPROVAL", approval: data });
      break;

    case "result":
      dispatch({ type: "STREAM_COMPLETED", cost: data.cost, duration: data.duration });
      messageList.endTextStream();
      break;

    case "error":
      dispatch({ type: "SET_ERROR", error: data.message });
      messageList.endTextStream();
      messageList.addError(data.message);
      break;

    case "done":
      dispatch({ type: "STREAM_DONE" });
      messageList.endTextStream();
      break;

    case "context_usage":
      dispatch({ type: "SET_CONTEXT_USAGE", used: data.used, total: data.total });
      break;

    case "session":
      dispatch({ type: "SET_SESSION", sessionId: data.session_id, traceId: data.trace_id });
      break;

    case "status":
      dispatch({ type: "SET_CONNECTION_STATUS", status: data.status_message || data.status || "" });
      break;
  }
}
```

#### `use-message-list.ts` — 消息列表 + 批量节流

```typescript
export interface MessageListActions {
  messages: AgentMessage[];
  toolUsages: ToolUsage[];
  appendText(content: string): void;
  appendThinking(content: string): void;
  endTextStream(): void;
  addToolUse(id: string, name: string, input: unknown): void;
  addToolResult(toolUseId: string, output: string, isError?: boolean): void;
  addPlan(plan: TaskPlan): void;
  addError(message: string): void;
  addUserMessage(content: string, attachments?: MessageAttachment[]): void;
  clear(): void;
  load(messages: AgentMessage[], sdkSessionId?: string): void;
}
```

详见第七节的完整实现。

---

## 七、参考 AionUi 的重构方案

> 参考项目：`/Users/lxy/Documents/GitHub/others/AionUi`

### AionUi 与 viben 当前实现对比

| 维度 | AionUi | viben 当前 (`useAgentConversation`) |
|---|---|---|
| 行数分布 | 每个关注点 < 400 行 | 2438 行单体 |
| 状态管理 | SWR + useState + Ref 三层 | 全 useState + Ref |
| 传输层 | IPC Bridge 抽象（统一接口） | SSE + WebSocket 内联混写 |
| 消息写入 | `useAddOrUpdateMessage` 批量+节流 | 直接 `setMessages` 分散调用 |
| 消息索引 | WeakMap + Map O(1) 查找 | Array `findIndex` O(n) 线性扫描 |
| 工具拦截 | 平台层 switch/case + 统一 IPC emit | 单体内 if/else + 直接操作 store |
| 队列管理 | 独立 `useConversationCommandQueue` hook | `useCommandQueue` 但集成在单体内 |
| 实时通信 | 统一 `bridge.buildEmitter<T>` 抽象 | 原生 SSE/WebSocket 直连 |
| 类型系统 | 完整 Discriminated Union | 混合 interface（无类型收窄） |
| 性能优化 | 50ms throttle + 批量 setTimeout | 无节流，每条消息 setState |

---

### AionUi 关键设计模式

#### 1. 消息列表：WeakMap 索引 + 批量节流

```typescript
// AionUi: Messages/hooks.ts
// WeakMap 缓存消息索引，O(1) 查找
const indexCache = new WeakMap<TMessage[], MessageIndex>();

interface MessageIndex {
  msgIdIndex:     Map<string, number>; // msg_id -> 数组索引
  callIdIndex:    Map<string, number>; // toolCallId -> 数组索引
}

// 批量节流写入（setTimeout 调度）
export const useAddOrUpdateMessage = () => {
  const pendingRef = useRef<Array<{ message: TMessage; add: boolean }>>([]);
  const rafRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    rafRef.current = null;
    const pending = pendingRef.current;
    if (!pending.length) return;
    pendingRef.current = [];

    update((list) => {
      const index = getOrBuildIndex(list); // O(1) 查找
      let newList = list;
      for (const item of pending) {
        newList = composeMessageWithIndex(item.message, newList, index);
      }
      return newList;
    });
  }, []);

  return useCallback((message, add = false) => {
    pendingRef.current.push({ message, add });
    if (rafRef.current === null) {
      rafRef.current = setTimeout(flush); // 下一帧批量合并
    }
  }, [flush]);
};
```

**viben 对标改进**：当前 `handleSSEMessage` 中每条 text chunk 都 `setMessages` + `findIndex` O(n) 扫描，应改为：
- WeakMap 索引按 id 直接定位
- pending buffer + setTimeout 批量刷新

#### 2. 传输层统一抽象

```typescript
// AionUi: ipcBridge.ts — 统一的类型安全事件总线
export const conversation = {
  sendMessage: bridge.buildProvider<IBridgeResponse, ISendMessageParams>('chat.send.message'),
  stop: bridge.buildProvider<IBridgeResponse, { conversation_id: string }>('chat.stop.stream'),
  responseStream: bridge.buildEmitter<IResponseMessage>('chat.response.stream'),
  confirmation: {
    add: bridge.buildEmitter<IConfirmation>('confirmation.add'),
    confirm: bridge.buildProvider<IBridgeResponse, IConfirmMessageParams>('confirmation.confirm'),
  },
};

// 消费侧（hook）：
useEffect(() => {
  return ipcBridge.acpConversation.responseStream.on(handleResponseMessage);
}, [handleResponseMessage]);
```

**viben 对标改进**：SSE/WebSocket 的连接管理和协议解析应该提取到 `lib/gateway/` 层，暴露类似 `gatewayStream.on(handler)` 的接口：

```typescript
// lib/gateway/agent-stream.ts
export interface AgentStreamTransport {
  connect(params: ConnectParams): Promise<void>;
  send(message: AgentStreamMessage): boolean;
  onMessage(handler: (data: SSEMessageData) => void): () => void; // 返回 unsubscribe
  disconnect(): void;
  readonly connected: boolean;
}

export function createSSETransport(...): AgentStreamTransport { ... }
export function createWebSocketTransport(...): AgentStreamTransport { ... }
```

#### 3. 思考流节流（50ms throttle）

```typescript
// AionUi: useAcpMessage.ts — thinking 更新节流
const THROTTLE_MS = 50;
const thoughtThrottleRef = useRef<{ lastUpdate: number; pending: T | null; timer: any }>(...);

const throttledSetThought = useMemo(() => (data) => {
  const now = Date.now();
  if (now - ref.lastUpdate >= THROTTLE_MS) {
    ref.lastUpdate = now;
    setState(data); // 直接更新
  } else {
    ref.pending = data;
    if (!ref.timer) {
      ref.timer = setTimeout(() => { /* flush */ }, THROTTLE_MS - (now - ref.lastUpdate));
    }
  }
}, []);
```

**viben 对标改进**：对 `thinking` 和 `text` 消息采用类似的双轨节流，将每秒 20-50 次 re-render 降至 ~20 次。

#### 4. Discriminated Union 消息类型

```typescript
// AionUi: chatLib.ts
export type TMessage =
  | IMessage<'text', { content: string }>
  | IMessage<'thinking', { content: string; status: 'streaming' | 'done'; duration?: number }>
  | IMessage<'tool_group', Array<{ status: 'Executing' | 'Success' | 'Error' }>>
  | IMessage<'plan', { goal: string; steps: PlanStep[] }>
  // ...

// composeMessageWithIndex 可以对每种类型做不同的合并策略
```

**viben 对标改进**：`SSEMessageData` 从"大杂烩 interface"改为完整的 discriminated union。

#### 5. `turnFinishedRef` 防竞态模式

```typescript
// AionUi: 防止 finish 后的延迟消息错误恢复 running 状态
const turnFinishedRef = useRef(false);

// message handler:
case 'start': turnFinishedRef.current = false; setRunning(true); break;
case 'finish': turnFinishedRef.current = true; setRunning(false); break;
default:
  if (!runningRef.current && !turnFinishedRef.current) {
    setRunning(true); // 只在 turn 未结束时才恢复
  }
```

**viben 对标改进**：当前如果 gateway 在发送 `done` 后还有延迟到达的消息，可能错误地重置 phase。

#### 6. Hook 组合模式

```
AionUi 的组织方式：
AcpChat.tsx (容器, < 70 行)
  └── MessageList (纯展示)
  └── ConversationChatConfirm (工具确认拦截层)
  └── AcpSendBox.tsx (输入控制器, < 450 行)
        ├── useAcpMessage()              # 流式状态 + 事件订阅 (~400 行)
        ├── useConversationCommandQueue() # 命令队列
        ├── useSendBoxDraft()            # SWR 草稿持久化
        ├── useSendBoxFiles()            # 文件处理
        └── useSlashCommands()           # 斜杠命令
```

---

### 重构后的 viben 目标结构

```
pages/conversation/hooks/
  use-agent-conversation.ts     # 总组装层 (< 300 行)
  use-stream-state.ts           # 运行状态三态 (running/processing/idle)
  use-message-list.ts           # 消息列表 + WeakMap 索引 + 批量节流
  use-command-queue.ts          # 命令队列 (已有)
  use-tool-interceptors.ts      # 工具拦截中间件管道
  use-background-tasks.ts       # 后台任务管理
  use-plan-approval.ts          # Plan 审批/拒绝

lib/gateway/
  agent-stream.ts               # Transport 接口定义 + 工厂
  sse-transport.ts              # SSE 实现 (连接 + 解析)
  ws-transport.ts               # WebSocket 实现 (连接 + 重连 + 心跳)

lib/conversation/
  message-handler.ts            # 共享的消息处理逻辑 (SSE/WS 共用)
  message-composer.ts           # 按类型合并消息的纯函数
  artifact-extractor.ts         # Artifact 提取纯函数
  runtime-check.ts              # mismatch 等工具函数

lib/presentation/
  tool-interceptor.ts           # Presentation tool 拦截 (从 hook 解耦)

lib/action-system/
  tool-interceptor.ts           # GUI Action 拦截 (从 hook 解耦)
```

### 总组装层示例

```typescript
// use-agent-conversation.ts (< 300 行)
export function useAgentConversation(workspaceId: string, options?: Options) {
  // 1. 状态管理（useReducer 状态机）
  const [state, dispatch] = useStreamState();

  // 2. 消息列表（带 WeakMap 索引 + 批量节流）
  const { messages, addOrUpdateMessage, clearMessages, loadMessages } = useMessageList();

  // 3. 传输层（自动根据 executor_type 选择 SSE/WS）
  const transport = useAgentTransport(workspaceId, {
    ...options,
    onMessage: (data) => {
      handleAgentMessage(data, { dispatch, addOrUpdateMessage, interceptors });
    },
  });

  // 4. 工具拦截管道
  const interceptors = useToolInterceptors(transport.sessionId);

  // 5. 后台任务
  const background = useBackgroundTasks(transport);

  // 6. Artifact 提取 (纯 useMemo)
  const artifacts = useMemo(() => extractArtifacts(messages), [messages]);

  // 7. 命令队列
  const commandQueue = useCommandQueue({ ... });

  return {
    state: { messages, ...state },
    pending: { plan: state.pendingPlan, questions: state.pendingQuestions },
    connection: { sessionId: transport.sessionId, connected: transport.connected },
    derived: { artifacts },
    actions: { sendMessage: transport.send, cancel: transport.cancel, ... },
    background,
    commandQueue,
  };
}
```

### 关键实现细节

#### 消息批量节流 (`use-message-list.ts`)

```typescript
export function useMessageList() {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const pendingRef = useRef<Array<{ msg: AgentMessage; mode: 'add' | 'update' }>>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const indexRef = useRef(new Map<string, number>()); // O(1) 消息 ID -> index

  const flush = useCallback(() => {
    flushTimerRef.current = null;
    const pending = pendingRef.current;
    if (!pending.length) return;
    pendingRef.current = [];

    setMessages((prev) => {
      let next = prev;
      for (const { msg, mode } of pending) {
        const idx = indexRef.current.get(msg.id);
        if (mode === 'update' && idx !== undefined) {
          next = next === prev ? [...prev] : next;
          next[idx] = { ...next[idx], ...msg };
        } else {
          next = next === prev ? [...prev] : next;
          indexRef.current.set(msg.id, next.length);
          next.push(msg);
        }
      }
      return next;
    });
  }, []);

  const addOrUpdate = useCallback((msg: AgentMessage, mode: 'add' | 'update' = 'add') => {
    pendingRef.current.push({ msg, mode });
    if (!flushTimerRef.current) {
      flushTimerRef.current = setTimeout(flush, 0); // 下一帧批量
    }
  }, [flush]);

  return { messages, addOrUpdate, clear: () => { setMessages([]); indexRef.current.clear(); } };
}
```

#### Transport 接口 (`lib/gateway/agent-stream.ts`)

```typescript
export interface AgentStreamTransport {
  connect(params: ConnectParams): Promise<void>;
  send(msg: OutgoingMessage): boolean;
  onMessage(handler: (data: SSEMessageData) => void): () => void;
  cancel(): void;
  disconnect(): void;
  readonly connected: boolean;
  readonly sessionId: string | null;
}

export type OutgoingMessage =
  | { type: 'start'; prompt: string; agent_config?: AgentConfig; resume?: string }
  | { type: 'answer'; question_id: string; answers: Record<string, string> }
  | { type: 'approve'; plan_id: string }
  | { type: 'reject'; plan_id: string }
  | { type: 'exec_approve'; approval_id: string; decision: string }
  | { type: 'steer'; message: string }
  | { type: 'cancel' };
```

#### 工具拦截管道 (`use-tool-interceptors.ts`)

```typescript
export interface ToolInterceptor {
  name: string;
  match: (toolName: string) => boolean;
  handle: (ctx: { toolUseId: string; sessionId: string; input: unknown }) => void;
}

export function useToolInterceptors(sessionId: string | null): ToolInterceptor[] {
  return useMemo(() => [
    createPresentationInterceptor(sessionId),
    createGUIActionInterceptor(sessionId),
  ], [sessionId]);
}
```

---

## 八、迁移策略

### 原则

1. **保持公共 API 向后兼容** — 消费组件不需要改动（内部重构透明）
2. **逐步替换** — 每个 PR 只拆一个模块，不做 big-bang 重构
3. **先修 Bug，后拆架构** — P0 修复不依赖重构

### 分阶段执行

```
阶段 0: 修 P0 Bug (1-2h)
  ├── Fix fetch signal
  ├── Fix 并发保护
  └── Fix WS onclose

阶段 1: 提取纯函数 (2-3h, 无 API 变更)
  ├── extractArtifacts → lib/conversation/artifact-extractor.ts
  ├── formatAttachmentsForPrompt → lib/conversation/attachment-formatter.ts
  ├── checkRuntimeMismatches → lib/conversation/runtime-check.ts
  └── normalizeSSEData → lib/gateway/stream-normalizer.ts

阶段 2: 消息列表独立 (4-6h)
  ├── 创建 use-message-list.ts (WeakMap 索引 + 批量节流)
  ├── 在 use-agent-conversation.ts 中 import 使用
  └── 删除原内联逻辑

阶段 3: 状态机抽取 (2-3h)
  ├── 创建 use-stream-state.ts (useReducer)
  ├── 替换原来的 13 个 useState 中的 7 个
  └── 更新 handleSSEMessage 为 dispatch 调用

阶段 4: Transport 抽象 (1-2 天)
  ├── 定义 AgentStreamTransport 接口
  ├── 实现 SSETransport (从 sendMessageReal 提取)
  ├── 实现 WebSocketTransport (从 connectWebSocket 等提取)
  ├── 实现 MockTransport (从 sendMessageMock 提取)
  ├── 创建 use-agent-transport.ts (工厂 hook)
  └── 删除原来的 3 套内联实现

阶段 5: 工具拦截解耦 (2-3h)
  ├── 定义 ToolInterceptor 接口
  ├── 移动 Presentation 逻辑到 lib/presentation/tool-interceptor.ts
  ├── 移动 GUI Action 逻辑到 lib/action-system/tool-interceptor.ts
  └── handleSSEMessage 改为遍历 interceptor 数组

阶段 6: 后台任务独立 (2-3h)
  ├── 创建 use-background-tasks.ts
  ├── 移入 moveToBackground/switchTask/startMessagePolling
  └── 添加 TTL 过期清理

阶段 7: 清理公共 API (1-2h)
  ├── 返回值分组
  ├── 移除 connectWebSocket/disconnectWebSocket
  ├── useWebSocket 改为内部自动推导
  └── 更新所有消费组件（如果改了返回结构）
```

### 每个阶段的验收标准

| 阶段 | 验收标准 |
|------|---------|
| 0 | cancel 能真正中断 SSE；快速双发不会消息交叉；WS 断连后不卡在 loading |
| 1 | `pnpm typecheck` 通过；纯函数有单测覆盖 |
| 2 | 流式场景 re-render 频率下降 60%+（可用 React Profiler 验证） |
| 3 | 不存在 `phase` 和 `isStreaming` 不一致的状态 |
| 4 | 新增传输方式只需实现接口，不改 hook 代码 |
| 5 | 新增 client-side tool 只需注册 interceptor，不改 message handler |
| 6 | 后台任务 5 分钟无活动自动清除 |
| 7 | `use-agent-conversation.ts` < 200 行 |

### 测试策略

#### 单元测试（纯函数）

```typescript
// lib/conversation/artifact-extractor.test.ts
describe("extractArtifacts", () => {
  it("extracts Write tool artifacts with file size", () => { ... });
  it("extracts Edit tool artifacts without content", () => { ... });
  it("extracts WebSearch results", () => { ... });
  it("deduplicates by file path", () => { ... });
  it("marks files > 100KB as too large", () => { ... });
});

// lib/conversation/message-handler.test.ts
describe("processAgentMessage", () => {
  it("dispatches START_STREAMING on first text", () => { ... });
  it("calls interceptor when tool_use matches", () => { ... });
  it("handles tool_result with is_error flag", () => { ... });
});

// lib/gateway/stream-normalizer.test.ts
describe("normalizeSSEData", () => {
  it("converts session_id to sessionId", () => { ... });
  it("converts tool_use_id to toolUseId", () => { ... });
});
```

#### 集成测试（hook 级）

```typescript
// use-message-list.test.ts
describe("useMessageList", () => {
  it("batches multiple appendText calls into single setState", async () => {
    const { result } = renderHook(() => useMessageList());
    // 模拟 10 条快速到达的 text chunk
    act(() => {
      for (let i = 0; i < 10; i++) {
        result.current.appendText(`chunk-${i}`);
      }
    });
    // 等待 setTimeout(0) flush
    await act(async () => { await new Promise(r => setTimeout(r, 10)); });
    // 应该只有 1 条消息（10 个 chunk 合并）
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].content).toBe("chunk-0chunk-1...chunk-9");
  });
});
```

#### E2E 回归测试

重构前后保持行为一致的关键场景：
1. 正常对话流程（发送 → streaming → 完成）
2. 取消操作（streaming 中点取消）
3. Plan 审批/拒绝
4. 问题回答（AskUserQuestion）
5. 工具调用（展示 tool_use + tool_result）
6. Presentation tool 拦截（overlay 显示）
7. 后台任务切换
8. WebSocket 断连重连
9. 长对话 artifact 提取

---

## 九、风险与注意事项

### 重构风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 状态时序变化 | 流式消息顺序可能改变 | 对比重构前后的消息快照 |
| 批量节流延迟 | 用户感知到文字出现稍慢 | setTimeout(0) 延迟 < 16ms，不可感知 |
| Transport 接口不完整 | 某些边缘操作遗漏 | 用 TypeScript 接口强制实现所有方法 |
| 消费组件依赖内部行为 | 某组件依赖了返回值的具体时序 | 阶段 7 前保持旧接口兼容 |

### 不应该做的事

1. **不要一次性全部重构** — 必须分 PR，每个 PR 可独立回滚
2. **不要改变 Gateway 协议** — 重构只影响前端，后端接口不变
3. **不要过度抽象** — Transport 接口足够用即可，不要做 plugin 系统
4. **不要引入新依赖** — 用 React 原生能力（useReducer、useMemo），不加 Zustand/Redux
5. **不要在重构中加功能** — 重构和功能开发分开，PR 纯粹
