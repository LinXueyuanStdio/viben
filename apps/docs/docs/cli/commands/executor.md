# viben executor

> 发现和查看执行器。执行器是实际运行 Agent 的 coding agent，如 Claude Code、Cursor 等。

## 概念说明

### 什么是 Executor？

Executor（执行器）是运行 Agent 的底层 coding agent。Viben 通过为这些执行器配置不同的技能（skills）、提示词（prompts）、MCP 服务器等，将其组装成功能丰富的 Agent。

| 概念 | 说明 | 示例 |
|------|------|------|
| **Executor** | 底层 coding agent，负责执行任务 | Claude Code, Cursor, Gemini CLI, Codex, Windsurf |
| **Agent** | Viben 配置的智能体实例，基于某个 executor | `main` agent (基于 Claude Code) |
| **关系** | Agent = Executor + Skills + Prompts + MCP + Memory | 一个 executor 可以支持多个 agent |

**Executor 的职责**：
- 接收用户指令
- 调用 LLM 进行推理
- 执行工具调用（代码编写、文件操作等）
- 与 MCP 服务器通信

**Viben 的职责**：
- 发现本地已安装的 executors
- 为 executor 配置 skills、prompts、MCP
- 管理 agent 实例（基于 executor）
- 提供统一的配置和记忆管理

---

## 支持的 Executors

| ID | 名称 | 说明 | 检测方式 |
|------|------|------|----------|
| `CLAUDE_CODE` | Claude Code | Anthropic 官方 CLI | `claude --version` |
| `CURSOR` | Cursor | AI-first 编辑器 | `cursor --version` |
| `GEMINI_CLI` | Gemini CLI | Google Gemini CLI | `gemini --version` |
| `CODEX` | OpenAI Codex | OpenAI Codex CLI | `codex --version` |
| `WINDSURF` | Windsurf | Codeium IDE | `windsurf --version` |
| `AMP` | Amp | Sourcegraph Amp | `amp --version` |
| `OPENCODE` | OpenCode | 开源 coding agent | `opencode --version` |
| `QWEN_CODE` | Qwen Code | 阿里通义千问 coding agent | `qwen-code --version` |
| `AIDER` | Aider | AI pair programming | `aider --version` |
| `CONTINUE` | Continue | IDE 插件 | `continue --version` |

---

## 命令

```bash
# ============================================================
# Executor 发现 (Discovery Only)
# ============================================================

# 列出支持的 executor 类型
viben executor types
viben executor types --json

# 列出所有已发现的 executors（含安装状态）
viben executor list
viben executor list --json

# 查看特定 executor 详情
viben executor show -n <executor-id>
viben executor show -n CLAUDE_CODE
viben executor show -n CURSOR --json

# ============================================================
# Executor Chat (非交互式执行)
# ============================================================

# 基本用法
viben executor chat -n CLAUDE_CODE -p "分析这段代码"

# 从 stdin 读取
echo "写一个排序函数" | viben executor chat -n CLAUDE_CODE

# JSON 流输入输出（用于程序化调用）
viben executor chat -n CLAUDE_CODE --input-format stream-json --output-format stream-json

# 恢复 session
viben executor chat -n CLAUDE_CODE -p "继续" --resume <session-id>
```

> **Note**: 发现功能不实现安装，安装应由用户通过各 executor 官方渠道完成。
> **详细设计**: 参见 [executor-chat.md](./executor-chat.md)

---

## 输出示例

**`viben executor types` (Human)**:
```
TYPE          DESCRIPTION
------------  -----------------------
CLAUDE_CODE   Claude Code (Anthropic)
AMP           Amp
GEMINI        Gemini CLI (Google)
CODEX         Codex CLI (OpenAI)
OPENCODE      Opencode
CURSOR_AGENT  Cursor Agent
QWEN_CODE     Qwen Code (Alibaba)
COPILOT       GitHub Copilot
DROID         Droid
```

**`viben executor types --json`**:
```json
{
  "success": true,
  "data": {
    "types": [
      { "id": "CLAUDE_CODE", "name": "Claude Code (Anthropic)" },
      { "id": "AMP", "name": "Amp" },
      { "id": "GEMINI", "name": "Gemini CLI (Google)" },
      { "id": "CODEX", "name": "Codex CLI (OpenAI)" },
      { "id": "OPENCODE", "name": "Opencode" },
      { "id": "CURSOR_AGENT", "name": "Cursor Agent" },
      { "id": "QWEN_CODE", "name": "Qwen Code (Alibaba)" },
      { "id": "COPILOT", "name": "GitHub Copilot" },
      { "id": "DROID", "name": "Droid" }
    ]
  }
}
```

---

## Executor 检测逻辑

```typescript
interface ExecutorDetector {
  id: string;                    // e.g., "CLAUDE_CODE"
  name: string;                  // e.g., "Claude Code"
  description: string;           // e.g., "Anthropic's official CLI for Claude"
  detectCommand: string;         // e.g., "claude --version"
  configPaths: string[];         // e.g., ["~/.claude/", "~/.config/claude/"]
  mcpConfigPath?: string;        // e.g., "~/.claude/mcp_servers.json"
  settingsPath?: string;         // e.g., "~/.claude/settings.json"
}

interface DetectedExecutor {
  id: string;
  name: string;
  description: string;
  installed: boolean;
  version?: string;              // 从 detectCommand 解析
  path?: string;                 // 可执行文件路径
  configDir?: string;            // 配置目录
  mcpConfigPath?: string;        // MCP 配置文件路径
  settingsPath?: string;         // 设置文件路径
}
```

---

## 更多输出示例

**`viben executor list` (Human)**:
```
Executors:

  Installed:
    CLAUDE_CODE     Claude Code      v1.0.25    Anthropic's official CLI
    CURSOR          Cursor           v0.45.2    AI-first code editor

  Not Installed:
    GEMINI_CLI      Gemini CLI       -          Google Gemini CLI
    CODEX           OpenAI Codex     -          OpenAI Codex CLI
    WINDSURF        Windsurf         -          Codeium IDE
    AMP             Amp              -          Sourcegraph Amp
    OPENCODE        OpenCode         -          Open source coding agent
    QWEN_CODE       Qwen Code        -          Alibaba Qwen coding agent
    AIDER           Aider            -          AI pair programming
    CONTINUE        Continue         -          IDE plugin for AI coding

Tip: Use 'viben executor show -n <id>' to see details.
```

**`viben executor show -n CLAUDE_CODE` (Human)**:
```
Executor: CLAUDE_CODE
Name: Claude Code
Description: Anthropic's official CLI for Claude

Status: ✓ Installed
Version: 1.0.25
Path: /usr/local/bin/claude

Configuration:
  Config Dir:    ~/.claude/
  MCP Config:    ~/.claude/mcp_servers.json
  Settings:      ~/.claude/settings.json

Agents using this executor:
  main          3 sessions    default
  my-agent      1 session

Capabilities:
  - Tool use (Bash, Read, Write, Edit, etc.)
  - MCP server support
  - Multi-turn conversations
  - Extended thinking
  - Image understanding
```

**`viben executor list --json`**:
```json
{
  "success": true,
  "data": {
    "executors": [
      {
        "id": "CLAUDE_CODE",
        "name": "Claude Code",
        "description": "Anthropic's official CLI for Claude",
        "installed": true,
        "version": "1.0.25",
        "path": "/usr/local/bin/claude",
        "configDir": "~/.claude/",
        "mcpConfigPath": "~/.claude/mcp_servers.json",
        "settingsPath": "~/.claude/settings.json"
      },
      {
        "id": "CURSOR",
        "name": "Cursor",
        "description": "AI-first code editor",
        "installed": true,
        "version": "0.45.2",
        "path": "/Applications/Cursor.app/Contents/MacOS/Cursor",
        "configDir": "~/.cursor/",
        "mcpConfigPath": "~/.cursor/mcp.json",
        "settingsPath": "~/.cursor/settings.json"
      },
      {
        "id": "GEMINI_CLI",
        "name": "Gemini CLI",
        "description": "Google Gemini CLI",
        "installed": false
      }
    ]
  }
}
```

---

## 与 Agent 的关系

```
┌─────────────────────────────────────────────────────────────┐
│                    Viben Architecture                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  viben executor list          viben agent list              │
│       ↓                            ↓                        │
│  ┌─────────────┐             ┌─────────────┐                │
│  │  Executor   │─────────────│   Agent     │                │
│  │ CLAUDE_CODE │   1:N       │   main      │                │
│  │  (已安装)   │             │  my-agent   │                │
│  └─────────────┘             └─────────────┘                │
│       │                            │                        │
│       │ 运行环境                    │ 配置                   │
│       ↓                            ↓                        │
│  ┌─────────────┐             ┌─────────────┐                │
│  │  ~/.claude/ │             │ ~/.viben/   │                │
│  │ (executor   │◄────────────│ agents/xxx/ │                │
│  │  原生配置)  │   叠加配置   │ (skills,mcp │                │
│  └─────────────┘             │  memory)    │                │
│                              └─────────────┘                │
│                                                             │
│  流程:                                                       │
│  1. viben executor list  → 发现本地已安装的 executors        │
│  2. viben agent create -n xxx -e CLAUDE_CODE                │
│     → 创建基于 Claude Code 的 agent 实例                    │
│  3. viben agent config → 配置 skills, mcp, prompts          │
│  4. 运行 agent 时，executor 配置 + viben 配置叠加生效        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**关键区别**:

| 维度 | Executor | Agent |
|------|----------|-------|
| 定义 | 底层 coding agent 工具 | Viben 配置的智能体实例 |
| 数量 | 少 (通常 1-3 个已安装) | 多 (可创建任意数量) |
| 管理 | 系统级安装，Viben 只发现 | Viben 创建和管理 |
| 配置 | 原生配置 (如 ~/.claude/) | Viben 配置 (叠加到原生) |
| 操作 | `list`, `show` (只读) | `create`, `remove`, `config` (读写) |

---

## Acceptance Criteria

### Executor Discovery (发现，不安装)
- [x] `viben executor types` 列出支持的 executor 类型
- [x] `viben executor types --json` 输出 JSON 格式
- [x] `viben executor list` 列出所有已发现的 executors（含安装状态）
- [x] `viben executor list --json` 输出 JSON 格式
- [ ] `viben executor show -n <id>` 显示 executor 详情
- [ ] 支持检测 Claude Code (`claude --version`)
- [ ] 支持检测 Cursor (`cursor --version`)
- [ ] 支持检测 Gemini CLI (`gemini --version`)
- [ ] 支持检测 Codex (`codex --version`)
- [ ] 支持检测 Windsurf (`windsurf --version`)
- [ ] 支持检测 Amp (`amp --version`)
- [ ] 支持检测 OpenCode (`opencode --version`)
- [ ] 支持检测 Qwen Code (`qwen-code --version`)
- [ ] 支持检测 Aider (`aider --version`)
- [ ] 支持检测 Continue (`continue --version`)
- [ ] 显示 executor 的配置路径信息
- [ ] 显示使用该 executor 的 agents 列表

### Executor Chat (非交互式执行)
- [ ] `viben executor chat -n CLAUDE_CODE -p "prompt"` 基本执行
- [ ] 支持从 stdin 读取 prompt（无 -p 时）
- [ ] `--input-format text|stream-json` 输入格式选择
- [ ] `--output-format text|stream-json` 输出格式选择
- [ ] `--verbose` 详细输出
- [ ] `--session-id` 指定 session ID
- [ ] `--resume` 恢复已有 session
- [ ] `--model` 指定模型
- [ ] `--dangerously-skip-permissions` 跳过权限检查
- [ ] `-C, --cwd` 指定工作目录
- [ ] IO 透传：子进程 stdin/stdout/stderr 继承父进程
- [ ] 退出码透传：子进程退出码作为命令退出码
- [ ] 架构可扩展：支持未来添加其他 executor 的 chat 功能

---

## Related Documents

- [executor-chat.md](./executor-chat.md) - Executor Chat 命令详细设计
- [agent.md](./agent.md) - Agent 管理命令
