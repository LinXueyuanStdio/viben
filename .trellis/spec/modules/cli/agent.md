# viben agent

> 管理 agent 实例和模板。

## 架构概述

```
┌─────────────────────────────────────────────────────────┐
│                    Viben CLI                            │
├─────────────────────────────────────────────────────────┤
│  Agent Instance (独立的 agent 实例)                    │
│      ├── config.yaml (agent 配置)                       │
│      ├── mcp_servers.json (MCP 配置)                    │
│      ├── skills/ (agent 专属 skills)                    │
│      ├── memory/ (agent 记忆)                           │
│      │   ├── MEMORY.md (主记忆)                         │
│      │   └── YYYY-MM-DD.md (每日日志, append-only)      │
│      ├── .agentrc (启动配置)                            │
│      ├── .agent_history (命令历史)                      │
│      └── .agent_sessions/<session_id>/ (会话存储)       │
└─────────────────────────────────────────────────────────┘
```

---

## 核心概念

| 概念 | 说明 |
|------|------|
| **Agent** | 独立的智能体实例，拥有自己的配置、记忆、会话 |
| **Memory** | Agent 的长期记忆 (MEMORY.md + 每日日志) |
| **Session** | Agent 的会话存储 (对话历史、状态) |
| **Workspace Config** | 项目工作区的 agent 类型配置 (如 `.claude/`) |

---

## 运行时配置合并

Agent 实际运行时，配置按以下顺序叠加：

```
1. ~/.viben/agents/<id>/config.yaml     # Agent 基础配置
2. <project>/.claude/ (或其他 agent 类型)  # 工作区 agent 类型配置
3. 命令行参数                              # 运行时覆盖
```

例如：在 `/projects/my-app` 目录下运行 agent `main`，会先加载 `~/.viben/agents/main/config.yaml`，如果 type 为 `claude-code `，再叠加 `/projects/my-app/.claude/` 的配置。

---

## Agent 路径映射

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

## Memory 系统

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

## 命令

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
viben agent create -n my-agent -f <template-agent-id>              # 从模板创建
viben agent create -n my-agent -f /path/to/config.yaml       # 从配置文件创建
viben agent create -n my-agent --clone <existing-agent-id>   # 克隆现有 agent
viben agent create -n my-agent --executor /path/to/executor # 使用特定 executor, 如 `~/Documents/my-project/.claude`

# 查看 agent 详情
viben agent show -n <id>
viben agent show -n my-agent

# 删除 agent
viben agent remove -n <id>
viben agent remove -n my-agent
viben agent remove -n my-agent --force                       # 强制删除

# 配置 agent
viben agent config -n <id>                                   # 查看配置
viben agent config -n <id> --set <key>=<value>               # 设置配置
viben agent config -n my-agent --set model=gpt-4
viben agent config -n my-agent --set plan=true
viben agent config -n my-agent --set mcp.enabled="[\"filesystem\",\"git\"]"

# 设置默认 agent
viben agent set-default -n <id>
viben agent set-default -n my-agent

# 设置为模板
viben agent set-template -n <id>
viben agent set-template -n coding-assistant --description "A general coding assistant template"

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
viben agent session create -n <agent-id> [--session-name <name>]
viben agent session create -n my-agent --session-name "feature-auth"

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

## Agent 配置文件

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

## MCP Servers 配置

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

## Agent RC 文件

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

## 输出示例

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

## Acceptance Criteria

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
- [ ] `viben skill install <name> --agent <agent-id>` 安装到特定 agent
- [ ] MCP 配置支持 `mcp_servers.json` 格式

---

## Related Documents

- [executor.md](./executor.md) - Executor 发现命令
- [provider.md](./provider.md) - Provider 管理命令
- [model.md](./model.md) - Model 管理命令
