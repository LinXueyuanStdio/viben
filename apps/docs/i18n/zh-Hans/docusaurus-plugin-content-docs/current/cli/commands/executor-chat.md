---
sidebar_position: 10
title: "viben executor chat"
description: "非交互式调用 AI coding agent"
---

# viben executor chat

非交互式调用 AI coding agent（如 Claude Code），提供与 `claude -p` 相同的输入/输出体验。

## 概述

为 `viben executor` 新增 `chat` 子命令，支持非交互式调用 AI coding agent。此命令直接调用底层执行器（如 Claude Code CLI），不经过 Agent 配置层。

**与 `viben agent chat` 的区别**：

| 命令 | 说明 |
|------|------|
| `viben executor chat` | 直接调用执行器，不加载 Agent 配置 |
| `viben agent chat` | 使用 Agent 配置（记忆、MCP、技能等）|

## 命令接口

```
viben executor chat [OPTIONS] -n <EXECUTOR_NAME>

OPTIONS:
    -n, --name <NAME>           执行器名称（如 CLAUDE_CODE, GEMINI）
    -p, --prompt <PROMPT>       提示词（可选，无则从 stdin 读取）
    -C, --cwd <DIR>             工作目录（默认当前目录）

    --input-format <FORMAT>     输入格式: text（默认）, stream-json
    --output-format <FORMAT>    输出格式: text（默认）, stream-json
    --verbose                   详细输出

    --session-id <ID>           指定会话 ID
    --resume <SESSION_ID>       恢复已有会话

    --model <MODEL>             指定模型（执行器支持时）
    --dangerously-skip-permissions  跳过权限检查
```

## 使用示例

```bash
# 基本用法
viben executor chat -n CLAUDE_CODE -p "分析这段代码"

# 从 stdin 读取纯文本
echo "写一个排序函数" | viben executor chat -n CLAUDE_CODE

# JSON 流式输入/输出（程序化调用）
echo '{"type":"user","message":{"role":"user","content":"分析代码"}}' | \
  viben executor chat -n CLAUDE_CODE --input-format stream-json --output-format stream-json

# 恢复会话
viben executor chat -n CLAUDE_CODE -p "继续之前的工作" --resume abc123
```

## 数据流架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        viben executor chat                       │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ChatCommand::execute()                      │
│  1. 解析参数                                                      │
│  2. 读取 prompt（从 -p 或 stdin）                                 │
│  3. 根据 --name 创建 CodingAgent                                 │
│  4. 调用 spawn_chat_process()                                    │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     ClaudeCode 执行器                            │
│  构建命令: claude -p "prompt" ...                                │
│  - 根据输入/输出格式添加相应参数                                   │
│  - 处理 --model, --dangerously-skip-permissions 等               │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      子进程 (claude)                             │
│  stdin  ◄──── 继承父进程 stdin                                   │
│  stdout ────► 继承父进程 stdout                                  │
│  stderr ────► 继承父进程 stderr                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 支持的执行器

| 执行器 | 支持 chat | 说明 |
|--------|----------|------|
| `CLAUDE_CODE` | 是 | Claude Code CLI |
| `GEMINI` | 是 | Gemini CLI |
| `CODEX` | 是 | OpenAI Codex |
| `CURSOR_AGENT` | 否 | Cursor 仅支持 IDE 模式 |
| `AMP` | 否 | 需要特定环境 |

## 代码实现

### 1. ChatOptions 接口

文件: `packages/core/src/cli/commands/executor.ts`

```typescript
// ExecutorAction chat 子命令
export interface ChatOptions {
  name: string;           // 执行器名称（如 CLAUDE_CODE, GEMINI）
  prompt?: string;        // 提示词（可选，无则从 stdin 读取）
  cwd?: string;           // 工作目录（默认当前目录）
  inputFormat?: string;   // 输入格式: text（默认）, stream-json
  outputFormat?: string;  // 输出格式: text（默认）, stream-json
  verbose?: boolean;      // 详细输出
  sessionId?: string;     // 指定会话 ID
  resume?: string;        // 恢复已有会话
  model?: string;         // 指定模型（执行器支持时）
  dangerouslySkipPermissions?: boolean;  // 跳过权限检查
}
```

### 2. executeChat 函数

```typescript
// packages/core/src/cli/commands/executor.ts
export async function executeChat(options: ChatOptions): Promise<void> {
  // 1. 确定工作目录
  const workDir = options.cwd || process.cwd();

  // 2. 读取 prompt（-p 优先，否则从 stdin）
  let prompt = options.prompt;
  if (!prompt) {
    prompt = await readStdin();
  }

  // 3. 根据 name 创建执行器（使用 spawnChat）
  const result = await spawnChat(options.name, {
    prompt,
    cwd: workDir,
    inputFormat: options.inputFormat || 'text',
    outputFormat: options.outputFormat || 'text',
    verbose: options.verbose,
    sessionId: options.sessionId,
    resume: options.resume,
    model: options.model,
    dangerouslySkipPermissions: options.dangerouslySkipPermissions,
  });

  // 4. 等待退出并返回状态码
  process.exit(result.exitCode);
}
```

### 3. spawnChat 函数

参考 `packages/core/src/executors/chat.ts` 中的 `spawnChat` 函数实现：

```typescript
// packages/core/src/executors/chat.ts
export async function spawnChat(
  executorType: string,
  options: ChatOptions
): Promise<ChatSpawnResult> {
  // 检查执行器是否支持 chat
  if (!executorSupportsChat(executorType)) {
    throw new ExecutorError(`执行器不支持 chat: ${executorType}`);
  }

  // 创建执行器实例
  const executor = createExecutor(executorType);

  // 构建命令参数
  const args = buildChatArgs(options);

  // 启动子进程，继承 IO
  const child = spawn(executor.command, args, {
    cwd: options.cwd,
    stdio: 'inherit',
  });

  // 等待退出
  const exitCode = await new Promise<number>((resolve) => {
    child.on('exit', (code) => resolve(code ?? 1));
  });

  return { exitCode };
}
```

### 4. 错误类型扩展

文件: `packages/core/src/error.ts`

```typescript
export class ExecutorError extends VibenError {
  constructor(message: string) {
    super(message, 'EXECUTOR_ERROR');
  }

  static chatNotSupported(executor: string): ExecutorError {
    return new ExecutorError(`执行器不支持 chat: ${executor}`);
  }

  static noPromptProvided(): ExecutorError {
    return new ExecutorError('未提供 prompt 且 stdin 为空');
  }
}
```

### 5. Chat 支持检查

文件: `packages/core/src/executors/chat.ts`

```typescript
// 支持 chat 的执行器类型
export const CHAT_SUPPORTED_EXECUTORS = ['CLAUDE_CODE', 'GEMINI', 'CODEX'] as const;

export function executorSupportsChat(executorType: string): boolean {
  return CHAT_SUPPORTED_EXECUTORS.includes(
    executorType.toUpperCase() as typeof CHAT_SUPPORTED_EXECUTORS[number]
  );
}
```

## 文件变更摘要

| 文件 | 变更 |
|------|------|
| `packages/core/src/cli/commands/executor.ts` | 添加 `chat` 子命令和 `executeChat` 函数 |
| `packages/core/src/error.ts` | 添加 `ExecutorError.chatNotSupported`, `noPromptProvided` 方法 |
| `packages/core/src/executors/chat.ts` | 添加 `executorSupportsChat()`, `spawnChat()` 函数 |

## 设计决策

1. **直接使用 `claude` 命令** - 假设用户已安装 Claude Code CLI，而非临时通过 npx 安装
2. **IO 透传** - 使用 `Stdio::inherit()` 保持与 claude 相同的输入/输出体验
3. **默认安全权限** - 遵循 claude code 的设计，默认需要权限检查
4. **可扩展架构** - 未来可通过 `supports_chat()` 和 `chat_command()` 方法支持添加其他执行器

## 相关命令

- [viben agent chat](./agent-chat) - 使用智能体配置进行对话
- [viben executor](./executor) - 执行器管理
- [viben agent](./agent) - 智能体管理
