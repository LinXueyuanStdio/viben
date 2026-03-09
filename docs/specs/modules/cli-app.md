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

## Command Structure

详细命令文档请参见 [cli/index.md](./cli/index.md)。

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

### Commands Detail

| Command | Description | Doc |
|---------|-------------|-----|
| `viben init` | 初始化工作区 | [cli/init.md](./cli/init.md) |
| `viben config` | Git 风格配置管理 | [cli/config.md](./cli/config.md) |
| `viben service` | 后台服务管理 | [cli/service.md](./cli/service.md) |
| `viben gateway` | Gateway 运行时 | [cli/gateway.md](./cli/gateway.md) |
| `viben executor` | Executor 发现和 Chat | [cli/executor.md](./cli/executor.md) |
| `viben agent` | Agent 管理 | [cli/agent.md](./cli/agent.md) |
| `viben provider` | API Provider 管理 | [cli/provider.md](./cli/provider.md) |
| `viben model` | Model 管理 | [cli/model.md](./cli/model.md) |
| `viben channel` | Chat Channel 管理 | [cli/channel.md](./cli/channel.md) |
| `viben cron` | 定时任务管理 | [cli/cron.md](./cli/cron.md) |
| `viben mcp` | MCP Server 管理 | [cli/mcp.md](./cli/mcp.md) |
| `viben skill` | Skill 管理 | [cli/skill.md](./cli/skill.md) |
| `viben workspace` | 工作区操作 | [cli/workspace.md](./cli/workspace.md) |

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
├── agents/                                  # Agent 实例目录 (包含模板)
│   └── <agent-id>/                          # 单个 agent 实例
│       ├── config.yaml                      # Agent 配置 (isTemplate: true 标记模板)
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
│   # Note: 模板是 config.yaml 中标记 isTemplate: true 的普通 agent
│   # 通过 `viben agent template list` 动态发现，无需单独目录
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
│   │   ├── executor/         # viben executor
│   │   ├── agent/            # viben agent
│   │   ├── provider/         # viben provider
│   │   ├── model/            # viben model
│   │   ├── channel/          # viben channel
│   │   ├── cron/             # viben cron
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
│   │   ├── channels/         # Channel implementations
│   │   └── adapters/         # Agent type adapters
│   └── types/
│       └── ...               # Type definitions
└── bin/
    └── viben                 # Executable entry
```

---

## Acceptance Criteria

详细的 Acceptance Criteria 请参见各子命令文档：

- [cli/executor.md](./cli/executor.md) - Executor Discovery & Chat
- [cli/agent.md](./cli/agent.md) - Agent Management
- [cli/provider.md](./cli/provider.md) - Provider Management
- [cli/model.md](./cli/model.md) - Model Management
- [cli/channel.md](./cli/channel.md) - Channel Management
- [cli/cron.md](./cli/cron.md) - Cron Management
- [cli/gateway.md](./cli/gateway.md) - Gateway Runtime

### Core
- [ ] `viben --help` 显示所有命令
- [ ] `viben config` 支持 git 风格的配置管理
- [ ] `--json` flag 在所有命令中生效
- [ ] 自动检测工作区 scope
- [ ] 配置文件格式为 YAML
- [ ] 全局配置和工作区配置正确合并
- [ ] 环境变量 `VIBEN_STATE_DIR`, `VIBEN_AGENT` 等正确工作

### Agent Integration
- [ ] Agent 可通过 Bash 工具成功调用 CLI
- [ ] JSON 输出格式一致，便于 Agent 解析
- [ ] 错误信息结构化，包含 error code

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

---

## Related Documents

- [cli/index.md](./cli/index.md) - CLI 命令详细文档索引
- [Workspace Management](./workspace/workspace-management.md) - 工作区管理规范
- [MCP API](./mcp-api.md) - MCP 市场 API
- [Skills API](./skills-api.md) - Skills 市场 API
