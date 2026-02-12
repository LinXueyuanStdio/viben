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

文件: `crates/viben-core/src/cli/commands/executor.rs`

```rust
#[derive(Subcommand)]
pub enum ExecutorAction {
    List,
    Show { name: String },
    Types,
    /// Run chat with an executor (non-interactive)
    Chat {
        /// Executor name (e.g., CLAUDE_CODE)
        #[arg(short, long)]
        name: String,

        /// Prompt (reads from stdin if not provided)
        #[arg(short, long)]
        prompt: Option<String>,

        /// Working directory
        #[arg(short = 'C', long)]
        cwd: Option<PathBuf>,

        /// Input format
        #[arg(long, default_value = "text")]
        input_format: String,

        /// Output format
        #[arg(long, default_value = "text")]
        output_format: String,

        /// Verbose output
        #[arg(long)]
        verbose: bool,

        /// Session ID
        #[arg(long)]
        session_id: Option<String>,

        /// Resume existing session
        #[arg(long)]
        resume: Option<String>,

        /// Model to use
        #[arg(long)]
        model: Option<String>,

        /// Skip permission checks
        #[arg(long)]
        dangerously_skip_permissions: bool,
    },
}
```

### 2. execute_chat 方法

```rust
impl ExecutorCommand {
    async fn execute_chat(
        name: String,
        prompt: Option<String>,
        cwd: Option<PathBuf>,
        input_format: String,
        output_format: String,
        verbose: bool,
        session_id: Option<String>,
        resume: Option<String>,
        model: Option<String>,
        dangerously_skip_permissions: bool,
    ) -> CliResult<()> {
        // 1. 确定工作目录
        let work_dir = cwd.unwrap_or_else(|| std::env::current_dir().unwrap());

        // 2. 读取 prompt（-p 优先，否则从 stdin）
        let prompt = match prompt {
            Some(p) => p,
            None => {
                let mut buffer = String::new();
                std::io::stdin().read_to_string(&mut buffer)?;
                buffer
            }
        };

        // 3. 根据 name 创建 executor（目前仅支持 CLAUDE_CODE）
        let executor = match name.to_uppercase().as_str() {
            "CLAUDE_CODE" => CodingAgent::ClaudeCode(ClaudeCode::default()),
            _ => return Err(CliError::NotSupported(
                format!("Chat not supported for executor: {}", name)
            )),
        };

        // 4. 构建并执行命令
        let mut child = spawn_chat_process(
            &executor,
            &work_dir,
            &prompt,
            &input_format,
            &output_format,
            verbose,
            session_id,
            resume,
            model,
            dangerously_skip_permissions,
        ).await?;

        // 5. 等待退出并返回状态码
        let status = child.wait().await?;
        std::process::exit(status.code().unwrap_or(1));
    }
}
```

### 3. spawn_chat_process 函数

```rust
async fn spawn_chat_process(
    executor: &CodingAgent,
    work_dir: &Path,
    prompt: &str,
    input_format: &str,
    output_format: &str,
    verbose: bool,
    session_id: Option<String>,
    resume: Option<String>,
    model: Option<String>,
    dangerously_skip_permissions: bool,
) -> CliResult<tokio::process::Child> {
    // 目前仅支持 CLAUDE_CODE
    let mut cmd = tokio::process::Command::new("claude");
    cmd.current_dir(work_dir);

    // 核心参数
    cmd.arg("-p");

    // input-format 为 text 时，prompt 作为参数传入
    // input-format 为 stream-json 时，prompt 通过 stdin 传入
    if input_format == "text" {
        cmd.arg(prompt);
    }

    // 格式参数
    if input_format != "text" {
        cmd.args(["--input-format", input_format]);
    }
    if output_format != "text" {
        cmd.args(["--output-format", output_format]);
    }

    // 可选参数
    if verbose {
        cmd.arg("--verbose");
    }
    if let Some(id) = &session_id {
        cmd.args(["--session-id", id]);
    }
    if let Some(id) = &resume {
        cmd.args(["--resume", id]);
    }
    if let Some(m) = &model {
        cmd.args(["--model", m]);
    }
    if dangerously_skip_permissions {
        cmd.arg("--dangerously-skip-permissions");
    }

    // IO 设置 - 直接继承父进程的 IO
    cmd.stdin(Stdio::inherit());
    cmd.stdout(Stdio::inherit());
    cmd.stderr(Stdio::inherit());

    let child = cmd.spawn()?;
    Ok(child)
}
```

### 4. 错误类型扩展

文件: `crates/viben-core/src/cli/error.rs`

```rust
pub enum CliError {
    // ... 现有错误 ...
    #[error("Chat not supported for executor: {0}")]
    ChatNotSupported(String),
    #[error("No prompt provided and stdin is empty")]
    NoPromptProvided,
}
```

### 5. CodingAgent 扩展方法

文件: `crates/viben-core/src/executors/executors/mod.rs`

```rust
impl CodingAgent {
    /// Check if this executor supports chat command
    pub fn supports_chat(&self) -> bool {
        matches!(self, CodingAgent::ClaudeCode(_))
        // 未来扩展: | CodingAgent::Gemini(_) | ...
    }

    /// Get the CLI command for chat
    pub fn chat_command(&self) -> Option<&str> {
        match self {
            CodingAgent::ClaudeCode(_) => Some("claude"),
            // CodingAgent::Gemini(_) => Some("gemini"),
            // CodingAgent::Codex(_) => Some("codex"),
            _ => None,
        }
    }
}
```

## 文件变更总结

| 文件 | 变更 |
|------|------|
| `cli/commands/executor.rs` | 新增 `Chat` action 和 `execute_chat` 方法 |
| `cli/error.rs` | 新增 `ChatNotSupported`, `NoPromptProvided` 错误 |
| `executors/executors/mod.rs` | 新增 `supports_chat()`, `chat_command()` 方法 |

## 设计决策

1. **直接使用 `claude` 命令** - 假设用户已安装 Claude Code CLI，而非通过 npx 临时安装
2. **IO 透传** - 使用 `Stdio::inherit()` 保持与 claude 完全一致的输入输出体验
3. **权限默认安全** - 遵循 claude code 的设计，默认需要权限检查
4. **架构可扩展** - 通过 `supports_chat()` 和 `chat_command()` 方法支持未来添加其他 executor
