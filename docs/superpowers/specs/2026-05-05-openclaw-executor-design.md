# OpenClaw Executor 设计文档

> 日期: 2026-05-05
> 状态: Draft

## 概述

为 viben 添加 OpenClaw executor，使其既能作为 `viben task` 的执行器自动化执行任务，又能在 Desktop App 的 workspace chat 中作为交互式聊天代理。

OpenClaw 是一个本地 AI 助手网关，使用自定义 JSON-over-WebSocket RPC 协议（版本 3）进行通信。默认运行在 `ws://127.0.0.1:18789`。

## 方案选择

**方案 C：混合方案** — 使用 `@openclaw/sdk` 处理 WebSocket 通信协议，自己实现 Gateway 进程管理和设备身份认证（参考 AionUi）。

理由：
- SDK 封装了协议复杂度（握手、重连、事件规范化），减少出错
- 进程管理和认证逻辑自己控制，灵活度高
- 在可控性和工作量之间取得最佳平衡

## 目录结构

```
packages/core/src/executor/engines/openclaw/
├── index.ts                  # OpenClawExecutor 类 + registerExecutor + 导出
├── types.ts                  # OpenClawExecutorConfig, 内部类型定义
├── connection.ts             # @openclaw/sdk 连接封装 (单例, 连接生命周期)
├── process-manager.ts        # Gateway 进程管理 (spawn/kill/health check)
├── device-identity.ts        # Ed25519 设备身份 (~/.openclaw/identity/)
├── config.ts                 # 读取 ~/.openclaw/openclaw.json 配置
├── chat-proxy.ts             # 流式对话 → SSEMessage 转换
└── event-mapper.ts           # OpenClaw SDK 事件 → Viben SSE 映射
```

## 组件详细设计

### 1. OpenClawExecutor (`index.ts`)

继承 `BaseExecutor`，注册为 `OPENCLAW` 类型。

```typescript
export class OpenClawExecutor extends BaseExecutor {
  readonly type = "OPENCLAW" as const;

  capabilities(): ExecutorCapability[] {
    return ["SPAWN", "CHAT", "CHAT_STREAMING", "SESSION_RESUME"];
  }

  getCliName(): string { return "openclaw"; }
  getConfigDirName(): string { return ".openclaw"; }
  supportsSessionIdOnCreate(): boolean { return true; }
  supportsCLIAgents(): boolean { return false; }
}

registerExecutor("OPENCLAW", (config) => new OpenClawExecutor(config));
```

**核心方法实现：**

- `getAvailabilityInfo()`：检查 `~/.openclaw/openclaw.json` 是否存在 + 端口是否可连接
- `spawn(options)`：确保 gateway → 创建/重置 session → 发送 prompt → 流式写 log
- `chat(options)`：同 spawn 但等待完成返回结果
- `chatStreaming(options)`：AsyncGenerator，yield SSEMessage 事件流
- `resume(sessionId)`：通过 `sessions.resolve` 恢复已有 session
- `buildRunCommand()`：返回空数组（websocket 协议，无 CLI 命令概念）
- `buildResumeCommand()`：返回空数组

### 2. OpenClawConnectionManager (`connection.ts`)

封装 `@openclaw/sdk` 的 `OpenClaw` client 实例。

```typescript
export class OpenClawConnectionManager {
  private client: OpenClaw | null = null;

  async connect(config: OpenClawGatewayConfig): Promise<OpenClaw>;
  async disconnect(): Promise<void>;
  isConnected(): boolean;
  getClient(): OpenClaw;
}
```

**职责：**
- 管理 SDK client 生命周期（connect/disconnect）
- 传入认证参数（token/password/device identity）
- 处理连接状态变更回调
- 非单例 — 每个 executor 实例持有一个 connection manager

### 3. OpenClawProcessManager (`process-manager.ts`)

参考 AionUi 的 `OpenClawGatewayManager`。

```typescript
export class OpenClawProcessManager {
  async ensureRunning(config: OpenClawGatewayConfig): Promise<void>;
  async stop(): Promise<void>;
  isRunning(): boolean;
  getPort(): number;
}
```

**行为：**
1. TCP 探测目标端口是否已有进程监听
2. 如果已有 → 跳过 spawn，直接连接
3. 如果没有 → spawn `openclaw gateway --port <port>` 子进程
4. 等待 gateway 启动就绪（health check）
5. 监控进程健康，异常退出时自动重启

**Node.js 版本检测：** OpenClaw 需要 Node.js >= 22.12.0，参考 AionUi 实现自动检测 PATH 中的 Node 版本。

### 4. Device Identity (`device-identity.ts`)

参考 AionUi 的 `deviceIdentity.ts` + `deviceAuthStore.ts`。

```typescript
export interface DeviceIdentity {
  deviceId: string;        // SHA-256 of public key
  publicKey: string;       // Ed25519 base64url
  privateKey: string;      // Ed25519 base64url
}

export async function getOrCreateDeviceIdentity(): Promise<DeviceIdentity>;
export function signConnectPayload(identity: DeviceIdentity, params: ConnectSignParams): string;
export function getDeviceToken(role?: string): string | null;
export function saveDeviceToken(token: string, role?: string): void;
```

**存储位置：**
- `~/.openclaw/identity/device.json` — Ed25519 密钥对 + deviceId
- `~/.openclaw/identity/device-auth.json` — device token 缓存

**签名格式（参考 AionUi）：**
```
version|deviceId|clientId|clientMode|role|scopes|signedAtMs|token[|nonce]
```

### 5. Config (`config.ts`)

读取 OpenClaw 的配置文件。

```typescript
export interface OpenClawGatewayConfig {
  host: string;           // default: "127.0.0.1"
  port: number;           // default: 18789
  auth: {
    mode: "none" | "token" | "password";
    token?: string;
    password?: string;
  };
  cliPath: string;        // default: "openclaw"
  autoStart: boolean;     // default: true
}

export function loadOpenClawConfig(): OpenClawGatewayConfig;
```

**查找顺序：**
1. `~/.openclaw/openclaw.json` (JSON5 格式)
2. Legacy: `~/.clawdbot/clawdbot.json`
3. 环境变量：`OPENCLAW_STATE_DIR`, `OPENCLAW_CONFIG_PATH`
4. 默认值

### 6. Chat Proxy (`chat-proxy.ts`)

将 OpenClaw 的 session 交互转换为 viben 的 SSE 流格式。

```typescript
export class OpenClawChatProxy {
  async *stream(options: ChatOptions): AsyncGenerator<SSEMessage>;
  async steer(message: string): Promise<void>;
  async abort(): Promise<void>;
}
```

**流程：**
1. `ensureRunning()` → 确保 gateway
2. `connect()` → 建立 SDK 连接
3. `sessions.create` 或 `sessions.resolve` → 获取 session
4. `sessions.send` → 发送消息，获得 `runId`
5. 监听 `run.events()` → 通过 `EventMapper` 转换为 SSEMessage → yield
6. `run.completed` → yield result + return

### 7. Event Mapper (`event-mapper.ts`)

OpenClaw SDK 规范化事件到 Viben SSE 消息的映射。

```typescript
export function mapOpenClawEvent(event: OpenClawEvent): SSEMessage | null;
```

**映射表：**

| OpenClaw SDK 事件 | Viben SSEMessage |
|---|---|
| `assistant.delta` | `{ type: "text", content: delta }` |
| `assistant.message` | `{ type: "text", content: full }` |
| `tool.call.started` | `{ type: "tool_use", id, name, input }` |
| `tool.call.completed` | `{ type: "tool_result", tool_use_id, output, is_error }` |
| `tool.call.failed` | `{ type: "tool_result", tool_use_id, output: errorMsg, is_error: true }` |
| `approval.requested` | `{ type: "question", id, questions }` |
| `question.requested` | `{ type: "question", id, questions }` |
| `run.completed` | `{ type: "result", subtype: "success", cost, duration }` |
| `run.failed` | `{ type: "error", message }` |
| `run.cancelled` | `{ type: "result", subtype: "error" }` |
| `thinking.delta` | (忽略，或扩展 SSE 类型) |
| `session.created` | `{ type: "sdk_session", sdk_session_id }` |

## Task Executor 集成

### 执行流程

`viben task start <task> --executor OPENCLAW`：

1. 读取 task 配置和 `start.md` prompt
2. `OpenClawProcessManager.ensureRunning()` — 确保 gateway
3. `OpenClawConnectionManager.connect()` — 建立连接
4. `sessions.create({ key: taskId, ... })` — 创建 session
5. `sessions.send({ key, message: prompt })` — 发送 task prompt
6. 流式读取事件，写入 `start.log.jsonl`（与其他 executor 格式一致）
7. 运行结束 → 更新 task 状态

### 与现有 task phase 的适配

`packages/core/src/task/phase/start.ts` 中 `createCLIAdapter` 需要新增 `openclaw` platform：

```typescript
case "openclaw":
  // OpenClaw 不通过 CLI 命令执行，而是通过 SDK WebSocket
  // 需要在 startTask 中直接使用 OpenClawExecutor.spawn()
  return new OpenClawCLIAdapter();
```

## Desktop Chat 集成

### Gateway WebSocket 桥接

在 viben gateway 的 `/ws/agent/run` WebSocket 路由中，当 executor 类型为 `OPENCLAW` 时：
- 不使用 `SdkChatProxy`（那是 Claude Agent SDK 专用）
- 使用 `OpenClawChatProxy` 处理通信
- 前端消息协议不变（`start`, `answer`, `approve`, `cancel`, `steer`）

### 前端变更

- `ExecutorType` 联合类型中添加 `"OPENCLAW"`
- Executor 选择器 UI 中显示 OpenClaw 选项
- 无需新页面/组件，复用现有 workspace chat UI

## 类型注册

```typescript
// packages/core/src/types/index.ts
export type ExecutorType =
  | "CLAUDE_CODE" | "AMP" | "GEMINI" | "CODEX" | "OPENCODE"
  | "CURSOR_AGENT" | "QWEN_CODE" | "COPILOT" | "DROID"
  | "OPENCLAW"   // 新增
  // template-only types...
  | "CURSOR" | "IFLOW" | "KILO" | "KIRO" | "ANTIGRAVITY" | "WINDSURF" | "AIDER" | "CONTINUE";
```

## 依赖

新增 npm 依赖：
- `@openclaw/sdk` — OpenClaw 官方 SDK（WebSocket 通信、事件规范化）

设备身份所需的 Ed25519 加密操作使用 Node.js 内置 `crypto` 模块（`crypto.generateKeyPairSync('ed25519')`, `crypto.sign`），无需额外依赖。

## 配置集成

在 viben executor 配置系统中：

```typescript
// OpenClawExecutorConfig extends ExecutorConfig
export interface OpenClawExecutorConfig extends ExecutorConfig {
  /** Gateway 连接配置 (覆盖 ~/.openclaw/openclaw.json) */
  gateway?: {
    host?: string;
    port?: number;
    token?: string;
    password?: string;
  };
  /** 是否自动启动 gateway 进程 */
  autoStart?: boolean;
  /** openclaw CLI 路径 */
  cliPath?: string;
}
```

## 错误处理

| 场景 | 处理方式 |
|---|---|
| Gateway 未启动 + autoStart=true | 自动 spawn，等待就绪 |
| Gateway 未启动 + autoStart=false | 抛出 NOT_FOUND 错误 |
| 连接断开 | SDK 自动重连（指数退避 1s→30s） |
| 认证失败 | 抛出 NOT_AUTHENTICATED 错误 |
| 运行超时 | 调用 `sessions.abort` + 报告 TIMEOUT |
| 进程崩溃 | 自动重启 gateway + 重连 |

## 不在本次范围内

- OpenClaw 多 agent 路由（后续扩展）
- OpenClaw channel 集成（WhatsApp/Telegram 等）
- OpenClaw voice/canvas 功能
- OpenClaw 远程 gateway 连接（先实现本地）
- OpenClaw 插件/skill 管理
