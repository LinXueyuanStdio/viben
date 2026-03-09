# viben agent chat

> 使用指定 Agent 进行非交互式对话。

## 概述

为 `viben agent` 新增 `chat` 子命令，支持非交互式方式调用 Agent 进行对话。Agent 会根据其配置的 type（如 claude-code、gemini）调用对应的底层 executor，同时自动加载 Agent 的记忆、MCP 配置和 Skills。

## 命令接口

```
viben agent chat [OPTIONS] -n <AGENT_ID>

OPTIONS:
    -n, --name <AGENT_ID>       Agent ID (必需)
    -p, --prompt <PROMPT>       提示词（可选，无则从 stdin 读取）
    -C, --cwd <DIR>             工作目录（默认当前目录）

    --input-format <FORMAT>     输入格式: text (默认), stream-json
    --output-format <FORMAT>    输出格式: text (默认), stream-json
    --verbose                   详细输出

    -s, --session <SESSION_ID>  指定 session ID
    --resume <SESSION_ID>       恢复已有 session
    --new-session               强制创建新 session

    --model <MODEL>             覆盖 Agent 配置的模型
    --no-memory                 不加载 Agent 记忆
    --dangerously-skip-permissions  跳过权限检查

    --json                      JSON 格式输出结果
```

---

## 数据流架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        viben agent chat                          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AgentChatCommand::execute()                 │
│  1. 解析参数                                                      │
│  2. 加载 Agent 配置 (~/.viben/agents/<id>/config.yaml)           │
│  3. 加载 Agent 记忆 (MEMORY.md + 今日/昨日日志)                   │
│  4. 读取 prompt (从 -p 或 stdin)                                  │
│  5. 合并工作区配置 (<cwd>/.claude/ 等)                           │
│  6. 根据 Agent type 选择 executor                                 │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Executor Selection                           │
│  agent.type == "claude-code"  →  ClaudeCode executor            │
│  agent.type == "gemini"       →  Gemini executor                │
│  agent.type == "codex"        →  Codex executor                 │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     spawn_agent_chat_process()                   │
│  构建命令: claude -p "prompt" --append-system-prompt "memory"   │
│  - 注入 Agent 记忆作为 system prompt                             │
│  - 根据 input/output format 添加对应参数                          │
│  - 处理 session、model 等参数                                     │
│  - 加载 Agent 的 MCP servers 配置                                │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      子进程 (claude/gemini/...)                  │
│  stdin  ◄──── 继承父进程 stdin                                   │
│  stdout ────► 继承父进程 stdout                                  │
│  stderr ────► 继承父进程 stderr                                  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Post-processing                             │
│  - 更新 Agent 每日日志 (memory/YYYY-MM-DD.md)                    │
│  - 保存 session 到 .agent_sessions/<session_id>/                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 使用示例

```bash
# ============================================================
# 基本用法
# ============================================================

# 使用默认 agent 进行对话
viben agent chat -p "分析这段代码"

# 指定 agent
viben agent chat -n my-agent -p "写一个排序函数"

# 从 stdin 读取提示词
echo "解释这个错误" | viben agent chat -n my-agent

# 指定工作目录
viben agent chat -n my-agent -p "分析项目结构" -C /path/to/project

# ============================================================
# Session 管理
# ============================================================

# 使用特定 session
viben agent chat -n my-agent -p "继续上次的工作" -s main

# 恢复已有 session
viben agent chat -n my-agent -p "接着做" --resume abc123

# 强制创建新 session
viben agent chat -n my-agent -p "开始新任务" --new-session

# ============================================================
# 高级选项
# ============================================================

# 覆盖模型
viben agent chat -n my-agent -p "复杂推理任务" --model claude-3-opus

# 不加载记忆（干净状态）
viben agent chat -n my-agent -p "独立任务" --no-memory

# 跳过权限检查
viben agent chat -n my-agent -p "自动化脚本" --dangerously-skip-permissions

# ============================================================
# 程序化调用 (JSON 流)
# ============================================================

# JSON 流输入输出
echo '{"type":"user","message":{"role":"user","content":"分析代码"}}' | \
  viben agent chat -n my-agent --input-format stream-json --output-format stream-json

# JSON 格式输出结果
viben agent chat -n my-agent -p "快速任务" --json
```

---

## Agent 记忆注入

Agent chat 会自动加载并注入 Agent 的记忆：

```
┌─────────────────────────────────────────────────────────────────┐
│                     Memory Loading                               │
├─────────────────────────────────────────────────────────────────┤
│  1. ~/.viben/agents/<id>/memory/MEMORY.md      (主记忆)         │
│  2. ~/.viben/agents/<id>/memory/YYYY-MM-DD.md  (今日日志)       │
│  3. ~/.viben/agents/<id>/memory/YYYY-MM-DD.md  (昨日日志)       │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Prompt Construction                          │
│                                                                  │
│  [System Prompt]                                                 │
│  # Agent Memory                                                  │
│  <contents of MEMORY.md>                                         │
│                                                                  │
│  # Recent Activity                                               │
│  ## Yesterday (2024-01-15)                                       │
│  <contents of yesterday's log>                                   │
│                                                                  │
│  ## Today (2024-01-16)                                           │
│  <contents of today's log>                                       │
│                                                                  │
│  [User Prompt]                                                   │
│  <actual user prompt>                                            │
└─────────────────────────────────────────────────────────────────┘
```

使用 `--no-memory` 跳过记忆加载。

---

## 配置合并顺序

Agent chat 执行时，配置按以下优先级合并：

```
优先级从低到高:
┌─────────────────────────────────────────────────────────────────┐
│ 1. Agent 基础配置                                                │
│    ~/.viben/agents/<id>/config.yaml                             │
│    - type, model, mcp, skills 等                                 │
├─────────────────────────────────────────────────────────────────┤
│ 2. 工作区配置 (根据 agent type)                                  │
│    <cwd>/.claude/settings.json  (如果 type=claude-code)         │
│    <cwd>/.cursor/settings.json  (如果 type=cursor)              │
├─────────────────────────────────────────────────────────────────┤
│ 3. 命令行参数                                                    │
│    --model, --session, --no-memory 等                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Session 存储

对话 session 存储在 Agent 目录下：

```
~/.viben/agents/<agent-id>/.agent_sessions/
└── <session_id>/
    ├── config.yaml              # Session 配置
    │   session_id: abc123
    │   created_at: 2024-01-16T10:30:00Z
    │   last_active: 2024-01-16T14:15:00Z
    │   cwd: /path/to/project
    │   model: claude-3-sonnet
    │
    └── messages.rollout.jsonl   # 消息历史 (JSONL 格式)
```

---

## 输出示例

**`viben agent chat -n my-agent -p "Hello"` (Human)**:
```
Hello! I'm your coding assistant. How can I help you today?

I have access to your project context and remember our previous conversations.
What would you like to work on?
```

**`viben agent chat -n my-agent -p "Hello" --json`**:
```json
{
  "success": true,
  "agent_id": "my-agent",
  "session_id": "abc123",
  "response": "Hello! I'm your coding assistant...",
  "tokens": {
    "input": 150,
    "output": 42
  },
  "memory_loaded": true,
  "duration_ms": 1234
}
```

**错误: Agent 不存在**:
```
Error: Agent not found: unknown-agent

Available agents:
  main         claude-code
  my-agent     claude-code
  researcher   gemini

Use `viben agent list` to see all agents.
```

**错误: Agent 类型不支持 chat**:
```
Error: Chat not supported for agent type: custom

Supported types: claude-code, gemini, codex
```

---

## 与 executor chat 的区别

| 特性 | `viben executor chat` | `viben agent chat` |
|------|----------------------|-------------------|
| 目标 | 直接调用底层 executor | 调用配置好的 Agent |
| 记忆 | 无 | 自动加载 Agent 记忆 |
| 配置 | 仅命令行参数 | Agent config + 工作区 + 命令行 |
| Session | 临时 | 持久化到 Agent 目录 |
| MCP | 需手动配置 | 使用 Agent 的 MCP 配置 |
| Skills | 无 | 使用 Agent 的 Skills |
| 适用场景 | 一次性调用、脚本集成 | 持续对话、项目开发 |

---

## Acceptance Criteria

### 基本功能
- [ ] `viben agent chat -n <id> -p <prompt>` 执行对话
- [ ] 从 stdin 读取 prompt（当 -p 未提供时）
- [ ] 根据 Agent type 选择正确的 executor
- [ ] `-C` 指定工作目录

### 记忆系统
- [ ] 自动加载 `MEMORY.md`
- [ ] 自动加载今日 + 昨日日志
- [ ] `--no-memory` 跳过记忆加载
- [ ] 对话后更新每日日志

### Session 管理
- [ ] `-s` 指定 session ID
- [ ] `--resume` 恢复已有 session
- [ ] `--new-session` 强制创建新 session
- [ ] Session 持久化到 `.agent_sessions/`

### 配置合并
- [ ] 加载 Agent 基础配置
- [ ] 合并工作区配置
- [ ] 命令行参数覆盖配置
- [ ] `--model` 覆盖模型设置

### 输入输出格式
- [ ] `--input-format text` (默认)
- [ ] `--input-format stream-json`
- [ ] `--output-format text` (默认)
- [ ] `--output-format stream-json`
- [ ] `--json` 输出 JSON 结果

### 错误处理
- [ ] Agent 不存在时提示可用 agents
- [ ] Agent type 不支持 chat 时报错
- [ ] 无 prompt 且 stdin 为空时报错

### 权限与安全
- [ ] 默认需要权限检查
- [ ] `--dangerously-skip-permissions` 跳过检查
- [ ] `--verbose` 详细输出

---

## Related Documents

- [agent.md](./agent.md) - Agent 管理命令
- [executor-chat.md](./executor-chat.md) - Executor Chat 命令
- [executor.md](./executor.md) - Executor 管理命令
