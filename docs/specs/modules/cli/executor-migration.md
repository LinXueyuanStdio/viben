# Executor 统一迁移方案

> 将 `executors/executors/` (legacy) 的逻辑完全迁移到 `executors/engines/` (unified)，统一为单一执行器架构。

## 背景

当前 `packages/core/src/executors/` 目录中存在两套执行器实现：

| 目录 | 角色 | 接口 | 实例化方式 |
|------|------|------|-----------|
| `executors/executors/` | Legacy 实现 | `StandardCodingAgentExecutor` | `createExecutor()` switch 工厂 |
| `executors/engines/` | 统一实现 | `Executor` (extends BaseExecutor) | `getExecutor()` 注册表 |

两套系统共存导致：
- 同一个 executor 有两份实现代码
- 接口不一致，消费方混用两套 API
- 新增 executor 需要写两份代码

---

## 目标

1. `engines/` 成为唯一执行器实现目录
2. 所有消费方统一使用 `Executor` 接口 + `getExecutor()` 注册表
3. 删除 `executors/executors/` 目录及所有 legacy 类型
4. 测试全部通过

---

## 最终目录结构

```
packages/core/src/executors/
├── index.ts                    ← 统一公共 API（仅从 engines/ops/chat re-export）
├── command.ts
├── utils.ts
│
├── engines/                    ← 唯一执行器实现
│   ├── index.ts                ← 自注册触发 + barrel export
│   ├── base.ts                 ← BaseExecutor 抽象基类
│   ├── claude.ts
│   ├── amp.ts
│   ├── gemini.ts
│   ├── codex.ts
│   ├── opencode.ts
│   ├── cursor.ts
│   ├── qwen.ts
│   ├── copilot.ts
│   ├── droid.ts
│   └── openclaw/
│
├── ops/                        ← 注册表 + 类型 + 工具
│   ├── index.ts
│   ├── registry.ts
│   ├── types.ts                ← 唯一类型定义来源
│   └── utils.ts
│
└── chat/                       ← Chat proxy 子系统（保持不变）
    ├── index.ts
    ├── factory.ts
    ├── sdk-proxy.ts
    ├── spawn-proxy.ts
    └── types.ts
```

**删除的文件**：
- `executors/executors/` 整个目录（9 个 executor 文件 + index.ts）
- `executors/types.ts`（合并到 `ops/types.ts`）

---

## 接口对比与统一

### 删除的类型

| Legacy 符号 | 统一替代 |
|------------|---------|
| `StandardCodingAgentExecutor` | `Executor` |
| `SpawnedChild` | `ExecutionResult` |
| `ExecutionEnv` | `SpawnOptions` (内含 `cwd` + `env`) |
| `createExecutionEnv()` | 直接构造 `SpawnOptions` |
| `AgentCapability` (3 种) | `ExecutorCapability` (9 种) |
| `ExecutorExitResult` | `ExecutionResult.success` + `exitCode` |

### 删除的工厂/常量

| Legacy 符号 | 统一替代 |
|------------|---------|
| `createExecutor(type, config)` | `getExecutor(type, config)` |
| `getAllExecutorsAvailability()` | `getAvailableExecutors()` |
| `isExecutorType(str)` | `hasExecutor(str)` |
| `EXECUTOR_TYPES` | `getRegisteredTypes()` |
| `executorSupportsChat(type)` | `getExecutor(type).supports("CHAT")` |
| `CHAT_SUPPORTED_EXECUTORS` | `getRegisteredTypes().filter(t => getExecutor(t).supports("CHAT"))` |
| `createClaudeCode()` / `createAmp()` / ... | `getExecutor("CLAUDE_CODE")` / `getExecutor("AMP")` / ... |

### 删除的类名

| Legacy 类 | 统一替代 |
|-----------|---------|
| `ClaudeCode` | `ClaudeExecutor` |
| `Amp` | `AmpExecutor` |
| `Gemini` | `GeminiExecutor` |
| `Codex` | `CodexExecutor` |
| `Opencode` | `OpencodeExecutor` |
| `CursorAgent` | `CursorAgentExecutor` |
| `QwenCode` | `QwenCodeExecutor` |
| `Copilot` | `CopilotExecutor` |
| `Droid` | `DroidExecutor` |

### Config 类型统一

| Legacy Config | 统一替代 |
|--------------|---------|
| `ClaudeCodeConfig` | `ClaudeExecutorConfig` |
| `AmpConfig` | `AmpExecutorConfig` |
| `GeminiConfig` | `GeminiExecutorConfig` |
| `CodexConfig` | `CodexExecutorConfig` |
| `OpencodeConfig` | `OpencodeExecutorConfig` |
| `CursorAgentConfig` | `CursorAgentExecutorConfig` |
| `QwenCodeConfig` | `QwenCodeExecutorConfig` |
| `CopilotConfig` | `CopilotExecutorConfig` |
| `DroidConfig` | `DroidExecutorConfig` |

---

## 方法签名对比

### spawn

```typescript
// Legacy
async spawn(currentDir: string, prompt: string, env: ExecutionEnv): Promise<SpawnedChild>

// Unified
async spawn(options: SpawnOptions): Promise<ExecutionResult>
```

### spawnFollowUp → resume

```typescript
// Legacy
async spawnFollowUp(currentDir: string, prompt: string, sessionId: string, resetToMessageId: string | undefined, env: ExecutionEnv): Promise<SpawnedChild>

// Unified
async resume(sessionId: string, options?: Partial<SpawnOptions>): Promise<ExecutionResult>
```

### spawnChat → chat

```typescript
// Legacy
async spawnChat?(options: ChatOptions): Promise<ChatSpawnResult>  // ChatSpawnResult = { child, exitPromise }

// Unified
async chat(options: ChatOptions): Promise<ExecutionResult>
async chatStreaming(options: ChatOptions): AsyncGenerator<SSEMessage>
```

### capabilities

```typescript
// Legacy: 3 种
type AgentCapability = "SESSION_FORK" | "SETUP_HELPER" | "CONTEXT_USAGE";

// Unified: 9 种
type ExecutorCapability = "SPAWN" | "CHAT" | "CHAT_SDK" | "CHAT_STREAMING" | "SESSION_RESUME" | "SESSION_FORK" | "CONTEXT_USAGE" | "PLAN_MODE" | "APPROVALS";
```

---

## engines 需要吸收的 Legacy 逻辑

> 以下为 Review 后确认的实际缺口，按严重程度排序。

### GeminiExecutor — 🔴 严重缺口

| # | 缺失逻辑 | Legacy 行为 | Engines 当前行为 | 影响 |
|---|---------|------------|-----------------|------|
| 1 | `model` 字段 | `GeminiConfig.model` + `--model` flag | 配置接口无 `model` 字段，spawn 不传 model | 模型选择完全失效 |
| 2 | `--prompt` flag | `gemini --prompt "..."` | `gemini "..."` (裸参数) | 命令执行可能报错 |
| 3 | `defaultMcpConfigPath` | 返回 `~/.gemini/config.json` | 返回 `~/.gemini/settings.json` | MCP 配置找不到 |
| 4 | `outputFormat` 参数 | `stream-json` → `--output-format json` | `chat()` 不处理 format 参数 | format 控制丢失 |
| 5 | session resume 语义 | 明确 throw 不支持 | 实现了 `--resume` 参数 | 行为反转（需确认 Gemini CLI 是否真的支持） |

**修复方案**：
- 在 `GeminiExecutorConfig` 中增加 `model?: string`
- `spawn()` / `buildRunCommand()` 使用 `--prompt` flag + `--model` flag
- `defaultMcpConfigPath()` 改为 `~/.gemini/config.json`
- `chat()` 处理 `outputFormat` 参数
- 确认 Gemini CLI 是否支持 `--resume`，若不支持则 `resume()` 返回 `{ success: false }`

### ClaudeExecutor — 🟡 中等缺口

| # | 缺失逻辑 | Legacy 行为 | Engines 当前行为 | 影响 |
|---|---------|------------|-----------------|------|
| 1 | `planMode`/`approvals` 权限参数 | 注入 `--permission-prompt-tool=stdio --permission-mode=bypass` | 字段存在但 `spawn()` 从未读取 | 功能静默丢失 |
| 2 | `NPM_CONFIG_LOGLEVEL` env | 始终注入 `{ NPM_CONFIG_LOGLEVEL: "error" }` | 未注入 | npx 输出噪声日志 |
| 3 | `useApprovals()` 机制 | 持有 `approvalsService`，plan/approvals 模式注入 | 无对应机制 | 审批服务无法注入 |
| 4 | `chatStreaming` flags | `--include-partial-messages --replay-user-messages` | 未注入这两个 flag | 部分消息流行为差异 |
| 5 | 错误处理 | `throw ExecutorError.executableNotFound()` | `return { success: false }` | 错误传播语义不同（可接受） |

**修复方案**：
- `spawn()` 读取 `config.planMode` / `config.approvals` 并注入对应 CLI flags
- 在 spawn env 中注入 `NPM_CONFIG_LOGLEVEL: "error"`
- `chatStreaming()` 注入 `--include-partial-messages --replay-user-messages`
- `useApprovals()` 暂不迁移（router 已改用事件驱动，此机制仅用于 legacy 路径）

### CodexExecutor — 🟡 中等缺口

| # | 缺失逻辑 | Legacy 行为 | Engines 当前行为 | 影响 |
|---|---------|------------|-----------------|------|
| 1 | `CODEX_FOLLOWUP_PROMPT` env | resume 时通过 env var 传递 follow-up prompt | 无对应机制 | resume 追加 prompt 丢失 |
| 2 | chat 新建 session 命令 | `npx -y @openai/codex exec [OPTIONS] [PROMPT]` | `npx -y @openai/codex [OPTIONS] [PROMPT]` (无 `exec`) | CLI 参数不一致 |
| 3 | `defaultMcpConfigPath` 路径 | 依赖 `getConfigDir()` | 用 `getHomeDir() + "codex/config.json"` | 路径基准可能不同 |

**修复方案**：
- `resume()` / `chatStreaming()` 中 resume 路径注入 `CODEX_FOLLOWUP_PROMPT` env
- chat 新建 session 统一使用 `exec` 子命令
- 确认 `getConfigDir()` 与 `getHomeDir()` 的路径差异，统一

### AmpExecutor — 🟢 轻微

Engines 已是 legacy 超集，无实质缺口。仅需确认 `capabilities()` 声明是否包含 `"CHAT"`（当前不含）。

### CursorAgentExecutor / CopilotExecutor — ✅ 已对齐

`resume()` 已正确返回 `{ success: false, errorType: "INVALID_CONFIG" }`。

### 所有 Executor 共性

1. **`getAvailabilityInfo()`** — 检查配置文件存在 → LOGIN_DETECTED，否则检查 binary → INSTALLATION_FOUND，否则 NOT_FOUND
2. **env 合并** — legacy 通过 `ExecutionEnv.vars` 传入，unified 通过 `SpawnOptions.env` 传入

---

## 消费方改动

> Review 确认：外部 apps (desktop/web/cli) **零破坏**，仅 `@viben/core/shared` 导出的 `ExecutorType` 字符串枚举被使用。
> 所有破坏面集中在 `packages/core` 内部。

### 1. `services/container.ts` — 🔴 最高优先级（唯一真实高风险）

**风险确认**：container.ts 深度依赖 `ChildProcess.stdout` 做实时流解析（`stdout.on("data")` 逐行读 JSON → 广播事件）。直接替换为 `ExecutionResult` 会断裂整个 stdout 管道。

**正确迁移路径**：改用 `executor.chatStreaming()` (AsyncGenerator<SSEMessage>)

#### 阻塞性前提（Phase 1 必须先解决）

迁移前需在 engines 层补全以下能力，否则 chatStreaming 无法替代 raw stdout：

| 问题 | 说明 | 修复 |
|------|------|------|
| `"assistant"` 消息类型未在 SSEMessage 中建模 | Claude CLI 输出 `type: "assistant"` 的顶层消息（wrap content array），container 深度解包 | 在 `ops/types.ts` 中新增 `SSEAssistantMessage` type，或在 `chatStreaming()` 内解包后分别 yield text/tool_use |
| `SSEResultMessage` 缺少 `result` 字段 | container 读 `json.result`，SSEResultMessage 只有 `cost/duration/subtype` | 在 `SSEResultMessage` 中新增 `result?: string` 字段 |
| `SSEToolResultMessage` 字段名不匹配 | container 读 `.content`，SSEMessage 定义为 `.output` | 统一为 `.output`，container 迁移时同步修改字段名 |
| kill/cancel 无控制句柄 | `chatStreaming()` 不暴露底层 ChildProcess | 返回 `{ stream, abort }` 或通过 AbortSignal |
| exit code 不可观测 | 无法区分 code=0 和异常退出 | 在最终 `SSEResultMessage` 中携带 `exitCode` |
| `ChatOptions` 缺 `repoContext` | legacy `ExecutionEnv.repoContext` 有业务语义 | 在 `ChatOptions` 中新增 `repoContext?` 字段，或编码进 `env` |

#### 迁移代码示例（前提满足后）

```typescript
// Before
import type { ExecutionEnv, SpawnedChild, StandardCodingAgentExecutor } from "../executors/types";

async spawnAgent(executor: StandardCodingAgentExecutor, cwd, prompt, env): Promise<SpawnedChild> {
  const child = await executor.spawn(cwd, prompt, env);
  this.setupStdoutStreaming(child.child, sessionId, agentId, agentType);
  return child;
}

// After
import type { Executor, ChatOptions, SSEMessage } from "../executors";

async spawnAgent(executor: Executor, options: ChatOptions): Promise<{ abort: () => void }> {
  const { stream, abort } = executor.chatStreaming(options);

  (async () => {
    for await (const message of stream) {
      this.processSSEMessage(message, sessionId, agentId, agentType);
    }
    this.eventService.agentCompleted(agentType, sessionId, true);
  })().catch((err) => {
    this.eventService.agentCompleted(agentType, sessionId, false);
  });

  return { abort };
}
```

**PID 问题**：`chatStreaming()` 不暴露 PID。`ProcessState.pid` 仅用于状态记录，无下游依赖，迁移后置 `undefined`。

**`--include-partial-messages --replay-user-messages`**：engines `chatStreaming()` 当前未注入这两个 flag，需在 Phase 1.2 中补全。

### 2. `channels/router.ts` — 🟢 低风险（Review 确认无 ChildProcess 依赖）

**Review 发现**：router.ts 调用 `container.spawnAgent()` 后完全不使用返回的 `SpawnedChild.child`，响应收集通过 `ResponseCollector` 订阅 `EventService` 事件实现。

```typescript
// Before
import type { StandardCodingAgentExecutor } from "../executors/types";
import { createExecutor, isExecutorType, createExecutionEnv } from "../executors";

const executor = createExecutor(agentConfig.executor_type);
const env = createExecutionEnv(workspaceRoot, repoNames);
await this.container.spawnAgent(executor, cwd, prompt, env);  // 返回值被忽略

// After
import type { Executor } from "../executors";
import { getExecutor, hasExecutor } from "../executors";

const executor = getExecutor(agentConfig.executor_type);
await this.container.spawnAgent(executor, { prompt, cwd, env: vars });
```

改动仅在参数传递方式，不涉及逻辑变更。

### 3. `executors/chat/spawn-proxy.ts` — 🟢 低复杂度

**Review 发现**：chat/ 子系统中仅此一个文件依赖 legacy（`sdk-proxy.ts` 零依赖）。

```typescript
// Before
import type { StandardCodingAgentExecutor } from "../types";
import { createExecutor } from "../index";

class SpawnChatProxy {
  private executor: StandardCodingAgentExecutor;
  constructor(executorType: ExecutorType) {
    this.executor = createExecutor(executorType);
  }
  async execute(options) {
    return this.executor.spawnChat(options);
  }
}

// After
import type { Executor } from "../ops";
import { getExecutor } from "../ops";

class SpawnChatProxy {
  private executor: Executor;
  constructor(executorType: ExecutorType) {
    this.executor = getExecutor(executorType);
  }
  async execute(options) {
    return this.executor.chat(options);
  }
}
```

### 4. `cli/commands/agent.ts` — 中优先级

```typescript
// Before
import { EXECUTOR_TYPES, isExecutorType, executorSupportsChat, CHAT_SUPPORTED_EXECUTORS, createChatProxyAsync } from "../../executors";

// After
import { getRegisteredTypes, hasExecutor, getExecutor, createChatProxy } from "../../executors";
const types = getRegisteredTypes();
const valid = hasExecutor(input);
const supportsChat = getExecutor(type).supports("CHAT");
```

### 5. `group-chat/orchestrator.ts` — 中优先级

```typescript
// Before
import { executorSupportsChat, createChatProxyAsync } from "../executors";

// After
import { getExecutor, createChatProxy } from "../executors";
if (getExecutor(type).supports("CHAT")) { ... }
```

### 6. `cli/commands/executor.ts` — 低优先级（已部分迁移）

移除残留的 `createChatProxyAsync` 引用，全部使用 `getExecutor`。

### 7. 无需改动的消费方

以下仅使用 `SdkChatProxy`，不涉及 legacy API：
- `gateway/routes/agent-run.ts`
- `gateway/routes/agent-ws.ts`
- `gateway/queue/worker.ts`
- `idea/ops/generator.ts`
- `gateway/routes/mcp-inspector.ts`（仅用 `whichSync`）

### 8. 测试文件改写

| 文件 | 改写量 | 说明 |
|------|--------|------|
| `executors/index.test.ts` | 重写（984 行） | `instanceof ClaudeCode` → `instanceof ClaudeExecutor`，`createExecutor` → `getExecutor` |
| `executors/chat.test.ts` | 中等 | `new ClaudeCode()` → `getExecutor("CLAUDE_CODE")` |
| `cli/commands/executor-chat.test.ts` | 轻微 | mock `createExecutor` → mock `getExecutor` |
| `cli/commands/executor.test.ts` | 轻微 | 同上 |

---

## `executors/index.ts` 最终导出

```typescript
// === Registry ===
export { getExecutor, hasExecutor, registerExecutor, getRegisteredTypes, getAvailableExecutors } from "./ops";

// === Types ===
export type {
  Executor,
  ExecutorType,
  ExecutorConfig,
  ExecutorCapability,
  SpawnOptions,
  ChatOptions,
  ExecutionResult,
  AvailabilityInfo,
  AvailabilityStatus,
  SSEMessage,
  // ... 所有 SSE 子类型
} from "./ops";

// === Engine Classes (for instanceof / direct use) ===
export {
  BaseExecutor,
  ClaudeExecutor,
  AmpExecutor,
  GeminiExecutor,
  CodexExecutor,
  OpencodeExecutor,
  CursorAgentExecutor,
  QwenCodeExecutor,
  CopilotExecutor,
  DroidExecutor,
  OpenClawExecutor,
} from "./engines";

// === Engine Configs ===
export type {
  ClaudeExecutorConfig,
  AmpExecutorConfig,
  GeminiExecutorConfig,
  CodexExecutorConfig,
  OpencodeExecutorConfig,
  CursorAgentExecutorConfig,
  QwenCodeExecutorConfig,
  CopilotExecutorConfig,
  DroidExecutorConfig,
  OpenClawExecutorConfig,
} from "./engines";

// === Chat Proxy (保持) ===
export { SdkChatProxy, SpawnChatProxy, createChatProxy, chatProxyFactory } from "./chat";
export type { ChatProxy } from "./chat";

// === Utilities ===
export { whichSync, which } from "./ops/utils";
```

---

## 迁移步骤（按顺序执行）

### Phase 1: engines 补全

确保每个 engine class 已包含 legacy 中的所有运行时逻辑。

**1.1 GeminiExecutor（最高优先级，5 处修复）**
- [ ] `GeminiExecutorConfig` 添加 `model?: string` 字段
- [ ] `spawn()` / `buildRunCommand()` 使用 `--prompt` flag 传递 prompt
- [ ] `spawn()` / `buildRunCommand()` 支持 `--model` flag
- [ ] `defaultMcpConfigPath()` 改为 `~/.gemini/config.json`
- [ ] `chat()` 处理 `outputFormat: "stream-json"` → `--output-format json`
- [ ] 确认 Gemini CLI 是否支持 `--resume`。若不支持：`resume()` 返回 `{ success: false }`，`chat()` 中移除 resume 分支，`capabilities()` 中移除 `SESSION_RESUME`（三处均需修改）

**1.2 ClaudeExecutor（5 处修复）**
- [ ] `spawn()` 读取 `config.planMode` / `config.approvals`，注入 `--permission-prompt-tool=stdio --permission-mode=bypass`
- [ ] spawn env 中注入 `NPM_CONFIG_LOGLEVEL: "error"`
- [ ] `chatStreaming()` 注入 `--include-partial-messages --replay-user-messages`
- [ ] `chatStreaming()` 内部解包 `type: "assistant"` 消息：拆为独立的 text/tool_use 逐条 yield（而非盲转 `yield parsed as SSEMessage`）
- [ ] `useApprovals()` / `ExecutorApprovalService` 确认为 dead code（只写不读），Phase 4 中直接删除

**1.3 CodexExecutor（3 处修复）**
- [ ] `resume()` / `chatStreaming()` resume 路径注入 `CODEX_FOLLOWUP_PROMPT` 环境变量
- [ ] `chat()` 新建 session 命令统一使用 `exec` 子命令：`npx -y @openai/codex exec [OPTIONS] [PROMPT]`
- [ ] 确认 `defaultMcpConfigPath()` 路径基准与 legacy 一致

**1.4 其余 Executor（轻微/无改动）**
- [ ] AmpExecutor: 确认 `capabilities()` 声明合理性
- [ ] Opencode / QwenCode / Droid: 无缺口，跳过
- [ ] CursorAgent / Copilot: 已对齐，跳过

**1.5 SSEMessage 补全（container 迁移前提）**
- [ ] `ops/types.ts` 中 `SSEResultMessage` 新增 `result?: string` 和 `exitCode?: number` 字段
- [ ] 统一 `SSEToolResultMessage` 字段名为 `output`（container 迁移时同步改读取逻辑）
- [ ] `chatStreaming()` 返回值改为 `{ stream: AsyncGenerator<SSEMessage>, abort: () => void }`，暴露中断控制
- [ ] `ChatOptions` 新增 `repoContext?: { workspaceRoot: string; repoNames: string[] }` 字段（或编码进 `env`）

**1.6 类型迁移**
- [ ] 将 `executors/types.ts` 中仍需要的类型（`CommandBuilder`, `CommandParts` 等工具类型）迁入 `ops/types.ts` 或 `command.ts`
- [ ] 确保 `ExecutorType` 字符串联合体在 `ops/types.ts` 中完整定义
- [ ] 删除 `ExecutorApprovalService` 接口（dead code，只写不读）

**验证**：`engines/*.test.ts` 全部通过

### Phase 2: 改写 `executors/index.ts`

将 `executors/index.ts` 改为仅从 `engines/` + `ops/` + `chat/` 导出，不再从 `./executors` 导入。

> ⚠️ **不使用 alias 方案**：`getExecutor` 返回 `Executor` 接口，与 `StandardCodingAgentExecutor` 方法签名完全不同（`spawn(options)` vs `spawn(cwd, prompt, env)`），简单 alias 会导致编译失败。
> 同理 `hasExecutor(type: ExecutorType): boolean` 与 `isExecutorType(type: string): type is ExecutorType` 参数类型和 type guard 语义不同，不能 alias。

**策略**：Phase 2 和 Phase 3 合并执行。改写 `executors/index.ts` 时同步改写所有消费方。具体做法：

1. 在 `executors/index.ts` 中**保留** legacy 的 `from "./executors"` 导入（暂不删除）
2. **新增** unified 导出（从 `./engines` + `./ops`）
3. 让消费方逐个从 legacy 符号迁移到 unified 符号
4. 所有消费方迁移完成后，Phase 4 再删除 legacy 导出

需要新增的包装函数（保持向后兼容的 type guard）：
```typescript
// executors/index.ts 中新增
import { hasExecutor } from "./ops";
import type { ExecutorType } from "./ops";

/** Type guard: 验证 string 是否为合法 ExecutorType */
export function isExecutorType(type: string): type is ExecutorType {
  return hasExecutor(type as ExecutorType);
}
```

**验证**：`pnpm typecheck` 通过（legacy 和 unified 导出共存）

### Phase 3: 迁移消费方

按优先级逐个改写（每改完一个确保 `pnpm typecheck` 通过）：

1. **`services/container.ts`**（最高优先级，架构变更最大）
   - 将 `setupStdoutStreaming(ChildProcess)` 替换为 `for await (const msg of executor.chatStreaming())`
   - 接口从 `StandardCodingAgentExecutor` 改为 `Executor`
   - 删除 `SpawnedChild` / `ExecutionEnv` 类型依赖
2. **`channels/router.ts`**（与 container 联动）
   - `createExecutor` → `getExecutor`
   - `createExecutionEnv` → 直接构造 `ChatOptions`
   - `isExecutorType` → `hasExecutor`
3. **`executors/chat/spawn-proxy.ts`**（低复杂度，2 行 import 替换）
   - `StandardCodingAgentExecutor` → `Executor`
   - `createExecutor` → `getExecutor`
   - `executor.spawnChat()` → `executor.chat()`
4. **`cli/commands/agent.ts`**
   - `EXECUTOR_TYPES` → `getRegisteredTypes()`
   - `isExecutorType` → `hasExecutor`
   - `executorSupportsChat` / `CHAT_SUPPORTED_EXECUTORS` → `getExecutor(type).supports("CHAT")`
5. **`group-chat/orchestrator.ts`**
   - `executorSupportsChat` → `getExecutor(type).supports("CHAT")`
   - `createChatProxyAsync` → `createChatProxy`
6. **`cli/commands/executor.ts`**（已部分迁移，移除残留 legacy 引用）

**验证**：所有消费方编译通过，不再引用 legacy 符号

### Phase 4: 清理

1. **删除 legacy 导出**：从 `executors/index.ts` 中移除所有 `from "./executors"` 导入
2. **删除 `executors/executors/` 目录**（10 个文件）
3. **删除 `executors/types.ts`**（此时所有需要的类型已在 `ops/types.ts` 中）
4. **删除 dead code**：`ExecutorApprovalService` 接口、`useApprovals` 相关代码
5. **更新 `packages/core/src/index.ts` 公共 API**：

```typescript
// Before (legacy 导出，第 240-306 行)
export { createExecutor, EXECUTOR_TYPES, isExecutorType, getAllExecutorsAvailability } from "./executors";
export { ClaudeCode, createClaudeCode, Amp, createAmp, ... } from "./executors";
export type { StandardCodingAgentExecutor, SpawnedChild, ExecutionEnv, ... } from "./executors";
export type { ClaudeCodeConfig, AmpConfig, ... } from "./executors";

// After (unified 导出)
export { getExecutor, getRegisteredTypes, hasExecutor, getAvailableExecutors, isExecutorType } from "./executors";
export { ClaudeExecutor, AmpExecutor, GeminiExecutor, CodexExecutor, ... } from "./executors";
export type { Executor, ExecutorConfig, ExecutorCapability, SpawnOptions, ChatOptions, ExecutionResult, ... } from "./executors";
export type { ClaudeExecutorConfig, AmpExecutorConfig, GeminiExecutorConfig, ... } from "./executors";
// Chat proxy（不变）
export { SdkChatProxy, SpawnChatProxy, createChatProxy, chatProxyFactory } from "./executors";
```

6. **改写测试文件**：
   - `index.test.ts`（984 行，全面重写：class/factory/assertion 全部换新名）
   - `chat.test.ts`（`new ClaudeCode()` → `getExecutor("CLAUDE_CODE")`）
   - `executor-chat.test.ts`（mock 替换）
   - `executor.test.ts`（mock 替换）
   - 删除 `useApprovals` 相关测试用例

**验证**：
- `pnpm typecheck` 通过
- `pnpm test` 通过（executors 相关测试）
- `pnpm build` 通过（apps/web + apps/desktop + apps/cli）
- grep 确认零残留：`grep -r "StandardCodingAgentExecutor\|SpawnedChild\|ExecutionEnv\|createExecutor\|ClaudeCode\b\|ExecutorApprovalService" packages/core/src/ --include="*.ts" | grep -v test | grep -v ".d.ts"` 输出为空

---

## 风险点（两轮 Review 后更新）

| 风险 | 状态 | 结论 |
|------|------|------|
| router.ts 依赖 ChildProcess | ✅ 已排除 | router 不使用 SpawnedChild.child，事件驱动收集响应 |
| container.ts 依赖 ChildProcess | 🔴 确认存在 | 改用 `chatStreaming()` 替代 stdout 管道（详见消费方改动 §1） |
| SSEMessage 与 container 期望不匹配 | 🔴 新发现 | `"assistant"` type 缺失、`result` 字段名不同、`toolResult.output` vs `.content`（Phase 1.5 解决） |
| chatStreaming 无 kill/abort 控制 | 🔴 新发现 | 需改 chatStreaming 返回值为 `{ stream, abort }`（Phase 1.5 解决） |
| Phase 2 alias 方案不可行 | 🔴 新发现 | 返回类型/参数类型不兼容，改为 Phase 2+3 合并执行 |
| chat/factory.ts 引用 legacy | ✅ 已确认 | 仅 `spawn-proxy.ts` 依赖，改 2 行 import + 1 行方法调用 |
| `EXECUTOR_TYPES` 从常量变函数 | ⚠️ 存在 | Phase 3 中逐个替换 `EXECUTOR_TYPES.includes()` → `hasExecutor()` |
| OpenClaw 被 agent-ws.ts 直接引用 | ⚠️ 存在 | 保持通过 `engines/openclaw/` 路径引用，无需改动 |
| Gemini 命令格式错误（5 处） | 🔴 确认存在 | Phase 1.1 中全面修复 |
| Gemini resume 行为反转（3 处代码） | 🟡 确认存在 | 需确认 CLI 是否支持 `--resume`，不支持则回退 3 处代码 |
| Claude planMode/approvals 静默丢失 | 🟡 确认存在 | Phase 1.2 让 `spawn()` 读取 config 字段并注入 CLI flags |
| Claude chatStreaming 缺少 flags | 🟡 确认存在 | Phase 1.2 注入 `--include-partial-messages --replay-user-messages` |
| Codex `CODEX_FOLLOWUP_PROMPT` 丢失 | 🟡 确认存在 | Phase 1.3 resume 路径注入 env var |
| `useApprovals()` dead code 残留 | ⚠️ 确认为 dead code | Phase 4 直接删除（只写不读，无运行时效果） |
| `packages/core/src/index.ts` 公共 API | ⚠️ 需专项改写 | Phase 4 提供完整 before/after（已补充） |
| `ChatOptions` 缺 `repoContext` 字段 | 🟡 新发现 | Phase 1.5 中新增字段或编码进 env |
| 外部 apps 编译失败 | ✅ 已排除 | desktop/web/cli 仅用 `ExecutorType` 字符串枚举，零破坏 |

---

## Acceptance Criteria

- [ ] `executors/executors/` 目录已删除
- [ ] `executors/types.ts` 已删除
- [ ] 所有消费方使用 `Executor` 接口 + `getExecutor()` 注册表
- [ ] 无任何 `StandardCodingAgentExecutor` / `SpawnedChild` / `ExecutionEnv` / `createExecutor` 引用残留
- [ ] `pnpm typecheck` 通过
- [ ] `pnpm test` 通过
- [ ] `pnpm build` 通过（apps/web + apps/desktop）
- [ ] CLI 命令功能不变：`viben executor list`, `viben executor chat`
- [ ] Agent 执行功能不变：通过 gateway 和 CLI 启动 agent 正常工作

---

## Related Documents

- [executor.md](./executor.md) - Executor CLI 命令规格
- [executor-chat.md](./executor-chat.md) - Executor Chat 详细设计
- [agent.md](./agent.md) - Agent 管理命令
- `docs/superpowers/specs/2026-03-29-unified-executor-design.md` - 原始统一设计文档
