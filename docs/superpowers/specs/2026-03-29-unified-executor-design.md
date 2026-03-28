# Unified Executor Module Design

> 统一执行器模块设计文档

## 背景

当前代码库中存在三个分散的 AI 执行器抽象层：

1. **`StandardCodingAgentExecutor`** (`executors/types.ts`)
   - 低层进程启动接口
   - 方法：`spawn()`, `spawnFollowUp()`, `spawnChat()`

2. **`ICLIAdapter`** (`cli/lib/swarm/cli-adapter.ts`)
   - 平台特定的 CLI 命令构建
   - 方法：`buildRunCommand()`, `buildResumeCommand()`, `getAgentConfigPath()`

3. **`ChatProxy`** (`executors/chat/`)
   - 执行策略抽象（Spawn vs SDK）
   - 类型：`SpawnChatProxy`, `SdkChatProxy`

这三层存在职责重叠和调用关系不清晰的问题，需要统一为单一模块。

## 目标

1. 将三层合并为统一的 `executor/ops` 模块
2. 采用类似 `idea/ops` 的架构模式
3. 支持所有消费场景：Task Phase、Gateway API、CLI 命令
4. 使用现有的 `ExecutorType` 作为统一标识符

## 模块架构

```
packages/core/src/executor/
├── ops/
│   ├── index.ts           # 统一导出
│   ├── types.ts           # 核心类型定义
│   ├── registry.ts        # 执行器注册表
│   ├── spawn.ts           # 进程启动操作
│   ├── chat.ts            # 聊天执行操作
│   ├── session.ts         # 会话管理
│   ├── availability.ts    # 可用性检测
│   └── command.ts         # 命令构建
├── platforms/
│   ├── index.ts           # 平台注册入口
│   ├── claude.ts          # CLAUDE_CODE 实现
│   ├── gemini.ts          # GEMINI 实现
│   ├── codex.ts           # CODEX 实现
│   ├── opencode.ts        # OPENCODE 实现
│   ├── amp.ts             # AMP 实现
│   ├── cursor.ts          # CURSOR_AGENT 实现
│   ├── qwen.ts            # QWEN_CODE 实现
│   ├── copilot.ts         # COPILOT 实现
│   └── droid.ts           # DROID 实现
└── index.ts               # 模块入口
```

## 核心类型

### ExecutorCapability

```typescript
/**
 * 执行器能力
 */
export type ExecutorCapability =
  | "spawn"           // 支持 spawn 进程
  | "chat"            // 支持非交互式 chat
  | "chat_sdk"        // 支持 SDK 模式 chat
  | "chat_streaming"  // 支持流式 chat
  | "session_resume"  // 支持会话恢复
  | "session_fork"    // 支持会话分叉
  | "context_usage"   // 支持上下文使用统计
  | "plan_mode"       // 支持 plan 模式
  | "approvals";      // 支持审批模式
```

### AvailabilityInfo

```typescript
/**
 * 可用性状态
 */
export type AvailabilityStatus =
  | "available"        // 已登录/可用
  | "installed"        // 已安装但未登录
  | "not_found";       // 未安装

/**
 * 可用性信息
 */
export interface AvailabilityInfo {
  status: AvailabilityStatus;
  path?: string;
  lastAuthTimestamp?: number;
  error?: string;
}
```

### SpawnOptions & SpawnResult

```typescript
/**
 * Spawn 选项
 */
export interface SpawnOptions {
  /** 工作目录 */
  cwd: string;
  /** 提示词 */
  prompt: string;
  /** 环境变量 */
  env?: Record<string, string>;
  /** 会话 ID（新建会话时指定） */
  sessionId?: string;
  /** 模型 */
  model?: string;
  /** 跳过权限检查 */
  skipPermissions?: boolean;
  /** 详细输出 */
  verbose?: boolean;
  /** JSON 输出格式 */
  jsonOutput?: boolean;
  /** 后台运行 */
  detach?: boolean;
}

/**
 * Spawn 结果
 */
export interface SpawnResult {
  success: boolean;
  pid?: number;
  sessionId?: string;
  logFile?: string;
  error?: string;
}
```

### ChatOptions & ChatResult

```typescript
/**
 * Chat 选项（合并 ChatOptions + ChatProxyOptions）
 */
export interface ChatOptions {
  /** 提示词 */
  prompt: string;
  /** 工作目录 */
  cwd?: string;
  /** 输入格式 */
  inputFormat?: "text" | "stream-json";
  /** 输出格式 */
  outputFormat?: "text" | "stream-json";
  /** 详细输出 */
  verbose?: boolean;
  /** 会话 ID */
  sessionId?: string;
  /** 恢复会话 */
  resume?: string;
  /** 模型 */
  model?: string;
  /** 跳过权限检查 */
  skipPermissions?: boolean;
  /** 环境变量 */
  env?: Record<string, string>;
  /** 系统提示词 */
  systemPrompt?: string;
  /** 追加提示词 */
  appendPrompt?: string;
  /** 允许的工具 */
  allowedTools?: string[];
  /** 禁用的工具 */
  disallowedTools?: string[];
  /** MCP 服务器 */
  mcpServers?: string[];
  /** 技能 */
  skills?: string[];
  /** 权限模式 */
  permissionMode?: string;
  /** 优先使用 SDK 模式 */
  preferSdk?: boolean;
}

/**
 * Chat 结果
 */
export interface ChatResult {
  exitCode: number;
  sessionId?: string;
  error?: string;
}
```

### SSE Message Types

```typescript
export interface SSETextMessage {
  type: "text";
  content: string;
}

export interface SSEToolUseMessage {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
}

export interface SSEToolResultMessage {
  type: "tool_result";
  toolUseId: string;
  output: string;
  isError?: boolean;
}

export interface SSEResultMessage {
  type: "result";
  subtype?: "success" | "error";
  cost?: number;
  duration?: number;
}

export interface SSEErrorMessage {
  type: "error";
  message: string;
}

export interface SSEQuestionMessage {
  type: "question";
  id: string;
  questions: Array<{
    question: string;
    header: string;
    options: Array<{ label: string; description?: string }>;
    multiSelect: boolean;
  }>;
}

export interface SSESdkSessionMessage {
  type: "sdk_session";
  sdkSessionId: string;
}

export type SSEMessage =
  | SSETextMessage
  | SSEToolUseMessage
  | SSEToolResultMessage
  | SSEResultMessage
  | SSEErrorMessage
  | SSEQuestionMessage
  | SSESdkSessionMessage;
```

### Executor Interface

```typescript
import type { ExecutorType } from "../../types";

/**
 * 命令构建选项
 */
export interface RunCommandOptions {
  agent: string;
  prompt: string;
  sessionId?: string;
  skipPermissions?: boolean;
  verbose?: boolean;
  jsonOutput?: boolean;
}

/**
 * 执行器配置
 */
export interface ExecutorConfig {
  model?: string;
  appendPrompt?: string;
  planMode?: boolean;
  approvals?: boolean;
  skipPermissions?: boolean;
  baseCommandOverride?: string;
  env?: Record<string, string>;
}

/**
 * 统一执行器接口
 */
export interface Executor {
  /** 执行器类型标识 */
  readonly type: ExecutorType;

  // === 能力检测 ===

  /** 获取可用性信息 */
  getAvailability(): AvailabilityInfo;

  /** 获取支持的能力列表 */
  getCapabilities(): ExecutorCapability[];

  /** 检查是否支持某个能力 */
  supports(capability: ExecutorCapability): boolean;

  // === 配置 ===

  /** 获取 MCP 配置文件路径 */
  getMcpConfigPath(): string | null;

  /** 获取平台配置目录名（如 .claude, .gemini） */
  getConfigDirName(): string;

  /** 获取平台配置目录完整路径 */
  getConfigDir(projectRoot: string): string;

  /** 获取 agent 配置文件路径 */
  getAgentConfigPath(agent: string, projectRoot: string): string;

  /** 获取 commands 目录路径 */
  getCommandsPath(projectRoot: string, ...parts: string[]): string;

  /** 获取 viben 命令相对路径 */
  getVibenCommandPath(name: string): string;

  // === 命令构建 ===

  /** 获取 CLI 可执行文件名 */
  getCliName(): string;

  /** 构建运行命令 */
  buildRunCommand(options: RunCommandOptions): string[];

  /** 构建恢复命令 */
  buildResumeCommand(sessionId: string): string[];

  /** 获取恢复命令字符串（用于显示） */
  getResumeCommandStr(sessionId: string, cwd?: string): string;

  /** 获取非交互模式环境变量 */
  getNonInteractiveEnv(): Record<string, string>;

  /** 从日志提取会话 ID */
  extractSessionIdFromLog(logContent: string): string | null;

  // === 执行操作 ===

  /** 启动进程（交互式，用于 task phase） */
  spawn(options: SpawnOptions): Promise<SpawnResult>;

  /** 非交互式 chat（用于 CLI 和 Gateway） */
  chat(options: ChatOptions): Promise<ChatResult>;

  /** 流式 chat（用于 Gateway WebSocket/SSE） */
  chatStreaming(options: ChatOptions): AsyncGenerator<SSEMessage>;

  /** 恢复会话 */
  resume(sessionId: string, options?: Partial<SpawnOptions>): Promise<SpawnResult>;

  // === 平台特性 ===

  /** 是否支持在创建时指定会话 ID */
  supportsSessionIdOnCreate(): boolean;

  /** 是否支持 CLI agent 执行 */
  supportsCLIAgents(): boolean;
}
```

## 注册表

```typescript
import type { Executor, ExecutorConfig } from "./types";
import type { ExecutorType } from "../../types";

type ExecutorFactory = (config?: ExecutorConfig) => Executor;

const registry = new Map<ExecutorType, ExecutorFactory>();

/**
 * 注册执行器工厂
 */
export function registerExecutor(type: ExecutorType, factory: ExecutorFactory): void {
  registry.set(type, factory);
}

/**
 * 获取执行器
 */
export function getExecutor(type: ExecutorType, config?: ExecutorConfig): Executor {
  const factory = registry.get(type);
  if (!factory) {
    throw new Error(`Unknown executor type: ${type}`);
  }
  return factory(config);
}

/**
 * 检查执行器是否已注册
 */
export function hasExecutor(type: ExecutorType): boolean {
  return registry.has(type);
}

/**
 * 获取所有已注册的执行器类型
 */
export function getRegisteredTypes(): ExecutorType[] {
  return Array.from(registry.keys());
}

/**
 * 获取所有可用的执行器
 */
export function getAvailableExecutors(): Array<{
  type: ExecutorType;
  executor: Executor;
  availability: AvailabilityInfo;
}> {
  const result: Array<{
    type: ExecutorType;
    executor: Executor;
    availability: AvailabilityInfo;
  }> = [];

  for (const type of registry.keys()) {
    const executor = getExecutor(type);
    const availability = executor.getAvailability();
    if (availability.status !== "not_found") {
      result.push({ type, executor, availability });
    }
  }

  return result;
}
```

## 平台实现示例

### CLAUDE_CODE

```typescript
// packages/core/src/executor/platforms/claude.ts

import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type {
  Executor,
  ExecutorCapability,
  ExecutorConfig,
  AvailabilityInfo,
  SpawnOptions,
  SpawnResult,
  ChatOptions,
  ChatResult,
  SSEMessage,
  RunCommandOptions,
} from "../ops/types";
import { registerExecutor } from "../ops/registry";
import { which, whichSync } from "../ops/utils";

class ClaudeExecutor implements Executor {
  readonly type = "CLAUDE_CODE" as const;
  private config: ExecutorConfig;

  constructor(config: ExecutorConfig = {}) {
    this.config = config;
  }

  // === 能力检测 ===

  getAvailability(): AvailabilityInfo {
    const authFile = join(homedir(), ".claude.json");
    const execPath = whichSync("claude");

    if (existsSync(authFile)) {
      return {
        status: "available",
        lastAuthTimestamp: Date.now(),
        path: execPath ?? undefined,
      };
    }

    if (execPath) {
      return {
        status: "installed",
        path: execPath,
      };
    }

    return { status: "not_found" };
  }

  getCapabilities(): ExecutorCapability[] {
    return [
      "spawn",
      "chat",
      "chat_sdk",
      "chat_streaming",
      "session_resume",
      "session_fork",
      "context_usage",
      "plan_mode",
      "approvals",
    ];
  }

  supports(capability: ExecutorCapability): boolean {
    return this.getCapabilities().includes(capability);
  }

  // === 配置 ===

  getMcpConfigPath(): string | null {
    return join(homedir(), ".claude.json");
  }

  getConfigDirName(): string {
    return ".claude";
  }

  getConfigDir(projectRoot: string): string {
    return join(projectRoot, this.getConfigDirName());
  }

  getAgentConfigPath(agent: string, projectRoot: string): string {
    return join(this.getConfigDir(projectRoot), "agents", `${agent}.md`);
  }

  getCommandsPath(projectRoot: string, ...parts: string[]): string {
    if (parts.length === 0) {
      return join(this.getConfigDir(projectRoot), "commands");
    }
    return join(this.getConfigDir(projectRoot), "commands", ...parts);
  }

  getVibenCommandPath(name: string): string {
    return `.claude/commands/viben/${name}.md`;
  }

  // === 命令构建 ===

  getCliName(): string {
    return "claude";
  }

  buildRunCommand(options: RunCommandOptions): string[] {
    const {
      agent,
      prompt,
      sessionId,
      skipPermissions = true,
      verbose = true,
      jsonOutput = true,
    } = options;

    const cmd = ["claude", "-p", "--agent", agent];

    if (sessionId) {
      cmd.push("--session-id", sessionId);
    }

    if (skipPermissions) {
      cmd.push("--dangerously-skip-permissions");
    }

    if (jsonOutput) {
      cmd.push("--output-format", "stream-json", "--verbose");
    } else if (verbose) {
      cmd.push("--verbose");
    }

    cmd.push(prompt);
    return cmd;
  }

  buildResumeCommand(sessionId: string): string[] {
    return ["claude", "--resume", sessionId];
  }

  getResumeCommandStr(sessionId: string, cwd?: string): string {
    const cmd = this.buildResumeCommand(sessionId).join(" ");
    return cwd ? `cd ${cwd} && ${cmd}` : cmd;
  }

  getNonInteractiveEnv(): Record<string, string> {
    return { CLAUDE_NON_INTERACTIVE: "1" };
  }

  extractSessionIdFromLog(_logContent: string): string | null {
    // Claude Code session ID is passed via --session-id, not extracted from logs
    return null;
  }

  // === 平台特性 ===

  supportsSessionIdOnCreate(): boolean {
    return true;
  }

  supportsCLIAgents(): boolean {
    return true;
  }

  // === 执行操作 ===

  async spawn(options: SpawnOptions): Promise<SpawnResult> {
    // 实现 spawn 逻辑
    // ...
  }

  async chat(options: ChatOptions): Promise<ChatResult> {
    // 实现 chat 逻辑（可选择 SDK 或 Spawn 模式）
    // ...
  }

  async *chatStreaming(options: ChatOptions): AsyncGenerator<SSEMessage> {
    // 实现流式 chat 逻辑
    // ...
  }

  async resume(sessionId: string, options?: Partial<SpawnOptions>): Promise<SpawnResult> {
    // 实现 resume 逻辑
    // ...
  }
}

// 自动注册
registerExecutor("CLAUDE_CODE", (config) => new ClaudeExecutor(config));

export { ClaudeExecutor };
```

## CRUD 操作导出

```typescript
// packages/core/src/executor/ops/index.ts

// =============================================================================
// Types
// =============================================================================

export type {
  // Core types
  ExecutorCapability,
  AvailabilityStatus,
  AvailabilityInfo,
  // Spawn types
  SpawnOptions,
  SpawnResult,
  // Chat types
  ChatOptions,
  ChatResult,
  // SSE types
  SSETextMessage,
  SSEToolUseMessage,
  SSEToolResultMessage,
  SSEResultMessage,
  SSEErrorMessage,
  SSEQuestionMessage,
  SSESdkSessionMessage,
  SSEMessage,
  // Command types
  RunCommandOptions,
  // Config types
  ExecutorConfig,
  // Main interface
  Executor,
} from "./types";

// Re-export ExecutorType from main types
export type { ExecutorType } from "../../types";

// =============================================================================
// Registry Operations
// =============================================================================

export {
  registerExecutor,
  getExecutor,
  hasExecutor,
  getRegisteredTypes,
  getAvailableExecutors,
} from "./registry";

// =============================================================================
// Convenience Operations
// =============================================================================

export {
  // Spawn operations
  spawnExecutor,
  spawnWithLog,
} from "./spawn";

export {
  // Chat operations
  chat,
  chatStreaming,
  isSdkAvailable,
} from "./chat";

export {
  // Session operations
  resumeSession,
  listSessions,
} from "./session";

export {
  // Availability operations
  checkAvailability,
  getAllAvailability,
} from "./availability";

export {
  // Command building
  buildRunCommand,
  buildResumeCommand,
} from "./command";

// =============================================================================
// Utilities
// =============================================================================

export {
  which,
  whichSync,
  getConfigDir,
  getDataDir,
} from "./utils";
```

## 迁移计划

### 阶段 1: 创建新模块结构

1. 创建 `packages/core/src/executor/` 目录结构
2. 定义 `ops/types.ts` 核心类型
3. 实现 `ops/registry.ts` 注册表

### 阶段 2: 迁移平台实现

1. 将 `executors/executors/*.ts` 迁移到 `executor/platforms/`
2. 每个平台实现 `Executor` 接口
3. 保留原有模块作为兼容层

### 阶段 3: 更新消费方

1. 更新 `task/phase/work.ts` 使用新接口
2. 更新 Gateway routes 使用新接口
3. 更新 CLI commands 使用新接口

### 阶段 4: 清理旧代码

1. 删除 `executors/` 旧目录
2. 删除 `cli/lib/swarm/cli-adapter.ts`
3. 更新所有导入路径

## 兼容性

### 向后兼容

在迁移期间，保留旧的导出路径作为别名：

```typescript
// packages/core/src/executors/index.ts (兼容层)
export * from "../executor/ops";
export { getExecutor as createExecutor } from "../executor/ops/registry";
```

### ExecutorType 映射

| ExecutorType | 原 Platform | CLI 名称 | 配置目录 |
|-------------|------------|---------|---------|
| `CLAUDE_CODE` | `claude` | `claude` | `.claude` |
| `GEMINI` | `gemini` | `gemini` | `.gemini` |
| `CODEX` | `codex` | `codex` | `.agents` |
| `OPENCODE` | `opencode` | `opencode` | `.opencode` |
| `AMP` | - | `amp` | `.amp` |
| `CURSOR_AGENT` | `cursor` | `cursor` | `.cursor` |
| `QWEN_CODE` | - | `qwen` | `.qwen` |
| `COPILOT` | - | `copilot` | `.github` |
| `DROID` | - | `droid` | `.droid` |

## 测试策略

1. **单元测试**: 每个平台实现的独立测试
2. **集成测试**: 注册表和工厂函数测试
3. **端到端测试**: Task Phase 和 Gateway 场景测试

## 风险与缓解

| 风险 | 缓解措施 |
|-----|---------|
| 迁移中断现有功能 | 分阶段迁移，保留兼容层 |
| SDK 模式不稳定 | 保留 Spawn 模式作为 fallback |
| 平台特性差异大 | 通过能力检测动态适配 |

## 时间线估计

- 阶段 1: 1 天
- 阶段 2: 2-3 天
- 阶段 3: 2 天
- 阶段 4: 1 天

**总计**: 约 6-7 天
