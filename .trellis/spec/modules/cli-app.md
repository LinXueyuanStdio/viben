# CLI Application Specification

> Bootstrap CLI for Viben - configure applications, manage services, and query status.

---

## Overview

### Positioning

CLI (`viben`) 是一个 **bootstrap 工具**，用于：

1. **被人使用**：命令行配置应用、启动服务、查看状态
2. **被 Agent 使用**：Agent 通过 Bash 工具调用 CLI 来配置复杂的 agent、mcp、skills

### Design Principles

- **Simple & Focused**：不承担复杂交互任务，专注配置和状态管理
- **Human + Machine Friendly**：默认人类可读输出，`--json` 输出结构化数据供 Agent 解析
- **Scope Aware**：自动检测工作区，支持 `--global`/`--workspace` 覆盖

---

## Tech Stack

| Component | Choice | Reason |
|-----------|--------|--------|
| Runtime | Node.js | 复用现有 TypeScript 代码和 packages |
| Framework | Commander.js | 成熟稳定，生态丰富 |
| Config | YAML | 人类可读，支持注释 |
| Output | Chalk + JSON | 彩色终端 + 结构化输出 |

---

## Configuration

### File Locations

```
~/.viben/                                    # State directory (VIBEN_STATE_DIR)
├── config.yaml                              # 全局配置 (VIBEN_CONFIG_PATH)
├── providers.yaml                           # API Providers 配置
├── models.yaml                              # Models 配置 (aliases, fallbacks)
├── channels.yaml                            # Chat Channels 配置 (Telegram, Discord, etc.)
├── cron.yaml                                # Scheduled Jobs 配置
├── sessions/                                # Session 存储 (JSONL format)
│   └── <channel>_<chat_id>.jsonl            # 会话历史 (per channel:chat_id)
├── agents/                                  # Agent 实例目录
│   └── <agent-id>/                          # 单个 agent 实例
│       ├── config.yaml                      # Agent 配置
│       ├── mcp_servers.json                 # MCP servers 配置
│       ├── skills/                          # Agent 专属 skills
│       ├── memory/                          # Agent 记忆
│       │   ├── MEMORY.md                    # 主记忆文件
│       │   ├── 2024-01-15.md                # 日志 (append-only)
│       │   ├── 2024-01-16.md                # 日志 (今天+昨天在会话启动时读取)
│       │   └── ...                          # 其他记忆文件
│       ├── .agentrc                         # Agent 启动配置
│       ├── .agent_history                   # 命令历史
│       └── .agent_sessions/                 # 会话存储
│           └── <session-id>/                # 单个会话
│               ├── config.yaml              # 会话配置
│               └── messages.rollout.jsonl   # 消息历史 (JSONL)
├── agent-templates/                         # Agent 模板目录
│   └── <template-id>/                       # 模板结构同 agents/<id>/
│       └── ...
├── mcp/                                     # 共享 MCP (所有 agents 可用)
│   ├── installed.yaml                       # 已安装 MCP 列表
│   └── <name>/                              # 各 MCP 的配置和数据
└── skills/                                  # 共享 Skills (所有 agents 可用)
    ├── installed.yaml                       # 已安装 Skills 列表
    └── <name>/                              # 各 Skill 的配置和数据

<project>/                                   # 项目工作区
├── .viben/                                  # 工作区配置
│   └── config.yaml                          # 工作区配置（覆盖全局）
├── .claude/                                 # Claude Code 工作区配置 (运行时叠加)
├── .cursor/                                 # Cursor 工作区配置 (运行时叠加)
└── ...                                      # 其他 agent 类型的工作区配置
```

### Environment Variables

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `VIBEN_STATE_DIR` | 状态目录 | `~/.viben` |
| `VIBEN_CONFIG_PATH` | 配置文件路径 | `~/.viben/config.yaml` |
| `VIBEN_AGENT` | 当前 agent ID | `main` |
| `VIBEN_SCOPE` | 配置作用域 | 自动检测 |
| `VIBEN_GATEWAY_HOST` | Gateway 监听地址 | `0.0.0.0` |
| `VIBEN_GATEWAY_PORT` | Gateway 监听端口 | `18790` |

**Channel-specific Environment Variables** (alternative to config file):

| 变量 | 说明 |
|------|------|
| `TELEGRAM_BOT_TOKEN` | Telegram bot token |
| `DISCORD_BOT_TOKEN` | Discord bot token |
| `FEISHU_APP_ID` | Feishu app ID |
| `FEISHU_APP_SECRET` | Feishu app secret |
| `BRAVE_SEARCH_API_KEY` | Brave Search API key (for web search tool) |

### Config Structure (YAML)

```yaml
# ~/.viben/config.yaml
version: 1

# 全局设置
settings:
  editor: code
  pager: less
  color: auto

# Agent 配置引用
agents:
  - claude-code
  - cursor

# 默认 MCP 列表（全局启用）
mcp:
  enabled:
    - filesystem
    - git
  disabled:
    - browser

# 默认 Skills 列表
skills:
  enabled:
    - code-review
    - commit
```

### Providers Configuration (providers.yaml)

Provider 配置使用标准环境变量名称，用户可以：
1. 直接设置环境变量（推荐，不在配置文件中存储密钥）
2. 在配置文件中使用 `env:VAR_NAME` 引用环境变量
3. 在配置文件中使用 `encrypted:xxx` 存储加密值

```yaml
# ~/.viben/providers.yaml
version: 1

# 默认 provider
default: anthropic-main

providers:
  # ============================================================
  # Anthropic (Claude)
  # 环境变量: ANTHROPIC_API_KEY, ANTHROPIC_BASE_URL
  # ============================================================
  anthropic-main:
    type: anthropic
    # 方式1: 使用环境变量 (推荐，无需在此配置)
    # 自动读取 ANTHROPIC_API_KEY

    # 方式2: 显式引用环境变量
    # ANTHROPIC_API_KEY: "env:ANTHROPIC_API_KEY"

    # 方式3: 加密存储 (通过 viben provider create 生成)
    # ANTHROPIC_API_KEY: "encrypted:xxx"

    # 可选配置
    # ANTHROPIC_BASE_URL: "https://api.anthropic.com"
    # timeout: 120000
    # max_retries: 3

  # ============================================================
  # OpenAI
  # 环境变量: OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_ORG_ID
  # ============================================================
  openai-main:
    type: openai
    # 自动读取 OPENAI_API_KEY, OPENAI_BASE_URL
    # 可选配置
    # OPENAI_ORG_ID: "org-xxxxx"

  # ============================================================
  # Azure OpenAI
  # 环境变量: AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT,
  #          AZURE_OPENAI_API_VERSION, AZURE_OPENAI_DEPLOYMENT
  # ============================================================
  azure-gpt4:
    type: azure
    AZURE_OPENAI_ENDPOINT: "https://my-resource.openai.azure.com"
    AZURE_OPENAI_API_VERSION: "2024-02-15-preview"
    AZURE_OPENAI_DEPLOYMENT: "gpt-4-turbo"
    # AZURE_OPENAI_API_KEY 从环境变量读取

  # ============================================================
  # Google AI (Gemini)
  # 环境变量: GOOGLE_API_KEY, GOOGLE_PROJECT_ID, GOOGLE_LOCATION
  # ============================================================
  google-gemini:
    type: google
    # 自动读取 GOOGLE_API_KEY
    # 可选配置
    # GOOGLE_PROJECT_ID: "my-project"
    # GOOGLE_LOCATION: "us-central1"

  # ============================================================
  # OpenRouter
  # 环境变量: OPENROUTER_API_KEY
  # ============================================================
  openrouter:
    type: openrouter
    # 自动读取 OPENROUTER_API_KEY
    # 可选配置
    # site_url: "https://myapp.com"
    # app_name: "My App"

  # ============================================================
  # Ollama (本地模型)
  # 环境变量: OLLAMA_HOST
  # ============================================================
  local-ollama:
    type: ollama
    OLLAMA_HOST: "http://localhost:11434"
    # 无需 API Key

  # ============================================================
  # 自定义 OpenAI 兼容 API
  # 环境变量: CUSTOM_API_KEY, CUSTOM_BASE_URL
  # ============================================================
  custom-api:
    type: custom
    OPENAI_BASE_URL: "https://api.example.com/v1"
    # OPENAI_API_KEY 从环境变量读取
    # 可选: 自定义请求头
    # headers:
    #   X-Custom-Header: "value"

  # ============================================================
  # DeepSeek
  # 环境变量: DEEPSEEK_API_KEY
  # ============================================================
  deepseek:
    type: custom
    OPENAI_BASE_URL: "https://api.deepseek.com/v1"
    # 使用 DEEPSEEK_API_KEY 或 OPENAI_API_KEY

  # ============================================================
  # Groq
  # 环境变量: GROQ_API_KEY
  # ============================================================
  groq:
    type: custom
    OPENAI_BASE_URL: "https://api.groq.com/openai/v1"
    # 使用 GROQ_API_KEY 或 OPENAI_API_KEY

  # ============================================================
  # Together AI
  # 环境变量: TOGETHER_API_KEY
  # ============================================================
  together:
    type: custom
    OPENAI_BASE_URL: "https://api.together.xyz/v1"
    # 使用 TOGETHER_API_KEY 或 OPENAI_API_KEY

  # ============================================================
  # Fireworks AI
  # 环境变量: FIREWORKS_API_KEY
  # ============================================================
  fireworks:
    type: custom
    OPENAI_BASE_URL: "https://api.fireworks.ai/inference/v1"
    # 使用 FIREWORKS_API_KEY 或 OPENAI_API_KEY
```

#### 环境变量优先级

Provider 配置读取顺序：
1. 命令行参数 (`--api-key`)
2. 配置文件中的显式值
3. Provider 特定环境变量 (如 `ANTHROPIC_API_KEY`)
4. 通用环境变量 (如 `OPENAI_API_KEY` for custom type)

#### 支持的环境变量

| Provider | API Key | Base URL | 其他 |
|----------|---------|----------|------|
| `anthropic` | `ANTHROPIC_API_KEY` | `ANTHROPIC_BASE_URL` | - |
| `openai` | `OPENAI_API_KEY` | `OPENAI_BASE_URL` | `OPENAI_ORG_ID` |
| `azure` | `AZURE_OPENAI_API_KEY` | `AZURE_OPENAI_ENDPOINT` | `AZURE_OPENAI_API_VERSION`, `AZURE_OPENAI_DEPLOYMENT` |
| `google` | `GOOGLE_API_KEY` | - | `GOOGLE_PROJECT_ID`, `GOOGLE_LOCATION` |
| `openrouter` | `OPENROUTER_API_KEY` | - | - |
| `ollama` | - | `OLLAMA_HOST` | - |
| `custom` | `OPENAI_API_KEY` | `OPENAI_BASE_URL` | - |

#### 快速配置示例

```bash
# 只需设置环境变量，无需编辑配置文件
export ANTHROPIC_API_KEY="sk-ant-xxx"
export OPENAI_API_KEY="sk-xxx"

# 创建 provider (自动使用环境变量)
viben provider create -t anthropic
viben provider create -t openai

# 或显式指定 (会加密存储)
viben provider create -t anthropic --api-key "sk-ant-xxx"
```

### Models Configuration (models.yaml)

```yaml
# ~/.viben/models.yaml
version: 1

# 默认模型
default: claude-sonnet-4-20250514

# ============================================================
# 模型别名 (Aliases)
# 使用短名称引用常用模型
# ============================================================
aliases:
  # 速度优先
  fast: claude-3-5-haiku-latest
  quick: gpt-4o-mini

  # 智能优先
  smart: claude-sonnet-4-20250514
  balanced: gpt-4o

  # 最强能力
  best: claude-opus-4-20250514
  powerful: gpt-4-turbo

  # 特定用途
  code: claude-sonnet-4-20250514
  chat: claude-3-5-haiku-latest
  reasoning: o1-preview

  # Provider 特定
  gpt: gpt-4-turbo
  claude: claude-sonnet-4-20250514
  gemini: gemini-1.5-pro

# ============================================================
# 回退链 (Fallbacks)
# 当首选模型不可用时，按顺序尝试
# ============================================================
fallbacks:
  - claude-sonnet-4-20250514      # 首选
  - gpt-4-turbo                    # 第一备选
  - claude-3-5-haiku-latest        # 第二备选
  - gpt-4o-mini                    # 最后备选

# ============================================================
# 模型特定配置 (Model Config)
# 覆盖模型的默认参数
# ============================================================
model_config:
  # Claude Sonnet 4
  claude-sonnet-4-20250514:
    provider: anthropic-main        # 使用哪个 provider
    max_tokens: 8192                # 最大输出 tokens
    temperature: 0.7                # 温度
    # 可选参数
    # top_p: 0.9
    # top_k: 40
    # stop_sequences: ["\n\nHuman:"]

  # Claude Opus 4
  claude-opus-4-20250514:
    provider: anthropic-main
    max_tokens: 4096
    temperature: 0.5                # 更保守的温度

  # Claude Haiku
  claude-3-5-haiku-latest:
    provider: anthropic-main
    max_tokens: 4096
    temperature: 0.8

  # GPT-4 Turbo
  gpt-4-turbo:
    provider: openai-main
    max_tokens: 4096
    temperature: 0.7

  # GPT-4o
  gpt-4o:
    provider: openai-main
    max_tokens: 4096
    temperature: 0.7

  # GPT-4o Mini
  gpt-4o-mini:
    provider: openai-main
    max_tokens: 4096
    temperature: 0.8

  # Azure GPT-4
  azure-gpt-4:
    provider: azure-gpt4            # 使用 Azure provider
    max_tokens: 4096
    temperature: 0.7

  # Gemini 1.5 Pro
  gemini-1.5-pro:
    provider: google-gemini
    max_tokens: 8192
    temperature: 0.7

  # 本地 Ollama 模型
  llama3:
    provider: local-ollama
    max_tokens: 4096
    temperature: 0.8

  # DeepSeek
  deepseek-chat:
    provider: deepseek
    max_tokens: 4096
    temperature: 0.7

  # Groq (LLaMA)
  llama-3.1-70b-versatile:
    provider: groq
    max_tokens: 4096
    temperature: 0.7

# ============================================================
# 模型能力标签 (用于智能选择)
# ============================================================
model_capabilities:
  claude-sonnet-4-20250514:
    context_window: 200000
    supports_vision: true
    supports_tools: true
    supports_streaming: true
    cost_per_1k_input: 0.003
    cost_per_1k_output: 0.015

  claude-opus-4-20250514:
    context_window: 200000
    supports_vision: true
    supports_tools: true
    supports_streaming: true
    cost_per_1k_input: 0.015
    cost_per_1k_output: 0.075

  gpt-4-turbo:
    context_window: 128000
    supports_vision: true
    supports_tools: true
    supports_streaming: true
    cost_per_1k_input: 0.01
    cost_per_1k_output: 0.03

  gpt-4o-mini:
    context_window: 128000
    supports_vision: true
    supports_tools: true
    supports_streaming: true
    cost_per_1k_input: 0.00015
    cost_per_1k_output: 0.0006
```

### Scope Resolution

```
优先级（高到低）：
1. 命令行 flag (--global / --workspace)
2. 环境变量 VIBEN_SCOPE
3. 自动检测：
   - 当前目录或祖先目录存在 .viben/ → workspace
   - 否则 → global
```

---

## Command Structure

### Overview

```
viben <command> [subcommand] [options]

Commands:
  init          Initialize workspace in current directory
  config        Configuration management (git-style)
  service       Manage background services
  gateway       Start the gateway (message bus + agent loop)
  executor      Discover and inspect executors (Claude Code, Cursor, etc.)
  agent         Manage agent instances and templates
  provider      Manage API providers (OpenAI, Anthropic, etc.)
  model         Manage models, aliases, and fallbacks
  mcp           Manage MCP servers
  skill         Manage skills
  channel       Manage chat channels (Telegram, Discord, WhatsApp, Feishu)
  cron          Manage scheduled tasks
  workspace     Workspace operations
  version       Show version info
  help          Show help
```

### Global Options

```
--json              Output as JSON (for Agent parsing)
--global, -g        Use global config
--workspace         Use workspace config (current directory)
-n, --name <id>     Specify agent name/ID (default: current or 'main')
--verbose, -v       Verbose output
--quiet, -q         Suppress non-essential output
--help, -h          Show help
```

---

## Commands Detail

### 1. `viben init`

Initialize a workspace in the current directory.

```bash
viben init                    # 创建 .viben/config.yaml
viben init --from <template>  # 从模板初始化
```

**Output (Human)**:
```
✓ Initialized Viben workspace in /path/to/project
  Created .viben/config.yaml

Next steps:
  viben mcp install <name>    # Install MCP servers
  viben skill install <name>  # Install skills
```

**Output (JSON)**:
```json
{
  "success": true,
  "path": "/path/to/project/.viben",
  "files": ["config.yaml"]
}
```

---

### 2. `viben config` (Git-style)

Configuration management following git config conventions.

```bash
# 读取配置
viben config get <key>
viben config get settings.editor
viben config get --global mcp.enabled

# 设置配置
viben config set <key> <value>
viben config set settings.editor vim
viben config set --global settings.pager less

# 列出配置
viben config list
viben config list --global
viben config list --show-origin    # 显示配置来源

# 编辑配置
viben config edit                  # 打开默认编辑器
viben config edit --global

# 删除配置
viben config unset <key>
```

**Key Format**: Dot notation, e.g., `settings.editor`, `mcp.enabled[0]`

---

### 3. `viben service`

Manage background services.

```bash
# 服务状态
viben service status              # 所有服务状态
viben service status <name>       # 单个服务状态

# 启动/停止
viben service start <name>        # 启动服务
viben service stop <name>         # 停止服务
viben service restart <name>      # 重启服务

# 日志
viben service logs <name>         # 查看服务日志
viben service logs <name> -f      # 实时跟踪日志
```

**Managed Services**:

| Service | Description |
|---------|-------------|
| `mcp:<name>` | MCP Server 进程 |
| `viben:sync` | 配置同步服务 |
| `viben:index` | 本地索引服务 |

**Output (Human)**:
```
Services:
  mcp:filesystem    running   pid:12345  uptime:2h
  mcp:git           running   pid:12346  uptime:2h
  viben:sync        stopped   -          -
```

**Output (JSON)**:
```json
{
  "services": [
    {
      "name": "mcp:filesystem",
      "status": "running",
      "pid": 12345,
      "uptime": "2h"
    }
  ]
}
```

---

### 4. `viben executor`

发现和查看执行器。执行器是实际运行 Agent 的 coding agent，如 Claude Code、Cursor 等。

---

#### 4.1 概念说明

**什么是 Executor？**

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

#### 4.2 支持的 Executors

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

#### 4.3 命令

```bash
# ============================================================
# Executor 发现 (Discovery Only)
# ============================================================

# 列出所有已发现的 executors
viben executor list
viben executor list --json

# 查看特定 executor 详情
viben executor show -n <executor-id>
viben executor show -n CLAUDE_CODE
viben executor show -n CURSOR --json
```

> **Note**: 当前阶段只实现发现功能，不实现安装。安装应由用户手动完成或通过各 executor 官方渠道。

---

#### 4.4 Executor 检测逻辑

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

#### 4.5 输出示例

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

**`viben executor show -n CLAUDE_CODE --json`**:
```json
{
  "success": true,
  "data": {
    "executor": {
      "id": "CLAUDE_CODE",
      "name": "Claude Code",
      "description": "Anthropic's official CLI for Claude",
      "installed": true,
      "version": "1.0.25",
      "path": "/usr/local/bin/claude",
      "configDir": "~/.claude/",
      "mcpConfigPath": "~/.claude/mcp_servers.json",
      "settingsPath": "~/.claude/settings.json",
      "capabilities": [
        "tool_use",
        "mcp_support",
        "multi_turn",
        "extended_thinking",
        "vision"
      ]
    },
    "agents": [
      {
        "id": "main",
        "sessionCount": 3,
        "isDefault": true
      },
      {
        "id": "my-agent",
        "sessionCount": 1,
        "isDefault": false
      }
    ]
  }
}
```

---

#### 4.6 与 Agent 的关系

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

### 5. `viben gateway`

Start the gateway - the core runtime that connects channels to the agent loop.

```bash
# Start gateway (foreground)
viben gateway

# Start gateway with specific agent
viben gateway -n <agent-id>

# Start gateway in background
viben gateway --daemon

# Stop background gateway
viben gateway stop
```

**Architecture** (based on nanobot):

```
┌─────────────────────────────────────────────────────────────┐
│                        Gateway                               │
├─────────────────────────────────────────────────────────────┤
│  Channels (Input)                                            │
│    ├── Telegram Bot                                          │
│    ├── Discord Bot                                           │
│    ├── WhatsApp (via bridge)                                 │
│    ├── Feishu (WebSocket long connection)                    │
│    └── CLI (direct input)                                    │
│                                                              │
│  Message Bus                                                 │
│    ├── Inbound Queue (messages from channels)                │
│    └── Outbound Queue (responses to channels)                │
│                                                              │
│  Agent Loop                                                  │
│    ├── Context Builder (system prompt + memory + skills)     │
│    ├── LLM Provider (API calls)                              │
│    ├── Tool Registry (execute tool calls)                    │
│    └── Subagent Manager (background tasks)                   │
└─────────────────────────────────────────────────────────────┘
```

**Gateway Lifecycle**:

1. Load configuration from `~/.viben/config.yaml`
2. Initialize enabled channels (Telegram, Discord, etc.)
3. Start message bus
4. Start agent loop
5. Process messages until shutdown

**Output (Human)**:
```
Gateway starting...
  Agent: main
  Model: claude-sonnet-4-20250514
  Channels:
    ✓ telegram    connected   @my_bot
    ✓ discord     connected   MyBot#1234
    ○ whatsapp    disabled
    ○ feishu      disabled

Gateway running. Press Ctrl+C to stop.
```

**Output (JSON)**:
```json
{
  "success": true,
  "data": {
    "status": "running",
    "agent": "main",
    "model": "claude-sonnet-4-20250514",
    "channels": [
      {"name": "telegram", "status": "connected", "identifier": "@my_bot"},
      {"name": "discord", "status": "connected", "identifier": "MyBot#1234"}
    ],
    "pid": 12345
  }
}
```

---

### 5. `viben channel`

Manage chat channels for the gateway.

---

#### Supported Channel Types

| Type | Description | Setup Difficulty |
|------|-------------|------------------|
| `telegram` | Telegram Bot API | Easy (just a token) |
| `discord` | Discord Bot | Easy (bot token + intents) |
| `whatsapp` | WhatsApp via bridge | Medium (scan QR) |
| `feishu` | Feishu/Lark WebSocket | Medium (app credentials) |

---

#### Commands

```bash
# ============================================================
# Channel Management
# ============================================================

# List all channels
viben channel list
viben channel list --json

# Create a channel
viben channel create -n <id> --type <type> [options]
viben channel create -n my-telegram --type telegram --token "BOT_TOKEN"
viben channel create -n my-discord --type discord --token "BOT_TOKEN"
viben channel create -n my-feishu --type feishu --app-id "cli_xxx" --app-secret "xxx"

# Remove a channel
viben channel remove -n <id>

# Enable/disable channel
viben channel enable -n <id>
viben channel disable -n <id>

# Set default channel
viben channel set-default -n <id>

# View channel status
viben channel status
viben channel status -n <id>

# ============================================================
# Channel Configuration
# ============================================================

# Configure channel settings
viben channel config -n <id>
viben channel config -n my-telegram set allow_from "[\"123456789\"]"
viben channel config -n my-telegram set proxy "http://127.0.0.1:7890"

# ============================================================
# WhatsApp-specific Commands
# ============================================================

# Link WhatsApp device (scan QR)
viben channel login -n <whatsapp-id>
```

---

#### Channel Configuration

```yaml
# ~/.viben/channels.yaml
version: 1

default: my-telegram

channels:
  my-telegram:
    type: telegram
    enabled: true
    token: "encrypted:xxx"  # Bot token from @BotFather
    allow_from:             # Whitelist of user IDs (empty = allow all)
      - "123456789"
    proxy: null             # HTTP/SOCKS5 proxy URL

  my-discord:
    type: discord
    enabled: true
    token: "encrypted:xxx"  # Bot token from Discord Developer Portal
    allow_from: []          # Whitelist of user IDs
    intents: 37377          # GUILDS + GUILD_MESSAGES + DIRECT_MESSAGES + MESSAGE_CONTENT

  my-whatsapp:
    type: whatsapp
    enabled: false
    bridge_url: "ws://localhost:3001"
    allow_from: []          # Whitelist of phone numbers

  my-feishu:
    type: feishu
    enabled: false
    app_id: "cli_xxx"
    app_secret: "encrypted:xxx"
    encrypt_key: ""         # Optional for WebSocket mode
    verification_token: ""  # Optional for WebSocket mode
    allow_from: []          # Whitelist of user open_ids
```

---

#### Output Examples

**`viben channel list` (Human)**:
```
Channels:
  my-telegram*   telegram   enabled    @my_bot
  my-discord     discord    enabled    MyBot#1234
  my-whatsapp    whatsapp   disabled   -
  my-feishu      feishu     disabled   -

* = default channel
```

**`viben channel status` (Human)**:
```
Channel Status:
  my-telegram    telegram   ✓ connected    @my_bot
  my-discord     discord    ✓ connected    MyBot#1234
  my-whatsapp    whatsapp   ○ disabled     -
  my-feishu      feishu     ○ disabled     -
```

---

### 6. `viben cron`

Manage scheduled tasks for the agent.

---

#### Commands

```bash
# ============================================================
# Cron Job Management
# ============================================================

# List all cron jobs
viben cron list
viben cron list --json

# Add a cron job (cron expression)
viben cron add --name <name> --message "<message>" --cron "<cron-expr>"
viben cron add --name "daily-greeting" --message "Good morning! What's on my schedule today?" --cron "0 9 * * *"
viben cron add --name "weekly-review" --message "Summarize this week's accomplishments" --cron "0 17 * * 5"

# Add a cron job (interval in seconds)
viben cron add --name <name> --message "<message>" --every <seconds>
viben cron add --name "hourly-check" --message "Check for any urgent tasks" --every 3600
viben cron add --name "quick-poll" --message "Any updates?" --every 300

# Remove a cron job
viben cron remove <job_id>
viben cron remove daily-greeting

# Enable/disable a cron job
viben cron enable <job_id>
viben cron disable <job_id>

# Show cron job details
viben cron show <job_id>

# ============================================================
# Cron Execution
# ============================================================

# Run a cron job immediately (for testing)
viben cron run <job_id>
```

---

#### Cron Configuration

```yaml
# ~/.viben/cron.yaml
version: 1

jobs:
  daily-greeting:
    enabled: true
    message: "Good morning! What's on my schedule today?"
    cron: "0 9 * * *"        # 9:00 AM every day
    channel: my-telegram     # Which channel to send response
    agent: main              # Which agent to use

  weekly-review:
    enabled: true
    message: "Summarize this week's accomplishments"
    cron: "0 17 * * 5"       # 5:00 PM every Friday
    channel: my-telegram
    agent: main

  hourly-check:
    enabled: false
    message: "Check for any urgent tasks"
    every: 3600              # Every 3600 seconds (1 hour)
    channel: null            # CLI only (no channel notification)
    agent: main
```

---

#### Cron Expression Format

Standard cron format: `minute hour day-of-month month day-of-week`

| Field | Values | Special Characters |
|-------|--------|-------------------|
| Minute | 0-59 | `*` `,` `-` `/` |
| Hour | 0-23 | `*` `,` `-` `/` |
| Day of Month | 1-31 | `*` `,` `-` `/` |
| Month | 1-12 | `*` `,` `-` `/` |
| Day of Week | 0-6 (Sun=0) | `*` `,` `-` `/` |

**Examples**:
- `0 9 * * *` - Every day at 9:00 AM
- `30 8 * * 1-5` - Weekdays at 8:30 AM
- `0 */2 * * *` - Every 2 hours
- `0 0 1 * *` - First day of every month at midnight

---

#### Output Examples

**`viben cron list` (Human)**:
```
Scheduled Jobs:
  daily-greeting     enabled    "0 9 * * *"      next: 2024-01-17 09:00
  weekly-review      enabled    "0 17 * * 5"     next: 2024-01-19 17:00
  hourly-check       disabled   every 3600s      -
```

**`viben cron show daily-greeting` (Human)**:
```
Cron Job: daily-greeting
  Status: enabled
  Schedule: 0 9 * * * (Every day at 9:00 AM)
  Message: "Good morning! What's on my schedule today?"
  Channel: my-telegram
  Agent: main

  Last run: 2024-01-16 09:00:15 (success)
  Next run: 2024-01-17 09:00:00
```

**`viben cron list --json`**:
```json
{
  "success": true,
  "data": {
    "jobs": [
      {
        "id": "daily-greeting",
        "enabled": true,
        "message": "Good morning! What's on my schedule today?",
        "cron": "0 9 * * *",
        "channel": "my-telegram",
        "agent": "main",
        "next_run": "2024-01-17T09:00:00Z",
        "last_run": "2024-01-16T09:00:15Z",
        "last_status": "success"
      }
    ]
  }
}
```

---

### 7. `viben agent`

Manage agent instances and templates.

---

#### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Viben CLI                            │
├─────────────────────────────────────────────────────────────┤
│  Agent Template (可复用的 agent 配置模板)                    │
│    └── Agent Instance (独立的 agent 实例)                   │
│          ├── config.yaml (agent 配置)                       │
│          ├── mcp_servers.json (MCP 配置)                    │
│          ├── skills/ (agent 专属 skills)                    │
│          ├── memory/ (agent 记忆)                           │
│          │   ├── MEMORY.md (主记忆)                         │
│          │   └── YYYY-MM-DD.md (每日日志, append-only)      │
│          ├── .agentrc (启动配置)                            │
│          ├── .agent_history (命令历史)                      │
│          └── .agent_sessions/<session_id>/ (会话存储)       │
└─────────────────────────────────────────────────────────────┘
```

---

#### Key Concepts

| 概念 | 说明 |
|------|------|
| **Agent** | 独立的智能体实例，拥有自己的配置、记忆、会话 |
| **Template** | 可复用的 agent 配置模板 |
| **Memory** | Agent 的长期记忆 (MEMORY.md + 每日日志) |
| **Session** | Agent 的会话存储 (对话历史、状态) |
| **Workspace Config** | 项目工作区的 agent 类型配置 (如 `.claude/`) |

---

#### Runtime Config Merging

Agent 实际运行时，配置按以下顺序叠加：

```
1. ~/.viben/agents/<id>/config.yaml     # Agent 基础配置
2. <project>/.claude/ (或其他 agent 类型)  # 工作区 agent 类型配置
3. 命令行参数                              # 运行时覆盖
```

例如：在 `/projects/my-app` 目录下运行 agent `main`，会先加载 `~/.viben/agents/main/config.yaml`，再叠加 `/projects/my-app/.claude/` 的配置。

---

#### Agent Paths (Quick Map)

```
~/.viben/agents/<agent-id>/
├── config.yaml              # Agent 配置
├── mcp_servers.json         # MCP servers 配置
├── skills/                  # Agent 专属 skills
├── memory/                  # Agent 记忆
│   ├── MEMORY.md            # 主记忆文件 (结构化知识)
│   ├── 2024-01-15.md        # 每日日志 (append-only)
│   ├── 2024-01-16.md        # 会话启动时读取 today + yesterday
│   └── ...
├── .agentrc                 # Agent 启动配置
├── .agent_history           # 命令历史
└── .agent_sessions/         # 会话存储
    └── <session_id>/
        ├── config.yaml              # 会话配置
        └── messages.rollout.jsonl   # 消息历史 (JSONL)
```

---

#### Memory System

Agent 记忆系统设计：

| 文件 | 说明 | 读取时机 |
|------|------|----------|
| `memory/MEMORY.md` | 主记忆文件，结构化知识 | 每次会话启动 |
| `memory/YYYY-MM-DD.md` | 每日日志，append-only | 今天 + 昨天在会话启动时读取 |

**每日日志格式**:
```markdown
# 2024-01-16

## 10:30 - Session started
- Working on feature X
- Discovered issue with Y

## 14:15 - Completed task
- Fixed bug in Z
- Updated documentation

## 17:00 - Session ended
- Next steps: review PR, deploy to staging
```

---

#### Commands

```bash
# ============================================================
# Agent 管理
# ============================================================

# 列出所有 agents
viben agent list
viben agent list --json

# 创建新 agent
viben agent create -n <id>
viben agent create -n my-agent
viben agent create -n my-agent -f <template-id>              # 从模板创建
viben agent create -n my-agent -f /path/to/config.yaml       # 从配置文件创建
viben agent create -n my-agent --clone <existing-agent-id>   # 克隆现有 agent

# 查看 agent 详情
viben agent show -n <id>
viben agent show -n my-agent

# 删除 agent
viben agent remove -n <id>
viben agent remove -n my-agent
viben agent remove -n my-agent --force                       # 强制删除

# 配置 agent
viben agent config -n <id>                                   # 查看配置
viben agent config -n <id> set <key> <value>                 # 设置配置
viben agent config -n my-agent set model gpt-4
viben agent config -n my-agent set plan true
viben agent config -n my-agent set mcp.enabled "[\"filesystem\",\"git\"]"

# 设置默认 agent
viben agent set-default -n <id>
viben agent set-default -n my-agent

# 查看 agent 状态
viben agent status
viben agent status -n <id>

# ============================================================
# Agent Template 管理
# ============================================================

# 列出所有模板
viben agent template list
viben agent template list --json

# 创建模板 (从现有 agent)
viben agent template create -n <template-id> --clone <agent-id>
viben agent template create -n coding-assistant --clone my-agent

# 查看模板详情
viben agent template show -n <template-id>

# 删除模板
viben agent template remove -n <template-id>

# ============================================================
# Session 管理
# ============================================================

# 列出 agent 的会话
viben agent session list -n <agent-id>
viben agent session list -n my-agent

# 查看会话详情
viben agent session show -n <agent-id> -s <session-id>

# 创建新会话
viben agent session create -n <agent-id> [session-name]
viben agent session create -n my-agent "feature-auth"

# 删除会话
viben agent session remove -n <agent-id> -s <session-id>

# 清空会话历史
viben agent session clear -n <agent-id> -s <session-id>

# ============================================================
# Memory 管理
# ============================================================

# 查看 agent 记忆
viben agent memory show -n <agent-id>
viben agent memory show -n my-agent --date 2024-01-16        # 查看特定日期

# 追加记忆 (到今日日志)
viben agent memory append -n <agent-id> "content to append"

# 编辑主记忆
viben agent memory edit -n <agent-id>                        # 打开编辑器
```

---

#### Agent Configuration File

```yaml
# ~/.viben/agents/my-agent/config.yaml
version: 1

# Agent 元数据
id: my-agent
name: "My Coding Assistant"
description: "A helpful coding assistant"
created: 2024-01-15T10:30:00Z

# Agent 类型 (决定运行时行为)
type: claude-code  # claude-code | cursor | gemini | codex | ...

# 类型特定配置
type_config:
  plan: true
  dangerously_skip_permissions: false
  append_prompt: "You are a helpful coding assistant."

# MCP 配置 (也可以在 mcp_servers.json 中)
mcp:
  enabled:
    - filesystem
    - git
  disabled:
    - browser

# Skills 配置
skills:
  enabled:
    - code-review
    - commit
```

---

#### MCP Servers Configuration

```json
// ~/.viben/agents/my-agent/mcp_servers.json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-filesystem"],
      "env": {
        "ROOT": "/path/to/workspace"
      }
    },
    "git": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-git"]
    }
  }
}
```

---

#### Agent RC File

```bash
# ~/.viben/agents/my-agent/.agentrc
# Agent 启动时执行的配置

# 环境变量
export ANTHROPIC_API_KEY="sk-ant-xxx"
export OPENAI_API_KEY="sk-xxx"

# 默认会话
DEFAULT_SESSION="main"

# 启动时读取的记忆文件
MEMORY_FILES="MEMORY.md"
DAILY_LOG_DAYS=2  # 读取今天+昨天
```

---

#### Output Examples

**`viben agent list` (Human)**:
```
Agents:
  main*         claude-code   3 sessions   ~/.viben/agents/main/
  my-agent      claude-code   1 session    ~/.viben/agents/my-agent/
  research-bot  gemini        0 sessions   ~/.viben/agents/research-bot/

* = current agent
```

**`viben agent show -n my-agent` (Human)**:
```
Agent: my-agent
Name: My Coding Assistant
Type: claude-code
Created: 2024-01-15

Paths:
  Config:   ~/.viben/agents/my-agent/config.yaml
  Memory:   ~/.viben/agents/my-agent/memory/
  Sessions: ~/.viben/agents/my-agent/.agent_sessions/

Memory:
  MEMORY.md     2.3 KB    last modified 2h ago
  2024-01-16.md 1.1 KB    today
  2024-01-15.md 3.2 KB    yesterday

Sessions (1):
  main   "Feature development"   2h ago   42 messages

MCP: filesystem, git (2 enabled)
Skills: code-review, commit (2 enabled)
```

**`viben agent template list` (Human)**:
```
Agent Templates:
  coding-assistant    claude-code   "General coding assistant"
  researcher          gemini        "Research and analysis"
  code-reviewer       claude-code   "Code review specialist"
```

**`viben agent list --json`**:
```json
{
  "success": true,
  "data": {
    "current": "main",
    "agents": [
      {
        "id": "main",
        "name": "Main Agent",
        "type": "claude-code",
        "path": "~/.viben/agents/main/",
        "session_count": 3,
        "memory_size": "5.6 KB"
      },
      {
        "id": "my-agent",
        "name": "My Coding Assistant",
        "type": "claude-code",
        "path": "~/.viben/agents/my-agent/",
        "session_count": 1,
        "memory_size": "3.4 KB"
      }
    ]
  }
}
```

---

### 8. `viben provider`

Manage API providers (OpenAI, Anthropic, Google, etc.).

---

#### Provider Types

| Type | Description | Auth Methods |
|------|-------------|--------------|
| `openai` | OpenAI API | API Key |
| `anthropic` | Anthropic API | API Key |
| `google` | Google AI (Gemini) | API Key, OAuth |
| `azure` | Azure OpenAI | API Key, Azure AD |
| `openrouter` | OpenRouter | API Key |
| `ollama` | Ollama (local) | None |
| `custom` | Custom OpenAI-compatible | API Key |

---

#### Commands

```bash
# ============================================================
# Provider 管理
# ============================================================

# 列出所有 providers
viben provider list
viben provider list --json

# 创建 provider
viben provider create -n <name> -t <type> -c <config-file>
viben provider create -n <name> -t <type> --auth <auth-method>
viben provider create -n <name> -t <type> --api-key <key>
viben provider create -n <name> -t <type> --api-key <key> --base-url <url>

# 简写 (自动生成名称)
viben provider create -t openai --api-key <key>
viben provider create -t anthropic --api-key <key>
viben provider create -t custom --api-key <key> --base-url https://api.example.com/v1

# 删除 provider
viben provider remove -n <name>

# 设置默认 provider
viben provider set-default -n <name>

# 查看 provider 状态 (连通性检查)
viben provider status
viben provider status -n <name>
```

---

#### Provider Configuration

```yaml
# ~/.viben/providers.yaml
version: 1

default: anthropic-main

providers:
  anthropic-main:
    type: anthropic
    api_key: "encrypted:sk-ant-xxx"

  openai-main:
    type: openai
    api_key: "encrypted:sk-xxx"

  azure-gpt4:
    type: azure
    api_key: "encrypted:xxx"
    base_url: "https://my-resource.openai.azure.com"
    api_version: "2024-02-15-preview"
    deployment: "gpt-4-turbo"

  local-ollama:
    type: ollama
    base_url: "http://localhost:11434"

  custom-api:
    type: custom
    api_key: "encrypted:xxx"
    base_url: "https://api.example.com/v1"
```

---

#### Output Examples

**`viben provider list` (Human)**:
```
Providers:
  anthropic-main*   anthropic   ✓ connected
  openai-main       openai      ✓ connected
  azure-gpt4        azure       ✓ connected
  local-ollama      ollama      ○ not running
  custom-api        custom      ✓ connected

* = default provider
```

**`viben provider status` (Human)**:
```
Provider Status:
  anthropic-main   anthropic   ✓ connected   latency: 120ms
  openai-main      openai      ✓ connected   latency: 85ms
  azure-gpt4       azure       ✓ connected   latency: 150ms
  local-ollama     ollama      ✗ error       connection refused
  custom-api       custom      ✓ connected   latency: 200ms
```

---

### 9. `viben model`

Manage models, aliases, and fallbacks.

---

#### Commands

```bash
# ============================================================
# Model 管理
# ============================================================

# 列出可用 models
viben model list
viben model list --provider <provider-name>
viben model list --json

# 查看 model 状态
viben model status
viben model status -n <model>

# 设置默认 model
viben model set-default -n <model>

# ============================================================
# Model Aliases (别名)
# ============================================================

# 列出别名
viben model aliases list

# 创建别名
viben model aliases create -n <alias> -f <model>
viben model aliases create -n fast -f claude-3-5-haiku-latest
viben model aliases create -n smart -f claude-sonnet-4-20250514
viben model aliases create -n best -f claude-opus-4-20250514

# 删除别名
viben model aliases remove -n <alias>

# ============================================================
# Model Fallbacks (回退链)
# ============================================================

# 列出回退链
viben model fallbacks list

# 添加到回退链
viben model fallbacks create -n <model>
viben model fallbacks create -n claude-sonnet-4-20250514
viben model fallbacks create -n gpt-4-turbo
viben model fallbacks create -n claude-3-5-haiku-latest

# 从回退链移除
viben model fallbacks remove -n <model>

# 清空回退链
viben model fallbacks clear
```

---

#### Model Configuration

```yaml
# ~/.viben/models.yaml
version: 1

default: claude-sonnet-4-20250514

# 模型别名
aliases:
  fast: claude-3-5-haiku-latest
  smart: claude-sonnet-4-20250514
  best: claude-opus-4-20250514
  gpt: gpt-4-turbo

# 回退链 (按顺序尝试)
fallbacks:
  - claude-sonnet-4-20250514
  - gpt-4-turbo
  - claude-3-5-haiku-latest

# 模型特定配置
model_config:
  claude-sonnet-4-20250514:
    provider: anthropic-main
    max_tokens: 8192
    temperature: 0.7

  gpt-4-turbo:
    provider: openai-main
    max_tokens: 4096
    temperature: 0.7
```

---

#### Output Examples

**`viben model list` (Human)**:
```
Available Models:
  Provider: anthropic-main
    claude-opus-4-20250514        200K context   $15/$75
    claude-sonnet-4-20250514*     200K context   $3/$15
    claude-3-5-haiku-latest       200K context   $0.25/$1.25

  Provider: openai-main
    gpt-4-turbo                   128K context   $10/$30
    gpt-4o                        128K context   $2.5/$10
    gpt-4o-mini                   128K context   $0.15/$0.6

* = default model
```

**`viben model aliases list` (Human)**:
```
Model Aliases:
  fast   → claude-3-5-haiku-latest
  smart  → claude-sonnet-4-20250514
  best   → claude-opus-4-20250514
  gpt    → gpt-4-turbo
```

**`viben model fallbacks list` (Human)**:
```
Fallback Chain:
  1. claude-sonnet-4-20250514   (anthropic-main)
  2. gpt-4-turbo                (openai-main)
  3. claude-3-5-haiku-latest    (anthropic-main)
```

**`viben model status` (Human)**:
```
Model Status:
  Default: claude-sonnet-4-20250514

  claude-sonnet-4-20250514   anthropic-main   ✓ available
  gpt-4-turbo                openai-main      ✓ available
  claude-3-5-haiku-latest    anthropic-main   ✓ available
  local-llama                local-ollama     ✗ provider offline
```

---

### 10. `viben mcp`

MCP (Model Context Protocol) 相关命令。

---

#### 10.1 `viben mcp inspector`

启动 MCP Inspector 用于测试和调试 MCP servers。基于 `@modelcontextprotocol/inspector` 包。

```bash
# 启动 Inspector (仅启动 proxy，不自动打开浏览器)
viben mcp inspector

# 指定 MCP server 命令
viben mcp inspector node build/index.js
viben mcp inspector npx @anthropic-ai/mcp-server-filesystem

# 传递参数给 MCP server
viben mcp inspector node build/index.js arg1 arg2

# 传递环境变量
viben mcp inspector -e API_KEY=value node build/index.js
viben mcp inspector -e KEY1=val1 -e KEY2=val2 node build/index.js

# 使用配置文件
viben mcp inspector --config mcp.json
viben mcp inspector --config mcp.json --server myserver

# CLI 模式 (非交互式)
viben mcp inspector --cli node build/index.js

# SSE/HTTP 传输
viben mcp inspector --transport sse --server-url https://example.com/sse
viben mcp inspector --transport http --server-url https://example.com/mcp
```

**Options**:

| 选项 | 说明 |
|------|------|
| `-c, --config <path>` | 配置文件路径 (JSON 格式，包含 mcpServers) |
| `-s, --server <name>` | 配置文件中的 server 名称 |
| `--cli` | CLI 模式 (非交互式) |
| `-t, --transport <type>` | 传输类型 (stdio, sse, http) |
| `-u, --server-url <url>` | SSE/HTTP 传输的 server URL |
| `-e, --env <key=value>` | 传递给 MCP server 的环境变量 |

**Output**:
```
Starting MCP Inspector Proxy...
⚙️ Proxy server listening on localhost:6277
🔑 Session token: xxx

🚀 MCP Inspector is up and running at:
   http://localhost:6274/?MCP_PROXY_AUTH_TOKEN=xxx
```

> **Note**: Inspector 仅启动 proxy server，不会自动打开浏览器。手动访问输出的 URL 即可使用 Web UI。

---

#### 10.2 `viben mcp serve`

启动 MCP server (基于 browse-mcp Python 包)。

```bash
# 启动 MCP server
viben mcp serve

# 指定端口
viben mcp serve --port 8080

# 指定传输类型
viben mcp serve -t sse --port 8080
```

---

#### 10.3 MCP Server 管理 (计划中)

```bash
# 安装/卸载
viben mcp install <name>          # 从 marketplace 安装
viben mcp install <name>@<version>
viben mcp uninstall <name>

# 列表
viben mcp list                    # 列出已安装的 MCP
viben mcp list --available        # 列出可安装的 MCP

# 启用/禁用
viben mcp enable <name>           # 启用 MCP
viben mcp disable <name>          # 禁用 MCP

# 配置单个 MCP
viben mcp config <name>           # 查看 MCP 配置
viben mcp config <name> set <key> <value>
viben mcp config filesystem set root /path/to/dir
```

**Output (Human)**:
```
Installed MCP Servers:
  filesystem    v1.2.0    enabled    Local filesystem access
  git           v2.0.1    enabled    Git operations
  browser       v1.0.0    disabled   Browser automation
```

---

### 11. `viben skill`

Manage skills.

```bash
# 安装/卸载
viben skill install <name>
viben skill install <name>@<version>
viben skill uninstall <name>

# 列表
viben skill list                  # 列出已安装的 skills
viben skill list --available      # 列出可安装的 skills
```

**Output (Human)**:
```
Installed Skills:
  code-review     v1.0.0    Code review assistance
  commit          v1.2.0    Smart commit messages
  test-runner     v0.9.0    Test execution helper
```

---

### 12. `viben workspace`

Workspace operations.

```bash
# 列出工作区
viben workspace list              # 列出所有已知工作区

# 当前工作区
viben workspace current           # 显示当前工作区信息
```

**Output (Human)**:
```
Current Workspace:
  Path: /Users/xxx/projects/viben
  MCP:  filesystem, git (2 enabled)
  Skills: code-review, commit (2 enabled)
```

---

## Agent Integration

### JSON Output for Agents

所有命令支持 `--json` flag，输出结构化 JSON 供 Agent 解析。

**Response Schema**:

```typescript
interface CLIResponse {
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
  };
}
```

### Agent Usage Examples

Agent 可以通过 Bash 工具调用 CLI：

```bash
# 获取当前配置
viben config list --json

# 为工作区安装 MCP
viben mcp install filesystem --workspace --json

# 配置 Claude Code 的 MCP
viben agent config claude-code mcp add filesystem --json

# 同步到 agent
viben agent sync claude-code --json
```

### Error Handling

```json
{
  "success": false,
  "error": {
    "code": "MCP_NOT_FOUND",
    "message": "MCP server 'unknown-mcp' not found in marketplace"
  }
}
```

---

## Implementation Plan

### Phase 1: Foundation

1. 项目结构搭建 (`apps/cli/`)
2. 基础命令框架 (Commander.js)
3. 配置文件读写 (YAML)
4. 全局选项处理 (`--json`, `--global`, etc.)

### Phase 2: Core Commands

1. `viben init`
2. `viben config` (git-style)
3. `viben workspace list/current`

### Phase 2.5: Executor Discovery

1. `viben executor list` - 发现本地已安装的 executors
2. `viben executor show -n <id>` - 查看 executor 详情
3. Executor 检测器实现 (Claude Code, Cursor, etc.)
4. Executor 类型定义和配置路径映射

> **Note**: 此阶段只实现发现功能，不实现安装。安装由用户通过官方渠道完成。

### Phase 3: MCP & Skills

1. `viben mcp install/uninstall/list/enable/disable/config`
2. `viben skill install/uninstall/list`

### Phase 4: Service & Agent

1. `viben service status/start/stop/restart/logs`
2. `viben agent list/config/sync`
3. Agent 与 Executor 的关联关系

### Phase 5: Channels & Cron (nanobot-inspired)

1. `viben channel list/create/remove/enable/disable/status/config`
2. `viben channel login` (WhatsApp QR)
3. `viben cron list/add/remove/enable/disable/show/run`
4. Channel implementations: Telegram, Discord, WhatsApp, Feishu

### Phase 6: Gateway Runtime (nanobot-inspired)

1. Message Bus (inbound/outbound queues)
2. Context Builder (system prompt + memory + skills)
3. Agent Loop (LLM ↔ tool execution)
4. Subagent Manager (background tasks)
5. `viben gateway` command
6. Integration with all channels

---

## Directory Structure

```
apps/cli/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # Entry point
│   ├── cli.ts                # Commander setup
│   ├── commands/
│   │   ├── init.ts
│   │   ├── config.ts
│   │   ├── service.ts
│   │   ├── gateway.ts        # viben gateway
│   │   ├── executor/
│   │   │   ├── index.ts      # viben executor
│   │   │   ├── list.ts       # viben executor list
│   │   │   └── show.ts       # viben executor show
│   │   ├── agent/
│   │   │   ├── index.ts      # viben agent
│   │   │   ├── list.ts       # viben agent list
│   │   │   ├── create.ts     # viben agent create
│   │   │   ├── remove.ts     # viben agent remove
│   │   │   ├── show.ts       # viben agent show
│   │   │   ├── config.ts     # viben agent config
│   │   │   ├── status.ts     # viben agent status
│   │   │   ├── set-default.ts # viben agent set-default
│   │   │   ├── template.ts   # viben agent template
│   │   │   ├── session.ts    # viben agent session
│   │   │   └── memory.ts     # viben agent memory
│   │   ├── provider/
│   │   │   ├── index.ts      # viben provider
│   │   │   ├── list.ts       # viben provider list
│   │   │   ├── create.ts     # viben provider create
│   │   │   ├── remove.ts     # viben provider remove
│   │   │   ├── status.ts     # viben provider status
│   │   │   └── set-default.ts # viben provider set-default
│   │   ├── model/
│   │   │   ├── index.ts      # viben model
│   │   │   ├── list.ts       # viben model list
│   │   │   ├── status.ts     # viben model status
│   │   │   ├── set-default.ts # viben model set-default
│   │   │   ├── aliases.ts    # viben model aliases
│   │   │   └── fallbacks.ts  # viben model fallbacks
│   │   ├── channel/
│   │   │   ├── index.ts      # viben channel
│   │   │   ├── list.ts       # viben channel list
│   │   │   ├── create.ts     # viben channel create
│   │   │   ├── remove.ts     # viben channel remove
│   │   │   ├── status.ts     # viben channel status
│   │   │   ├── config.ts     # viben channel config
│   │   │   ├── enable.ts     # viben channel enable
│   │   │   ├── disable.ts    # viben channel disable
│   │   │   ├── set-default.ts # viben channel set-default
│   │   │   └── login.ts      # viben channel login (WhatsApp)
│   │   ├── cron/
│   │   │   ├── index.ts      # viben cron
│   │   │   ├── list.ts       # viben cron list
│   │   │   ├── add.ts        # viben cron add
│   │   │   ├── remove.ts     # viben cron remove
│   │   │   ├── show.ts       # viben cron show
│   │   │   ├── enable.ts     # viben cron enable
│   │   │   ├── disable.ts    # viben cron disable
│   │   │   └── run.ts        # viben cron run
│   │   ├── mcp.ts
│   │   ├── skill.ts
│   │   └── workspace.ts
│   ├── lib/
│   │   ├── config.ts         # Config file operations
│   │   ├── scope.ts          # Scope detection
│   │   ├── output.ts         # Human/JSON output
│   │   ├── executors.ts      # Executor detection & management
│   │   ├── agents.ts         # Agent management
│   │   ├── templates.ts      # Template management
│   │   ├── providers.ts      # Provider management
│   │   ├── models.ts         # Model management
│   │   ├── sessions.ts       # Session management
│   │   ├── memory.ts         # Memory management
│   │   ├── channels.ts       # Channel management
│   │   ├── cron.ts           # Cron job management
│   │   ├── gateway/          # Gateway runtime
│   │   │   ├── index.ts      # Gateway entry
│   │   │   ├── bus.ts        # Message bus
│   │   │   ├── loop.ts       # Agent loop
│   │   │   └── context.ts    # Context builder
│   │   ├── channels/         # Channel implementations
│   │   │   ├── base.ts       # Base channel interface
│   │   │   ├── telegram.ts   # Telegram bot
│   │   │   ├── discord.ts    # Discord bot
│   │   │   ├── whatsapp.ts   # WhatsApp bridge
│   │   │   ├── feishu.ts     # Feishu WebSocket
│   │   │   └── index.ts      # Channel registry
│   │   └── adapters/         # Agent type adapters
│   │       ├── base.ts       # Base adapter interface
│   │       ├── claude-code.ts
│   │       ├── cursor.ts
│   │       ├── gemini.ts
│   │       ├── codex.ts
│   │       ├── windsurf.ts
│   │       ├── amp.ts
│   │       ├── opencode.ts
│   │       ├── qwen-code.ts
│   │       ├── droid.ts
│   │       └── index.ts      # Adapter registry
│   └── types/
│       ├── index.ts
│       ├── config.ts         # Config types
│       ├── executor.ts       # Executor types
│       ├── agent.ts          # Agent types
│       ├── template.ts       # Template types
│       ├── provider.ts       # Provider types
│       ├── model.ts          # Model types
│       ├── session.ts        # Session types
│       ├── memory.ts         # Memory types
│       ├── channel.ts        # Channel types
│       ├── cron.ts           # Cron types
│       └── gateway.ts        # Gateway types
└── bin/
    └── viben                 # Executable entry
```

---

## Acceptance Criteria

### Core
- [ ] `viben --help` 显示所有命令
- [ ] `viben config` 支持 git 风格的配置管理
- [ ] `--json` flag 在所有命令中生效
- [ ] 自动检测工作区 scope
- [ ] 配置文件格式为 YAML
- [ ] 全局配置和工作区配置正确合并
- [ ] 环境变量 `VIBEN_STATE_DIR`, `VIBEN_AGENT` 等正确工作

### Executor Discovery (发现，不安装)
- [ ] `viben executor list` 列出所有已发现的 executors
- [ ] `viben executor list --json` 输出 JSON 格式
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

### Agent Management
- [ ] `viben agent list` 列出所有 agents
- [ ] `viben agent create -n <id>` 创建新 agent
- [ ] `viben agent create -n <id> -f <template>` 从模板创建
- [ ] `viben agent create -n <id> --clone <existing>` 克隆现有 agent
- [ ] `viben agent show -n <id>` 显示 agent 详情
- [ ] `viben agent remove -n <id>` 删除 agent
- [ ] `viben agent config -n <id> set <key> <value>` 配置 agent
- [ ] `viben agent set-default -n <id>` 设置默认 agent
- [ ] `viben agent status` 显示 agent 状态

### Agent Templates
- [ ] `viben agent template list` 列出所有模板
- [ ] `viben agent template create -n <id> --clone <agent>` 从 agent 创建模板
- [ ] `viben agent template show -n <id>` 显示模板详情
- [ ] `viben agent template remove -n <id>` 删除模板

### Provider Management
- [ ] `viben provider list` 列出所有 providers
- [ ] `viben provider create -n <name> -t <type>` 创建 provider
- [ ] `viben provider create -t <type> --api-key <key>` 快速创建
- [ ] `viben provider remove -n <name>` 删除 provider
- [ ] `viben provider set-default -n <name>` 设置默认 provider
- [ ] `viben provider status` 检查 provider 连通性
- [ ] 支持 provider 类型: openai, anthropic, google, azure, openrouter, ollama, custom

### Model Management
- [ ] `viben model list` 列出可用 models
- [ ] `viben model status` 显示 model 状态
- [ ] `viben model set-default -n <model>` 设置默认 model
- [ ] `viben model aliases list/create/remove` 管理别名
- [ ] `viben model fallbacks list/create/remove/clear` 管理回退链

### Memory System
- [ ] `memory/MEMORY.md` 作为主记忆文件
- [ ] `memory/YYYY-MM-DD.md` 作为每日日志 (append-only)
- [ ] 会话启动时读取 today + yesterday 日志
- [ ] `viben agent memory show/append/edit` 管理记忆

### Sessions
- [ ] `viben agent session list/create/remove/clear` 管理会话
- [ ] Sessions 存储在 `.agent_sessions/<session_id>/`
- [ ] 会话包含 `config.yaml` 和 `messages.rollout.jsonl`

### Runtime Config Merging
- [ ] Agent 基础配置 (`~/.viben/agents/<id>/config.yaml`) 正确加载
- [ ] 工作区配置 (`.claude/` 等) 正确叠加
- [ ] 配置按优先级正确合并

### Skills & MCP Scoping
- [ ] 共享 skills (`~/.viben/skills/`) 所有 agents 可用
- [ ] Agent 专属 skills (`agents/<id>/skills/`) 仅该 agent 可用
- [ ] `viben skill install -n <agent-id>` 安装到特定 agent
- [ ] MCP 配置支持 `mcp_servers.json` 格式

### Agent Integration
- [ ] Agent 可通过 Bash 工具成功调用 CLI
- [ ] JSON 输出格式一致，便于 Agent 解析
- [ ] 错误信息结构化，包含 error code

### Gateway (Agent Runtime)
- [ ] `viben gateway` 启动 gateway
- [ ] `viben gateway -n <agent-id>` 指定 agent
- [ ] `viben gateway --daemon` 后台运行
- [ ] `viben gateway stop` 停止后台 gateway
- [ ] Gateway 正确初始化 message bus
- [ ] Gateway 正确启动 agent loop
- [ ] Gateway 正确连接已启用的 channels

### Channel Management
- [ ] `viben channel list` 列出所有 channels
- [ ] `viben channel create -n <id> --type telegram --token <token>` 创建 Telegram channel
- [ ] `viben channel create -n <id> --type discord --token <token>` 创建 Discord channel
- [ ] `viben channel create -n <id> --type feishu --app-id <id> --app-secret <secret>` 创建 Feishu channel
- [ ] `viben channel remove -n <id>` 删除 channel
- [ ] `viben channel enable -n <id>` 启用 channel
- [ ] `viben channel disable -n <id>` 禁用 channel
- [ ] `viben channel set-default -n <id>` 设置默认 channel
- [ ] `viben channel status` 显示 channel 连接状态
- [ ] `viben channel config -n <id> set <key> <value>` 配置 channel
- [ ] `viben channel login -n <id>` WhatsApp QR 扫码登录
- [ ] Channels 配置存储在 `~/.viben/channels.yaml`
- [ ] 支持 channel 类型: telegram, discord, whatsapp, feishu

### Cron Management
- [ ] `viben cron list` 列出所有 cron jobs
- [ ] `viben cron add --name <name> --message <msg> --cron "<expr>"` 添加 cron 任务
- [ ] `viben cron add --name <name> --message <msg> --every <seconds>` 添加间隔任务
- [ ] `viben cron remove <job_id>` 删除 cron job
- [ ] `viben cron enable <job_id>` 启用 cron job
- [ ] `viben cron disable <job_id>` 禁用 cron job
- [ ] `viben cron show <job_id>` 显示 cron job 详情
- [ ] `viben cron run <job_id>` 立即执行 cron job
- [ ] Cron 配置存储在 `~/.viben/cron.yaml`
- [ ] 支持标准 cron 表达式格式
- [ ] 支持 `--every` 秒数间隔格式
- [ ] Cron jobs 可指定目标 channel 和 agent

---

## Testing

### 测试框架

| 组件 | 选择 | 说明 |
|------|------|------|
| 测试框架 | Vitest | 快速、支持 TypeScript |
| 断言库 | Vitest (内置) | expect API |
| Mock | vi.spyOn | Console、process.exit 等 |
| 覆盖率 | v8 | 原生 Node.js 覆盖率 |

### 测试配置

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/types/**'],
    },
    testTimeout: 60000,  // 部分命令需要较长时间
    hookTimeout: 60000,
  },
});
```

### 测试文件结构

```
apps/cli/__tests__/
├── unit/                          # 单元测试
│   ├── output.test.ts             # 输出工具测试
│   ├── scope.test.ts              # 作用域检测测试
│   ├── config.test.ts             # 配置读写测试
│   ├── agents.test.ts             # Agent 管理测试
│   └── executors.test.ts          # Executor 检测测试
└── integration/                   # 集成测试
    ├── init.test.ts               # viben init
    ├── config.test.ts             # viben config
    ├── executor.test.ts           # viben executor
    ├── agent.test.ts              # viben agent
    ├── provider.test.ts           # viben provider
    ├── model.test.ts              # viben model
    ├── workspace.test.ts          # viben workspace
    ├── service.test.ts            # viben service
    ├── skill.test.ts              # viben skill
    ├── channel.test.ts            # viben channel
    └── cron.test.ts               # viben cron
```

### 测试覆盖范围

| 命令组 | 测试文件 | 测试数量 | 覆盖内容 |
|--------|----------|----------|----------|
| executor | executor.test.ts | ~30 | list, show, JSON output, capabilities |
| provider | provider.test.ts | 41 | list, create, remove, set-default, status |
| model | model.test.ts | 33 | list, status, set-default, aliases, fallbacks |
| skill | skill.test.ts | 29 | list, install, uninstall |
| channel | channel.test.ts | 37 | list, create, remove, enable, disable, set-default, status |
| cron | cron.test.ts | 29 | list, add, remove, enable, disable, show |
| workspace | workspace.test.ts | 13 | list, current |
| service | service.test.ts | 25 | status, start, stop, logs |

**总计**: 16 个测试文件，约 380+ 测试用例

### 测试模式

#### 1. 临时目录隔离

每个测试使用独立的临时目录，避免污染真实配置：

```typescript
beforeEach(() => {
  tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'viben-test-')));
  process.env.VIBEN_STATE_DIR = path.join(tempDir, 'state');
});

afterEach(() => {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true });
  }
});
```

#### 2. Console 输出捕获

```typescript
let consoleOutput: string[] = [];
let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleOutput = [];
  consoleSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
    consoleOutput.push(args.join(' '));
  });
});
```

#### 3. JSON 输出测试

所有命令都测试 `--json` flag：

```typescript
it('should output JSON format with --json flag', async () => {
  const program = createProgram();
  await program.parseAsync(['node', 'viben', '--json', 'provider', 'list']);

  const output = consoleOutput.join('\n');
  const parsed = JSON.parse(output);

  expect(parsed.success).toBe(true);
  expect(parsed.data.providers).toBeDefined();
});
```

#### 4. 错误处理测试

```typescript
it('should output JSON error with --json flag', async () => {
  const program = createProgram();
  await program.parseAsync(['node', 'viben', '--json', 'executor', 'show', '-n', 'INVALID']);

  const output = consoleOutput.join('\n');
  const parsed = JSON.parse(output);

  expect(parsed.success).toBe(false);
  expect(parsed.error.code).toBe('EXECUTOR_NOT_FOUND');
});
```

### 运行测试

```bash
# 运行所有测试
cd apps/cli && pnpm test

# 运行特定测试文件
pnpm test executor.test.ts

# 运行带覆盖率
pnpm test:coverage

# 监听模式
pnpm test:watch
```

### 已知限制

1. **Executor 检测超时**: `executor.test.ts` 需要 60s 超时，因为 `execSync` 检测命令可能较慢
2. **Service 进程测试**: 部分测试 (如实际启动 MCP 服务) 被 skip，因为会产生子进程清理问题
3. **Vitest Worker 超时**: 大量测试并行运行时可能出现 worker 超时，是 Vitest 已知问题，不影响测试结果

---

## Related Documents

- [Workspace Management](./workspace-management.md) - 工作区管理规范
- [MCP API](./mcp-api.md) - MCP 市场 API
- [Skills API](./skills-api.md) - Skills 市场 API
