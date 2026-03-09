# Executor Chat 命令设计

## 概述

为 `viben executor` 新增 `chat` 子命令，支持非交互式方式调用 AI coding agent（如 Claude Code），实现与 `claude -p` 一致的输入输出体验。

## 命令接口

```
viben executor chat [OPTIONS] -n <EXECUTOR_NAME>

OPTIONS:
    -n, --name <NAME>           Executor 名称 (如 CLAUDE_CODE, GEMINI)
    -p, --prompt <PROMPT>       提示词（可选，无则从 stdin 读取）
    -C, --cwd <DIR>             工作目录（默认当前目录）

    --input-format <FORMAT>     输入格式: text (默认), stream-json
    --output-format <FORMAT>    输出格式: text (默认), stream-json
    --verbose                   详细输出

    --session-id <ID>           指定 session ID
    --resume <SESSION_ID>       恢复已有 session

    --model <MODEL>             指定模型（executor 支持时）
    --dangerously-skip-permissions  跳过权限检查
```

## 使用示例

```bash
# 基本用法
viben executor chat -n CLAUDE_CODE -p "分析这段代码"

# 从 stdin 读取纯文本
echo "写一个排序函数" | viben executor chat -n CLAUDE_CODE

# JSON 流输入输出（用于程序化调用）
echo '{"type":"user","message":{"role":"user","content":"分析代码"}}' | \
  viben executor chat -n CLAUDE_CODE --input-format stream-json --output-format stream-json

# 恢复 session
viben executor chat -n CLAUDE_CODE -p "继续上面的工作" --resume abc123
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
│  2. 读取 prompt (从 -p 或 stdin)                                  │
│  3. 根据 --name 创建 CodingAgent                                  │
│  4. 调用 spawn_chat_process()                                    │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     ClaudeCode executor                          │
│  构建命令: claude -p "prompt" ...                                │
│  - 根据 input/output format 添加对应参数                          │
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

## 代码实现

### 1. ExecutorAction 枚举扩展

文件: `packages/core/src/cli/commands/executor.ts`

```typescript
// ExecutorAction chat 子命令
export interface ChatOptions {
  name: string;           // Executor 名称 (如 CLAUDE_CODE, GEMINI)
  prompt?: string;        // 提示词（可选，无则从 stdin 读取）
  cwd?: string;           // 工作目录（默认当前目录）
  inputFormat?: string;   // 输入格式: text (默认), stream-json
  outputFormat?: string;  // 输出格式: text (默认), stream-json
  verbose?: boolean;      // 详细输出
  sessionId?: string;     // 指定 session ID
  resume?: string;        // 恢复已有 session
  model?: string;         // 指定模型（executor 支持时）
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

  // 3. 根据 name 创建 executor（使用 spawnChat）
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
  // 检查 executor 是否支持 chat
  if (!executorSupportsChat(executorType)) {
    throw new ExecutorError(`Chat not supported for executor: ${executorType}`);
  }

  // 创建 executor 实例
  const executor = createExecutor(executorType);

  // 构建命令参数
  const args = buildChatArgs(options);

  // spawn 子进程，继承 IO
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
    return new ExecutorError(`Chat not supported for executor: ${executor}`);
  }

  static noPromptProvided(): ExecutorError {
    return new ExecutorError('No prompt provided and stdin is empty');
  }
}
```

### 5. Chat 支持检查

文件: `packages/core/src/executors/chat.ts`

```typescript
// 支持 chat 的 executor 类型
export const CHAT_SUPPORTED_EXECUTORS = ['CLAUDE_CODE', 'GEMINI', 'CODEX'] as const;

export function executorSupportsChat(executorType: string): boolean {
  return CHAT_SUPPORTED_EXECUTORS.includes(
    executorType.toUpperCase() as typeof CHAT_SUPPORTED_EXECUTORS[number]
  );
}
```

## 文件变更总结

| 文件 | 变更 |
|------|------|
| `packages/core/src/cli/commands/executor.ts` | 新增 `chat` 子命令和 `executeChat` 函数 |
| `packages/core/src/error.ts` | 新增 `ExecutorError.chatNotSupported`, `noPromptProvided` 方法 |
| `packages/core/src/executors/chat.ts` | 新增 `executorSupportsChat()`, `spawnChat()` 函数 |

## 设计决策

1. **直接使用 `claude` 命令** - 假设用户已安装 Claude Code CLI，而非通过 npx 临时安装
2. **IO 透传** - 使用 `Stdio::inherit()` 保持与 claude 完全一致的输入输出体验
3. **权限默认安全** - 遵循 claude code 的设计，默认需要权限检查
4. **架构可扩展** - 通过 `supports_chat()` 和 `chat_command()` 方法支持未来添加其他 executor
